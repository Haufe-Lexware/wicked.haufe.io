'use strict';

const request = require('request');
const qs = require('querystring');
const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal:utils');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mustache = require('mustache');
const wicked = require('wicked-sdk');

const utils = function () { };

utils.setOAuth2Credentials = function (clientId, clientSecret, callbackUrl) {
    utils.CLIENT_ID = clientId;
    utils.CLIENT_SECRET = clientSecret;
    utils.CALLBACK_URL = callbackUrl;
};

utils.createRandomId = function () {
    return crypto.randomBytes(20).toString('hex');
};

utils.clone = function (o) {
    return JSON.parse(JSON.stringify(o));
};

utils.fail = function (statusCode, message, internalErrorOrCallback, callback) {
    debug(`fail(${statusCode}, ${message})`);
    const err = new Error(message);
    err.status = statusCode;
    if (typeof (internalErrorOrCallback) === 'function')
        callback = internalErrorOrCallback;
    else
        err.internalError = internalErrorOrCallback;
    return callback(err);
};

utils.makeError = function (statusCode, message, internalError) {
    debug(`makeError(${statusCode}, ${message})`);
    const err = new Error(message);
    err.status = statusCode;
    if (internalError)
        err.internalError = internalError;
    return err;
};

utils.getLoggedInUserId = function (req) {
    //debug('getLoggedInUserId()');
    if (!req.user)
        return null;
    return req.user.sub;
};

utils.getLoggedInUserEmail = function (req) {
    //debug('getLoggedInUserEmail()');
    if (!req.user)
        return null;
    return req.user.email;
};

utils.getChecked = function (req, propName) {
    if (!req.body || !req.body[propName])
        return false;
    const propValue = req.body[propName];
    switch (propValue.toString().toLowerCase()) {
        case '1':
        case 'on':
        case 'true':
        case 'yes':
            return true;
    }
    return false;
};

utils.appendSlash = function (url) {
    if (url.endsWith('/'))
        return url;
    return url + '/';
};

utils.ensureNoSlash = function (url) {
    if (url.endsWith('/'))
        return url.substring(0, url.length - 1);
    return url;
};

utils.makePagingUri = function (req, uri, filterFields) {
    const startIndex = (req.query.pageIndex && req.query.pageSize) ? (req.query.pageIndex - 1) * req.query.pageSize : 0;
    uri = (uri && uri.indexOf('?') < 0) ? `${uri}?` : uri;
    uri = `${uri}offset=${startIndex}`;
    uri = (req.query.pageSize) ? `${uri}&limit=${qs.escape(req.query.pageSize)}` : uri;
    uri = (req.query.sortField) ? `${uri}&order_by=${qs.escape(req.query.sortField)}%20${qs.escape(req.query.sortOrder)}` : uri;
    uri = (startIndex == 0) ? `${uri}&no_cache=1` : uri;
    const filterParams = {};
    let hasFilter = false;
    for (let i = 0; i < filterFields.length; ++i) {
        const field = filterFields[i];
        if (req.query[field]) {
            filterParams[field] = req.query[field];
            hasFilter = true;
        }
    }
    return (hasFilter) ? `${uri}&filter=${qs.escape(utils.getText(filterParams))}` : uri;
};

function lookupAuthMethod(app, apiId, authMethodRef) {
    debug(`lookupAuthMethodConfig(${authMethodRef})`);
    const split = authMethodRef.split(':');
    if (split.length !== 2) {
        error(`lookupAuthMethodConfig: Invalid auth method "${authMethodRef}", expected "<auth server id>:<method id>"`);
        return null;
    }
    const authServerName = split[0];
    const authMethodName = split[1];

    const authServers = app.authServers;
    if (!authServers[authServerName]) {
        warn(`lookupAuthMethodConfig: Unknown auth server ${authServerName}`);
        return null;
    }
    const authServer = authServers[authServerName];

    const authMethodOrig = authServer.authMethods.find(am => am.name === authMethodName);
    if (!authMethodOrig) {
        warn(`lookupAuthMethodConfig: Unknown auth method name ${authMethodName} (${authMethodRef})`);
        return null;
    }

    if (!authMethodOrig.enabled) {
        warn(`lookupAuthMethodConfig: Auth method ${authMethodRef} is not enabled, skipping.`);
        return null;
    }

    const authMethod = utils.clone(authMethodOrig);
    const endpoints = [
        "authorizeEndpoint",
        "tokenEndpoint",
        "profileEndpoint"
    ];

    const apiUrl = utils.ensureNoSlash(wicked.getExternalApiUrl());
    // The loading of the authServers in 'www' ensures this is specified
    const hasPath = Array.isArray(authServer.config.api.routes) && Array.isArray(authServer.config.api.routes[0].paths);
    const authServerUrl = apiUrl + (hasPath ? authServer.config.api.routes[0].paths[0] : '/auth');

    for (let i = 0; i < endpoints.length; ++i) {
        const endpoint = endpoints[i];
        if (authMethod.config && authMethod.config[endpoint]) {
            authMethod.config[endpoint] = authServerUrl + mustache.render(authMethod.config[endpoint], { api: apiId, name: authMethodName });
        } else {
            warn(`Auth server ${authServer.name} does not have definition for endpoint ${endpoint}`);
        }
    }

    return authMethod;
}

utils.loadAuthServersEndpoints = function (app, apiInfo) {
    debug(`loadAuthServerEndpoints(${apiInfo.id})`);
    // Iterate over the Auth Methods which are configured for this API
    const apiAuthMethods = [];
    if (apiInfo.authMethods && apiInfo.authMethods.length > 0) {
        for (let i = 0; i < apiInfo.authMethods.length; ++i) {
            const authMethod = lookupAuthMethod(app, apiInfo.id, apiInfo.authMethods[i]);
            if (authMethod)
                apiAuthMethods.push(authMethod);
        }
    }
    return apiAuthMethods;
};


function makeHeaders(req, userId) {
    const headers = {
        'User-Agent': 'wicked.portal/' + utils.getVersion(),
        'X-Config-Hash': wicked.getConfigHash(),
        'Correlation-Id': req.correlationId,
    };
    return headers;
}

function hasPersonalToken(req) {
    return !!(req.session.user && req.session.user.authMethodId && req.session.user.token && req.session.user.token.access_token && req.session.user.token.refresh_token);
}

function getAccessToken(req, callback) {
    debug('getAccessToken()');
    if (hasPersonalToken(req))
        return getPersonalToken(req, callback);
    if (!req.session.user)
        return getAnonymousToken(req, callback);
}

function renewAccessToken(req, callback) {
    debug('renewAccessToken()');
    if (hasPersonalToken(req))
        return renewPersonalToken(req, callback);
    return renewAnonymousToken(req, callback);
}

function getPersonalToken(req, callback) {
    debug('getPersonalToken()');
    if (!hasPersonalToken(req))
        return getAccessToken(req, callback);
    if (_refreshingAccessToken[utils.getLoggedInUserId(req)])
        return setTimeout(getPersonalToken, 100, req, callback);
    return callback(null, req.session.user.token.access_token);
}

let _refreshingAccessToken = {};
function renewPersonalToken(req, callback) {
    debug('renewPersonalToken()');
    const userId = utils.getLoggedInUserId(req);
    if (_refreshingAccessToken[userId])
        return setTimeout(getPersonalToken, 100, req, callback);
    _refreshingAccessToken[userId] = true;
    refreshPersonalToken(req, function (err, tokenResponse) {
        delete _refreshingAccessToken[userId];
        if (!err && req.session && req.session.user && req.session.user.token) {
            req.session.user.token = tokenResponse;
            return callback(err, tokenResponse.access_token);
        } else {
            // Fallback to anonymous token
            return getAnonymousToken(req, callback);
        }
    });
}

function refreshPersonalToken(req, callback) {
    debug('refreshPersonalToken()');
    if (!hasPersonalToken(req))
        return getAccessToken(req, callback); // Falls back to anonymous token
    const authMethod = req.app.authConfig.authMethods.find(am => am.name === req.session.user.authMethodId);
    const authServerUrl = req.app.authConfig.internalAuthServerUrl;
    // We need the specific token URL for the selected auth method
    const tokenUrl = authServerUrl + authMethod.config.tokenEndpoint;
    debug('refreshPersonalToken() - using token URL: ' + tokenUrl);

    request.post({
        url: tokenUrl,
        json: true,
        body: {
            grant_type: 'refresh_token',
            client_id: utils.CLIENT_ID,
            client_secret: utils.CLIENT_SECRET,
            refresh_token: req.session.user.token.refresh_token
        }
    }, function (err, res, tokenResponse) {
        if (err) {
            error('ERROR: Could not refresh token for personal access');
            error(err);
            return callback(err);
        }

        debug(tokenResponse);
        if (!tokenResponse.access_token) {
            error('ERROR: Could not refresh access_token, logging out forcefully.');
            // We'll log ourselves out then
            utils.logoutUser(req, (err) => {
                // if (err)
                //     return callback(err);
                // return getAccessToken(req, callback);
                return callback(new Error('Could not refresh personal access_token'));
            });
        } else {
            debug('Successfully refreshed personal access token.');
            return callback(null, tokenResponse);
        }
    });
}

let _anonymousToken = null;
function getAnonymousToken(req, callback) {
    debug('getAnonymousToken()');
    if (_creatingAnonymousToken) {
        debug('getAnonymousToken: Somebody else is already creating a token.');
        return setTimeout(getAnonymousToken, 100, req, callback);
    }
    if (_anonymousToken)
        return callback(null, _anonymousToken);
    debug('no token available, needs to create a new token');
    return renewAnonymousToken(req, callback);
}

let _creatingAnonymousToken = false;
function renewAnonymousToken(req, callback) {
    debug('renewAnonymousToken()');
    if (_creatingAnonymousToken) {
        debug('renewAnonymousToken: Somebody else is already creating a token.');
        return setTimeout(getAnonymousToken, 100, req, callback);
    }
    _creatingAnonymousToken = true;
    // Reset the thing
    _anonymousToken = null;
    createAnonymousTokenInternal(req, function (err, accessToken) {
        _creatingAnonymousToken = false;
        if (!err) {
            _anonymousToken = accessToken;
        }
        return callback(err, accessToken);
    });
}

function createAnonymousTokenInternal(req, callback) {
    debug('createAnonymousTokenInternal()');
    if (!req.app.authConfig || !req.app.authConfig.internalAuthServerUrl || !req.app.authConfig.authMethods || req.app.authConfig.authMethods.length <= 0)
        callback(new Error('The global auth configuration is not valid, cannot talk to the portal-api.'));

    const authServerUrl = req.app.authConfig.internalAuthServerUrl;
    // Just pick any auth method, it doesn't matter which for the client credentials flow
    const authMethod = req.app.authConfig.authMethods[0];
    const tokenUrl = authServerUrl + authMethod.config.tokenEndpoint;
    debug('getAccessToken() - using token URL: ' + tokenUrl);

    request.post({
        url: tokenUrl,
        json: true,
        body: {
            grant_type: 'client_credentials',
            client_id: utils.CLIENT_ID,
            client_secret: utils.CLIENT_SECRET
        }
    }, function (err, res, body) {
        if (err) {
            error('ERROR: Could not get access token for anonymous access');
            error(err);
            return callback(err);
        }

        debug(body);
        if (!body.access_token) {
            error('ERROR: Did not receive expected access_token.');
            return callback(new Error('Did not receive anonymous access token.'));
        }
        debug('Successfully retrieved anonymous access token.');

        const accessToken = body.access_token;
        return callback(null, accessToken);
    });
}

function apiAction(req, method, body, callback, iteration) {
    debug('apiAction()');

    const payload = function (accessToken, callback) {
        debug(`payload() ${method} ${body.url}`);
        body.method = method;
        body.headers.Authorization = 'Bearer ' + accessToken;
        request(body, (err, apiResponse, apiBody) => {
            if (err) {
                return callback(err);
            }
            return callback(null, apiResponse, apiBody);
        });
    };

    async.retry({
        tries: 10,
        interval: 250
    }, function (callback) {
        getAccessToken(req, function (err, accessToken) {
            if (err)
                return callback(err);
            debug(`resolved access token: ${accessToken}`);
            payload(accessToken, function (err, apiResponse, apiBody) {
                if (err)
                    return callback(err);
                if (apiResponse.statusCode === 401) {
                    debug(apiBody);
                    renewAccessToken(req, function (err, accessToken) {
                        payload(accessToken, function (err, apiResponse, apiBody) {
                            if (err)
                                return callback(err);
                            return callback(null, apiResponse, apiBody);
                        });
                    });
                } else {
                    return callback(null, apiResponse, apiBody);
                }
            });
        });
    }, callback);
}

utils.get = function (req, uri, callback) {
    debug('get(): ' + uri);
    const baseUrl = req.app.get('api_url');

    apiAction(req, 'GET', {
        url: baseUrl + uri,
        headers: makeHeaders(req)
    }, callback);
};

utils.pipe = function (req, res, uri, isRetry) {
    debug('pipe()');
    const baseUrl = req.app.get('api_url');
    getAnonymousToken(req, (err, accessToken) => {
        const pipeReq = request({
            url: baseUrl + uri,
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Correlation-Id': req.correlationId
            }
        });
        pipeReq.on('response', function (response) {
            let pipeIt = true;
            if (!isRetry) {
                if (response.statusCode === 401) {
                    pipeIt = false;
                    renewAnonymousToken(req, function (err, accessToken) {
                        if (err)
                            return res.status(500).json({ message: 'Internal Server Error. Could not renew access token.' });
                        return utils.pipe(req, res, uri, true);
                    });
                }
            }
            if (pipeIt) {
                return pipeReq.pipe(res);
            } else {
                return pipeReq.abort();
            }
        });
    });
};

utils.getAsUser = function (req, uri, userId, callback) {
    debug('getAsUser(): ' + uri + ', userId = ' + userId);
    const baseUrl = req.app.get('api_url');

    wicked.apiGet(uri, userId, callback);
};

utils.handleError = function (res, apiResponse, apiBody, next) {
    debug('handleError()');
    // debug(apiResponse);
    debug('statusCode: ' + apiResponse.statusCode);
    debug(apiBody);
    let errorText = utils.getText(apiBody);
    try {
        const jsonBody = utils.getJson(apiBody);
        if (jsonBody.message)
            errorText = jsonBody.message;
    } catch (err) {
        debug('handleError failed while handling an error.');
        debug(err);
        // Ignore this, it was worth a try
    }

    const err = new Error(errorText);
    err.status = apiResponse.statusCode;
    return next(err);
};

// Use this function from within async constructions to shorten
// boiler plate code.
utils.getFromAsync = function (req, res, uri, expectedStatus, callback) {
    debug('getFromAsync(): ' + uri + ', expectedStatus = ' + expectedStatus);
    utils.get(req, uri, function (err, apiResponse, apiBody) {
        if (err)
            return callback(err);
        if (expectedStatus !== apiResponse.statusCode)
            return utils.handleError(res, apiResponse, apiBody, callback);
        const contentType = apiResponse.headers['content-type'];
        let returnValue = null;
        if (contentType.startsWith('text'))
            returnValue = utils.getText(apiBody);
        else
            returnValue = utils.getJson(apiBody);
        callback(null, returnValue);
    });
};

utils.post = function (req, uri, body, callback) {
    debug('post(): ' + uri);
    const baseUrl = req.app.get('api_url');
    const options = {
        url: baseUrl + uri,
        headers: makeHeaders(req)
    };
    if (body) {
        debug(body);
        options.body = body;
        options.json = true;
    }

    apiAction(req, 'POST', options, callback);
};

utils.patch = function (req, uri, body, callback) {
    debug('patch(): ' + uri);
    debug(body);
    const baseUrl = req.app.get('api_url');

    apiAction(req, 'PATCH', {
        url: baseUrl + uri,
        headers: makeHeaders(req),
        json: true,
        body: body
    }, callback);
};

utils.patchAsUser = function (req, uri, userId, body, callback) {
    debug('patchAsUser(): ' + uri + ', userId = ' + userId);
    debug(body);
    const baseUrl = req.app.get('api_url');

    apiAction(req, 'PATCH', {
        url: baseUrl + uri,
        headers: makeHeaders(req, userId),
        json: true,
        body: body
    }, callback);
};

utils.put = function (req, uri, body, callback) {
    debug('put(): ' + uri);
    debug(body);
    const baseUrl = req.app.get('api_url');

    apiAction(req, 'PUT', {
        url: baseUrl + uri,
        headers: makeHeaders(req),
        json: true,
        body: body
    }, callback);
};

utils.delete = function (req, uri, callback) {
    debug('delete(): ' + uri);
    const baseUrl = req.app.get('api_url');

    apiAction(req, 'DELETE', {
        url: baseUrl + uri,
        headers: makeHeaders(req)
    }, callback);
};

utils.logoutUser = function (req, callback) {
    debug('logoutUser()');
    if (req.session && req.session.user)
        delete req.session.user;
    return callback(null);
};

utils.getUtc = function () {
    return Math.floor((new Date()).getTime() / 1000);
};

utils.getJson = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return JSON.parse(ob);
    return ob;
};

utils.getText = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return ob;
    return JSON.stringify(ob, null, 2);
};

utils.acceptJson = function (req) {
    if (!req.headers || !req.headers.accept)
        return false;
    const headers = req.headers.accept.split(',');
    if (headers.find(function (h) { return h.toLowerCase().startsWith('application/json'); }))
        return true;
    return false;
};

utils._packageVersion = null;
utils.getVersion = function () {
    if (!utils._packageVersion) {
        const packageFile = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packageFile)) {
            try {
                const packageInfo = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (packageInfo.version)
                    utils._packageVersion = packageInfo.version;
            } catch (ex) {
                error(ex);
            }
        }
        if (!utils._packageVersion) // something went wrong
            utils._packageVersion = "0.0.0";
    }
    return utils._packageVersion;
};

utils._gitLastCommit = null;
utils.getGitLastCommit = function () {
    if (!utils._gitLastCommit) {
        const lastCommitFile = path.join(__dirname, '..', 'git_last_commit');
        if (fs.existsSync(lastCommitFile))
            utils._gitLastCommit = fs.readFileSync(lastCommitFile, 'utf8');
        else
            utils._gitLastCommit = '(no last git commit found - running locally?)';
    }
    return utils._gitLastCommit;
};

utils._gitBranch = null;
utils.getGitBranch = function () {
    if (!utils._gitBranch) {
        const gitBranchFile = path.join(__dirname, '..', 'git_branch');
        if (fs.existsSync(gitBranchFile))
            utils._gitBranch = fs.readFileSync(gitBranchFile, 'utf8');
        else
            utils._gitBranch = '(unknown)';
    }
    return utils._gitBranch;
};

utils._buildDate = null;
utils.getBuildDate = function () {
    if (!utils._buildDate) {
        const buildDateFile = path.join(__dirname, '..', 'build_date');
        if (fs.existsSync(buildDateFile))
            utils._buildDate = fs.readFileSync(buildDateFile, 'utf8');
        else
            utils._buildDate = '(unknown build date)';
    }
    return utils._buildDate;
};

// https://stackoverflow.com/questions/263965/how-can-i-convert-a-string-to-boolean-in-javascript
utils.parseBool = (str) => {
    debug(`parseBool(${str})`);
    if (str == null)
        return false;

    if (typeof (str) === 'boolean')
        return (str === true);

    if (typeof (str) === 'string') {
        if (str == "")
            return false;

        str = str.replace(/^\s+|\s+$/g, '');
        if (str.toLowerCase() == 'true' || str.toLowerCase() == 'yes')
            return true;

        str = str.replace(/,/g, '.');
        str = str.replace(/^\s*\-\s*/g, '-');
    }

    if (!isNaN(str))
        return (parseFloat(str) != 0);

    return false;
};

utils.dateFormat = (date, fstr, utc) => {
    utc = utc ? 'getUTC' : 'get';
    return fstr.replace(/%[YmdHMS]/g, function (m) {
        switch (m) {
            case '%Y': return date[utc + 'FullYear']();
            case '%m': m = 1 + date[utc + 'Month'](); break;
            case '%d': m = date[utc + 'Date'](); break;
            case '%H': m = date[utc + 'Hours'](); break;
            case '%M': m = date[utc + 'Minutes'](); break;
            case '%S': m = date[utc + 'Seconds'](); break;
            default: return m.slice(1);
        }
        return ('0' + m).slice(-2);
    });
};

utils.isEmptyGridFilter = (filter) => {
    let isEmpty = true;
    for (let key in filter) {
        if (filter[key] !== undefined) {
            for (let prop in filter[key]) {
                if (filter[key][prop] != '') {
                    isEmpty = false;
                    return false;
                }
            }
        }
    }
    return isEmpty;
};

utils.applyGridFilter = (filter, item) => {
    if (!filter || !item)
        return false;
    for (let prop in filter) {
        if (typeof filter[prop] === "object") { //look for nested
            if (utils.applyGridFilter(filter[prop], item[prop]))
                return true;
            continue;
        }
        const regexp = new RegExp(filter[prop], 'gi');
        if (filter[prop] && filter[prop].length > 0) {
            if (item[prop] && item[prop].match(regexp))
                return true;
        }
    }
    return false;
};

utils.sanitizeHtml = (s) => {
    if (!s)
        return '';
    return s.replace(/\&/g, '&amp;').replace(/\</g, '&lt;').replace(/\>/g, '&gt;').replace(/\"/g, '&quot;').replace(/\'/g, '&#x27;').replace(/\//g, '&#x2F;');
};

utils.markedOptions = { sanitize: true };

module.exports = utils;
