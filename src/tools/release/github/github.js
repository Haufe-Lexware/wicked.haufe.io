const request = require('request');
const fs = require('fs');

const github = function () { };

github.init = function (repo, accessToken, tag, assetPath) {
    github.REPO = repo;
    github.BASE_URL = 'https://api.github.com/repos/' + repo;
    github.HEADERS = {
        'User-Agent': 'wicked Releaser 0.0.1',
        'Accept': 'application/json',
        'Authorization': `token ${accessToken}`
    };
    github.ACCESS_TOKEN = accessToken;
    github.TAG = tag;
    if (assetPath) {
        github.ASSET_PATH = assetPath;
        if (assetPath.indexOf('/') >= 0)
            github.ASSET_NAME = assetPath.substring(assetPath.lastIndexOf('/') + 1);
        else // Assume local file
            github.ASSET_NAME = assetPath;
    }
};

github.getReleaseIfPresent = function (callback) {
    console.log('Checking if release is already there...');
    request.get({
        url: `${github.BASE_URL}/releases/tags/${github.TAG}`,
        headers: github.HEADERS
    }, function (err, res, body) {
        if (err)
            return callback(err);
        const releaseJson = JSON.parse(body);
        if (res.statusCode === 200)
            return callback(null, releaseJson); // Already there
        else if (res.statusCode === 404)
            return callback(null, null); // Not present
        return callback(new Error(`checkIfAlreadyPresent() - Unknown status code ${res.statusCode}`));
    });
};

github.deleteReleaseIfPresent = function (releaseJson, callback) {
    if (!releaseJson)
        return callback(null, true); // Continue please
    // Let's delete it first, now we need the access token
    console.log('Deleting previously existing release...');
    request.delete({
        url: `${github.BASE_URL}/releases/${releaseJson.id}`,
        headers: github.HEADERS
    }, function (err, res, body) {
        if (err)
            return callback(err);
        if (res.statusCode === 204)
            return callback(null, true);
        return callback(new Error(`deleteIfPresent() - Unexpected status code ${res.statusCode}`));
    });
};

github.createRelease = function (success, callback) {
    console.log(`Creating release ${github.TAG}...`);
    request.post({
        url: `${github.BASE_URL}/releases`,
        headers: github.HEADERS,
        json: true,
        body: {
            tag_name: github.TAG,
            target_commitish: 'master',
            name: github.TAG,
            body: `Release ${github.TAG} of wicked.haufe.io\n\nSee [wicked.haufe.io release notes](https://github.com/Haufe-Lexware/wicked.haufe.io/blob/master/doc/release-notes.md) for more information`,
            draft: false,
            prerelease: false
        }
    }, function (err, res, body) {
        if (err)
            return callback(err);
        if (res.statusCode === 201)
            return callback(null, `Release ${github.TAG} successfully created.`);
        return callback(new Error(`createRelease() - Unexpected status code ${res.statusCode}`));
    });
};

github.getAssetInfoIfPresent = function (callback) {
    github.getReleaseIfPresent(function (err, releaseInfo) {
        if (err)
            return callback(err);
        if (!releaseInfo)
            return callback(new Error(`There is no release ${github.TAG} for repository ${github.REPO}.`));
        const releaseId = releaseInfo.id;
        request.get({
            url: `${github.BASE_URL}/releases/${releaseId}/assets`,
            headers: github.HEADERS
        }, function (err, res, body) {
            if (err)
                return callback(err);
            if (res.statusCode === 404)
                return callback(null, releaseInfo, null);
            if (res.statusCode !== 200)
                return callback(new Error(`getAssetInfoIfPresent - unknown return code ${res.statusCode}`));
            const assetList = JSON.parse(body);
            for (let i = 0; i < assetList.length; ++i) {
                const asset = assetList[i];
                if (asset.name == github.ASSET_NAME)
                    return callback(null, releaseInfo, asset);
            }
            return callback(null, releaseInfo, null);
        });
    });
};

github.deleteAssetIfPresent = function (releaseInfo, assetInfo, callback) {
    if (!assetInfo) {
        console.log('No, not found.');
        return callback(null, releaseInfo);
    }
    const releaseId = releaseInfo.id;
    const assetId = assetInfo.id;
    const assetUrl = `${github.BASE_URL}/releases/assets/${assetId}`;
    console.log(`Deleting ${assetUrl}...`);
    request.delete({
        url: assetUrl,
        headers: github.HEADERS
    }, function (err, res, body) {
        if (err)
            return callback(err);
        if (res.statusCode !== 204)
            return callback(new Error(`deleteAssetIfPresent - unknown status code ${res.statusCode}`));
        return callback(null, releaseInfo);
    });
};

function guessMimeType(name) {
    if (name.endsWith('zip'))
        return 'application/zip';
    if (name.endsWith('gz'))
        return 'application/gzip';
    return 'application/octet-stream'; // Stupid binary
}

github.uploadAsset = function (releaseInfo, callback) {
    let uploadUrl = releaseInfo.upload_url;
    // This is stupid
    uploadUrl = uploadUrl.substring(0, uploadUrl.indexOf('{')) + '?name=' + github.ASSET_NAME;
    console.log(`Uploading to ${uploadUrl}...`);

    const fileStats = fs.statSync(github.ASSET_PATH);
    const readStream = fs.createReadStream(github.ASSET_PATH);

    const headers = JSON.parse(JSON.stringify(github.HEADERS));
    headers['Content-Type'] = guessMimeType(github.ASSET_NAME);
    headers['Content-Length'] = fileStats.size;

    request.post({
        url: uploadUrl,
        headers: headers,
        body: readStream
    }, function (err, res, body) {
        if (err)
            return callback(err);
        if (res.statusCode !== 201) {
            console.error(body);
            return callback(new Error(`uploadAsset - unexpected status code ${res.statusCode}`));
        }
        return callback(null);
    });
};

module.exports = github;
