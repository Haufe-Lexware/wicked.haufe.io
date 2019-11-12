'use strict';

const request = require('request');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const utils = function () { };

utils.getJson = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return JSON.parse(ob);
    return ob;
};

utils.makeHeaders = function (additionalHeaders) {
    const headers = { 'Authorization': utils.apiKey };
    if (utils._host)
        headers.Host = utils._host;
    if (additionalHeaders) {
        for (let headerName in additionalHeaders) {
            headers[headerName] = additionalHeaders[headerName];
        }
    }
    return headers;
};

utils._host = null;
utils.setHost = function (host) {
    utils._host = host;
};

utils.checkForConfigKey = function () {
    if (process.env.PORTAL_CONFIG_KEY) {
        utils.apiKey = process.env.PORTAL_CONFIG_KEY;
        return true;
    }
    console.error('The environment variable PORTAL_CONFIG_KEY is not set.');
    return false;
};

utils.makeApiUrl = function (url) {
    if (url.endsWith('/'))
        return url;
    return url + '/';
};

utils.agent = null;
utils.configureAgent = function (deployUrl) {
    if (deployUrl.startsWith('https://')) {
        console.log('Enabling insecure communication via https.');
        const agentOptions = { rejectUnauthorized: false };
        utils.agent = new https.Agent(agentOptions);
    }
};

function getAgent() {
    return utils.agent;
}

function handleResult(desc, expectedStatusCode, bodyTransform, callback) {
    return function (err, apiRes, apiBody) {
        if (err)
            return callback(err);
        if (apiRes.statusCode != expectedStatusCode) {
            console.log(apiBody);
            err = new Error(desc + ' failed. Unexpected status code ' + apiRes.statusCode + ' vs expected ' + expectedStatusCode);
            return callback(err);
        }

        let jsonBody = null;
        if (apiRes.statusCode != 204 && apiBody)
            jsonBody = utils.getJson(apiBody);

        if (bodyTransform)
            return callback(null, bodyTransform(jsonBody));
        return callback(null, jsonBody);
    };
}

utils.postExport = function (deployUrl, done) {
    console.log('Requesting new export job...');
    request.post({
        url: deployUrl + 'export',
        headers: utils.makeHeaders(),
        agent: getAgent()
    }, handleResult('POST /deploy/export', 201,
        function (jsonBody) {
            const exportId = jsonBody.exportId;
            console.log('Received Export ID: ' + exportId);
            return exportId;
        }, // Body Transform
        done));
};

utils.postImport = function (deployUrl, inputFileName, done) {
    console.log('Posting import archive...');
    utils.sha256Hash(inputFileName, function (err, shaHash) {
        if (err) {
            console.error('Could not calculate SHA256 hash of file ' + inputFileName);
            return done(err);
        }
        request.post({
            url: deployUrl + 'import',
            headers: utils.makeHeaders({ 
                'Content-Type': 'application/octet-stream',
                'X-SHA256-Hash': shaHash
            }),
            agent: getAgent(),
            body: fs.createReadStream(inputFileName)
        }, handleResult('POST /deploy/import', 201,
            function (jsonBody) {
                console.log(jsonBody);
                const importId = jsonBody.importId;
                console.log('Received Import ID: ' + importId);
                return importId;
            },
            done));
    });
};

utils.awaitDone = function (deployUrl, operation, jobId, done) {
    console.log('Awaiting ' + operation + ' to finish...');
    // Aw man, fuck closures. This sort of hurts and feels good
    // at the same time. As a C/C++ developer, this totally fucks
    // with your head.
    const checkIsDone = function (tryCount) {
        if (tryCount > 50) {
            return done(new Error('While waiting for ' + operation + ' to finish, the try count exceeded 50.'));
        }

        request.get({
            url: deployUrl + operation + '/' + jobId + '/status',
            headers: utils.makeHeaders(),
            agent: getAgent()
        }, function (err, apiRes, apiBody) {
            if (err)
                return done(err);
            if (apiRes.statusCode > 299)
                return done(new Error('While getting status of ' + operation + ', an unexpected status was returned: ' + apiRes.statusCode));

            if (apiRes.statusCode == 200) {
                // Success!
                console.log('The ' + operation + ' is done.');
                return done(null, jobId);
            }

            console.log('The ' + operation + ' is not yet done, retrying in 2s...');
            // Try again
            setTimeout(checkIsDone, 2000, tryCount + 1);
        });
    };

    // Wait 500ms before trying the first time.
    setTimeout(checkIsDone, 500, 0);
};

utils.downloadArchive = function (deployUrl, exportId, outputFileName, done) {
    console.log('Downloading to ' + outputFileName);
    request.get({
        url: deployUrl + 'export/' + exportId + '/data',
        headers: utils.makeHeaders(),
        agent: getAgent()
    })
        .on('error', function (err) {
            console.error('Download failed.');
            console.error(err);
            done(err);
        })
        .pipe(fs.createWriteStream(outputFileName))
        .on('finish', function () {
            console.log('Download finished.');
            done(null, exportId);
        });
};

utils.cancelExport = function (deployUrl, exportId, done) {
    console.log('Resetting export status.');
    request.delete({
        url: deployUrl + 'export/' + exportId,
        headers: utils.makeHeaders(),
        agent: getAgent()
    }, handleResult('DELETE /export/' + exportId, 204,
        function (jsonBody) { return exportId; },
        done));
};

utils.parseCommandLine = function (argv) {
    const options = {};
    let lastWasOption = false;
    let lastOptionName = null;
    let hasUrl = false;
    let hasFile = false;
    for (let i = 2; i < argv.length; ++i) {
        const part = argv[i];
        if (part.startsWith('--')) {
            if (lastWasOption) {
                options[lastOptionName] = true;
            }
            lastWasOption = true;
            lastOptionName = part.substring(2);
        } else if (lastWasOption) {
            options[lastOptionName] = part;
            lastWasOption = false;
        } else if (!hasUrl) {
            options.url = part;
            hasUrl = true;
        } else if (!hasFile) {
            options.file = part;
            hasFile = true;
        } else {
            console.error('Ignoring command line parameter "' + part + '".');
        }
    }
    if (lastWasOption) {
        options[lastOptionName] = true;
    }
    return options;
};

utils.sha256Hash = function (fileName, callback) {
    var hash = crypto.createHash('sha256');
    var stream = fs.createReadStream(fileName);
    stream.on('data', function (data) {
        hash.update(data);
    });
    stream.on('end', function (data) {
        var hexHash = hash.digest('hex');
        callback(null, hexHash);
    });
};


module.exports = utils;