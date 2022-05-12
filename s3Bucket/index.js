const cfnResponse = require("cfn-response");
const AWS = require("aws-sdk");
const s3 = new AWS.S3();

exports.lambdaHandler = async (event, context) => {
  console.log(event);
  let responseData, responseStatus;
  const bucket = event["ResourceProperties"]["Bucket"];
  const lambdaArn = event["ResourceProperties"]["LambdaArn"];
  const filterValue = event["ResourceProperties"]["FilterValue"];
  const events = event["ResourceProperties"]["Events"];
  try {
    if (event["RequestType"] == "Delete") {
      await deleteNotification(lambdaArn, bucket, filterValue, events);
    } else {
      await createNotification(lambdaArn, bucket, filterValue, events);
      responseData = { Bucket: bucket };
    }
    responseStatus = "SUCCESS";
  } catch (error) {
    console.error(error);
    responseStatus = "FAILED";
    responseData = { Failure: error.message };
  }
  return cfnResponse.send(event, context, responseStatus, responseData);
};

async function createNotification(lambdaArn, bucket, filterValue, events) {
  const { LambdaFunctionConfigurations: lambdaConfig } = await getConfig(
    bucket
  );
  const filteredConfig = await filterConfig(lambdaConfig, lambdaArn);
  const notification = createLambdaConfig(lambdaArn, filterValue, events);
  const notifcationParams = createParams(
    [...filteredConfig, notification],
    bucket
  );
  return s3.putBucketNotificationConfiguration(notifcationParams).promise();
}

async function deleteNotification(lambdaArn, bucket, filterValue, events) {
  const { LambdaFunctionConfigurations: lambdaConfig } = await getConfig(
    bucket
  );
  const filteredLambdaConfigParams = await checkForConfigUpdate(
    lambdaConfig,
    lambdaArn,
    filterValue,
    events
  );
  let updatedConfig = createParams(filteredLambdaConfigParams, bucket);
  return s3.putBucketNotificationConfiguration(updatedConfig).promise();
}

function createParams(lambdaConfig, bucket) {
  return {
    Bucket: bucket,
    NotificationConfiguration: {
      LambdaFunctionConfigurations: lambdaConfig,
    },
  };
}

function createLambdaConfig(lambdaArn, filterValue, events) {
  if (!Array.isArray(events)) {
    throw new Error('Argument Error: "Events" should be an array.')
  }
  return {
    Events: events,
    LambdaFunctionArn: lambdaArn,
    Filter: {
      Key: {
        FilterRules: [
          {
            Name: "prefix",
            Value: filterValue,
          },
        ],
      },
    },
  };
}

async function filterConfig(lambdaConfig, lambdaArn) {
  return lambdaConfig.LambdaFunctionConfigurations.filter(
    (config) => config.LambdaFunctionArn !== lambdaArn
  );
}

async function checkForConfigUpdate(
  lambdaConfig,
  lambdaArn,
  filterValue,
  events
) {
  return lambdaConfig.filter((config) => {
    if (config.LambdaFunctionArn === lambdaArn) {
      if (
        !config.Filter.Key.FilterRules.find(
          (rule) => rule.Value !== filterValue
        ) &&
        config.Events.length === events.length &&
        config.Events.every((configEvent) => events.includes(configEvent))
      ) {
        return;
      }
    }
    return config;
  });
}

async function getConfig(bucket) {
  const params = {
    Bucket: bucket,
  };
  return s3.getBucketNotificationConfiguration(params).promise();
}
