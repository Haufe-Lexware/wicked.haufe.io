utils = {};

utils.createRandomId = function () {
    return crypto.randomBytes(5).toString('hex');
};

utils.getJson = function(ob) {
    if (ob instanceof String || typeof ob === "string")
        return JSON.parse(ob);
    return ob;
};

utils.getText = function(ob) {
    if (ob instanceof String || typeof ob === "string")
        return ob;
    return JSON.stringify(ob, null, 2);
};

module.exports = utils;