const request = require('request');
const debug = require('debug')('portal-env:docker-tools');

const dockerTools = function () { };

function getJson(ob) {
    if (ob instanceof String || typeof ob === "string")
        return JSON.parse(ob);
    return ob;
}

dockerTools.getMatchingTag = function (namespace, imageName, tagName, callback) {
    debug(`getMatchingTag(${namespace}, ${imageName}, ${imageName}`);
    const tagUrl = `https://index.docker.io/v1/repositories/${namespace}/${imageName}/tags`;
    request.get({
        url: tagUrl
    }, function (err, res, body) {
        if (err)
            return callback(err);
        if (res.statusCode !== 200) {
            return callback(new Error('getMatchingTag: Unexpected status code ' + res.statusCode));
        }
        const tagList = getJson(body);
        // This should be an array of tag names
        debug(tagList);

        const alpineIndex = tagName.indexOf('alpine');
        let exactTag = null;
        let fallbackTag = null;
        if (alpineIndex > 0) {
            const baseName = tagName.substring(0, alpineIndex - 1);
            if (imageName.indexOf('env') > 0) {
                exactTag = baseName + '-onbuild-alpine';
                fallbackTag = 'next-onbuild-alpine';
            } else {
                exactTag = tagName;
                fallbackTag = 'next-alpine';
            }
        } else {
            const baseName = tagName;
            if (imageName.indexOf('env') > 0) {
                exactTag = baseName + '-onbuild';
                fallbackTag = 'next-onbuild';
            } else {
                exactTag = baseName;
                fallbackTag = 'next';
            }
        }
        debug('exactTag: ' + exactTag);
        debug('fallbackTag: ' + fallbackTag);
        const exactMatch = tagList.find(tag => tag.name == exactTag);
        if (exactMatch)
            return callback(null, exactTag);
        return callback(null, fallbackTag);
    });
};

module.exports = dockerTools;
