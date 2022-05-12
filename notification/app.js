let response;
exports.lambdaHandler = async (event) => {
    try {
        console.log(JSON.stringify(event));
    } catch (err) {
        console.log(err);
        return err;
    }
    return response
};
