'use strict';

/* globals __dirname */

const path = require('path');
const fs = require('fs');
const url = require('url');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:apis');
const request = require('request');
const async = require('async');

const utils = require('./utils');
const swaggerUtils = require('./swagger-utils');
const users = require('./users');

const apis = require('express').Router();

const dao = require('../dao/dao');
const daoUtils = require('../dao/dao-utils');

// ===== SCOPES =====

const READ = 'read_apis';
const READ_SUBS = 'read_subscriptions';
const READ_PLANS = 'read_plans';

const verifyScope = utils.verifyScope(READ);
const verifyPlansScope = utils.verifyScope(READ_PLANS);
const verifyReadSubsScope = utils.verifyScope(READ_SUBS);

// ===== ENDPOINTS =====

apis.get('/', verifyScope, function (req, res, next) {
    apis.getApis(req.app, res, req.apiUserId); //utils.loadApis(app);
});

apis.get('/desc', verifyScope, function (req, res, next) {
    apis.getDesc(req.app, res);
});

apis.get('/:apiId', verifyScope, function (req, res, next) {
    apis.getApi(req.app, res, req.apiUserId, req.params.apiId);
});

apis.get('/:apiId/config', verifyScope, function (req, res, next) {
    apis.getConfig(req.app, res, req.apiUserId, req.params.apiId);
});

apis.get('/:apiId/desc', verifyScope, function (req, res, next) {
    apis.getApiDesc(req.app, res, req.apiUserId, req.params.apiId);
});

apis.get('/:apiId/plans', verifyScope, verifyPlansScope, function (req, res, next) {
    apis.getApiPlans(req.app, res, req.apiUserId, req.params.apiId);
});

apis.get('/:apiId/swagger', verifyScope, function (req, res, next) {
    apis.getSwagger(req.app, res, req.apiUserId, req.params.apiId);
});

// Requires both read_apis and read_subscriptions scopes.
apis.get('/:apiId/subscriptions', verifyScope, verifyReadSubsScope, function (req, res, next) {
    const { offset, limit } = utils.getOffsetLimit(req);
    apis.getSubscriptions(req.app, res, req.apiUserId, req.params.apiId, offset, limit);
});

// ===== IMPLEMENTATION =====

apis.getApis = function (app, res, loggedInUserId) {
    debug('getApis()');
    const apiList = utils.loadApis(app);

    // Set defaults
    let userGroups = [];
    let isAdmin = false;

    function injectAndReturn(anApiList) {
        checkAndInjectScopes(anApiList.apis, function (err) {
            if (err) {
                return utils.failError(res, err);
            }
            return res.json(anApiList);
        });
    }

    if (loggedInUserId) {
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (!userInfo) {
                return res.status(403).jsonp({ message: 'Not allowed. User unknown.' });
            }
            isAdmin = daoUtils.isUserAdmin(userInfo);
            if (!isAdmin) {
                userGroups = userInfo.groups;
            }
            return injectAndReturn(filterApiList(isAdmin, userGroups, apiList));
        });
    } else {
        return injectAndReturn(filterApiList(isAdmin, userGroups, apiList));
    }
};

function filterApiList(isAdmin, userGroups, apiList) {
    if (isAdmin) {
        return apiList;
    }

    const groupDict = {};
    for (let i = 0; i < userGroups.length; ++i) {
        groupDict[userGroups[i]] = true;
    }

    const filteredApiList = [];

    for (let i = 0; i < apiList.apis.length; ++i) {
        const api = apiList.apis[i];

        let addApi = false;
        if (!api.requiredGroup || api.partner) {
            addApi = true;
        } else if (groupDict[api.requiredGroup]) {
            addApi = true;
        }

        if (addApi) {
            filteredApiList.push(api);
        }
    }

    return { apis: filteredApiList };
}

apis.getDesc = function (app, res) {
    debug('getDesc()');
    const staticDir = utils.getStaticDir();
    const apisDir = path.join(staticDir, 'apis');
    const descFileName = path.join(apisDir, 'desc.md');

    if (!fs.existsSync(descFileName)) {
        return res.status(404).jsonp({ message: 'Not found.' });
    }
    fs.readFile(descFileName, 'utf8', function (err, content) {
        if (!err) {
            res.setHeader('Content-Type', 'text/markdown');
            res.send(content);
        }
    });
};

apis.isValidApi = function (app, apiId) {
    debug('isValidApi()');
    const apiList = utils.loadApis(app);
    let apiIndex = -1;
    for (let i = 0; i < apiList.apis.length; ++i) {
        if (apiList.apis[i].id == apiId) {
            apiIndex = i;
            break;
        }
    }
    return (apiIndex >= 0);
};

apis.checkAccess = function (app, res, userId, apiId, callback) {
    debug('checkAccess(), userId: ' + userId + ', apiId: ' + apiId);
    if (!callback || typeof (callback) !== 'function') {
        throw utils.makeError(500, 'checkAccess: callback is null or not a function');
    }
    const apiList = utils.loadApis(app);
    // Is it a valid API id?
    let apiIndex = -1;
    for (let i = 0; i < apiList.apis.length; ++i) {
        if (apiList.apis[i].id == apiId) {
            apiIndex = i;
            break;
        }
    }
    if (apiIndex < 0) {
        // Not, it's not.
        return callback(utils.makeError(404, 'Not found.'));
    }
    // Check for the user
    users.loadUser(app, userId, (err, userInfo) => {
        if (err) {
            return callback(err);
        }
        if (userId) {
            if (!userInfo) {
                return callback(utils.makeError(403, 'Not allowed. Invalid user.'));
            }
        }
        const selectedApi = apiList.apis[apiIndex];
        if (!selectedApi.requiredGroup || selectedApi.partner) {
            // Public or Partner
            return callback(null, true);
        }
        // If we didn't have a logged in user, we're out
        if (!userInfo) {
            return callback(utils.makeError(403, 'Not allowed. API is restricted.'));
        }

        for (let i = 0; i < userInfo.groups.length; ++i) {
            if (userInfo.groups[i] == selectedApi.requiredGroup) {
                return callback(null, true);
            }
        }

        // We're still here... Admin the last resort
        if (daoUtils.isUserAdmin(userInfo)) {
            return callback(null, true);
        }

        // Nope. Not allowed.
        return callback(utils.makeError(403, 'Not allowed. Insufficient rights.'));
    });
};

function assignScope(apiDef, scopes) {
    if (!apiDef.settings) {
        apiDef.settings = {};
    }
    apiDef.settings.scopes = scopes;
}

const _scopeMap = {};
function checkAndInjectScopes(apiList, callback) {
    debug(`checkAndInjectScopes()`);
    async.each(apiList, function (apiDef, callback) {
        // Do we need to look up a scope definition?
        if (!apiDef.scopeLookupUrl) {
            return callback(null);
        }

        const now = (new Date()).getTime();
        if (_scopeMap[apiDef.id]) {
            const cachedScopes = _scopeMap[apiDef.id];
            if (now - cachedScopes.timestamp < 5 * 60 * 1000) { // 5 minutes
                // Cache valid
                assignScope(apiDef, cachedScopes.scopes);
                return callback(null);
            }
        }
        let scopeUrl = apiDef.scopeLookupUrl;
        if (!scopeUrl.endsWith('/')) {
            scopeUrl += '/';
        }

        async.retry({ times: 10, interval: 1000 }, function (callback) {
            const url = `${scopeUrl}${apiDef.id}`;
            debug(`checkAndInjectScopes: Attempting to get scopes from ${url}`);
            request.get({
                url: url,
                timeout: 10000
            }, function (err, res, body) {
                if (err) {
                    return callback(err);
                }
                if (res.statusCode !== 200) {
                    return callback(new Error(`checkAndInjectScopes: GET ${url} return unexpected status code ${res.statusCode} (expected 200)`));
                }
                debug(`checkAndInjectScope: Succeeded gettings scopes from external URL.`);
                const jsonBody = utils.getJson(body);
                if (!apiDef.settings) {
                    apiDef.settings = {};
                }
                apiDef.settings.scopes = jsonBody;
                _scopeMap[apiDef.id] = {
                    timestamp: now,
                    scopes: jsonBody
                };
                return callback(null);
            });
        }, callback);
    }, callback);
}

apis.getApi = function (app, res, loggedInUserId, apiId) {
    debug('getApi(): ' + apiId);
    apis.checkAccess(app, res, loggedInUserId, apiId, (err) => {
        if (err) {
            return utils.fail(res, 403, 'Access denied', err);
        }
        const apiList = utils.loadApis(app);
        const apiIndex = apiList.apis.findIndex(a => a.id === apiId);
        const apiInfo = apiList.apis[apiIndex];
        checkAndInjectScopes([apiInfo], function (err) {
            if (err) {
                return utils.failError(res, err);
            }
            res.json(apiInfo);
        });
    });
};

apis.getApiPlans = function (app, res, loggedInUserId, apiId) {
    debug('getApiPlans(): ' + apiId);
    apis.checkAccess(app, res, loggedInUserId, apiId, (err) => {
        if (err) {
            return utils.fail(res, 403, 'Access denied', err);
        }
        const apiList = utils.loadApis(app);
        let apiIndex = apiList.apis.findIndex(a => a.id === apiId);
        if (apiIndex < 0) {
            return res.status(404).jsonp({ message: 'API not found:' + apiId });
        }
        const selectedApi = apiList.apis[apiIndex];
        const allPlans = utils.loadPlans(app);
        const planMap = {};
        for (let i = 0; i < allPlans.plans.length; ++i) {
            planMap[allPlans.plans[i].id] = allPlans.plans[i];
        }
        const apiPlans = [];
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'could not load user', err);
            }
            if (userInfo) {
                for (let i = 0; i < selectedApi.plans.length; ++i) {
                    const plan = planMap[selectedApi.plans[i]];
                    if (!plan.requiredGroup ||
                        (plan.requiredGroup && users.hasUserGroup(app, userInfo, plan.requiredGroup))) {
                        apiPlans.push(plan);
                    }
                }
                res.json(apiPlans);
            } else {
                // No plans when not logged in.
                res.json([]);
            }
        });
    });
};

function loadApiConfig(app, apiId) {
    debug('loadApiConfig()');
    const staticDir = utils.getStaticDir();
    let configFileName = path.join(staticDir, 'apis', apiId, 'config.json');
    // Default to empty but valid json.
    let configJson = {};
    if (fs.existsSync(configFileName)) {
        configJson = JSON.parse(fs.readFileSync(configFileName, 'utf8'));
    }
    else {
        // Check if it's an internal API
        configFileName = path.join(__dirname, 'internal_apis', apiId, 'config.json');
        if (fs.existsSync(configFileName)) {
            configJson = JSON.parse(fs.readFileSync(configFileName, 'utf8'));
        }
    }
    utils.replaceEnvVars(configJson);
    // Check upstream_url
    try {
        const url = new URL(configJson.api.upstream_url);
        configJson.api.upstream_url = url.toString();
    } catch (err) {
        error(`loadApiConfig(${apiId}): The api.upstream_url is not a valid URL: ${configJson.api.upstream_url}`);
    }
    return configJson;
}

apis.getConfig = function (app, res, loggedInUserId, apiId) {
    debug('getConfig(): ' + apiId);
    // Do we know this API?
    if (!apis.isValidApi(app, apiId)) {
        return utils.fail(res, 404, 'Not found: ' + apiId);
    }
    apis.checkAccess(app, res, loggedInUserId, apiId, (err) => {
        if (err) {
            return utils.fail(res, 403, 'Access denied', err);
        }
        const configJson = loadApiConfig(app, apiId);
        let configReturn = configJson;
        users.isUserIdAdmin(app, loggedInUserId, (err, isAdmin) => {
            // Restrict what we return in case it's a non-admin user,
            // only return the request path, not the backend URL.
            if (!isAdmin) {
                configReturn = {
                    api: {
                        uris: configJson.api.uris,
                        host: configJson.api.host,
                        protocol: url.parse(configJson.api.upstream_url).protocol
                    }
                };
            }
            res.json(configReturn);

        });
    });
};

apis.getApiDesc = function (app, res, loggedInUserId, apiId) {
    debug('getApiDesc(): ' + apiId);
    apis.checkAccess(app, res, loggedInUserId, apiId, (err) => {
        if (err) {
            return utils.fail(res, 403, 'Access denied', err);
        }
        const staticDir = utils.getStaticDir();
        let descFileName = path.join(staticDir, 'apis', apiId, 'desc.md');
        res.setHeader('Content-Type', 'text/markdown');
        // Even if there is no desc.md, default to empty 200 OK
        if (!fs.existsSync(descFileName)) {
            // Check internal APIs.
            descFileName = path.join(__dirname, 'internal_apis', apiId, 'desc.md');
            if (!fs.existsSync(descFileName)) {
                return res.send('');
            }
        }
        res.send(fs.readFileSync(descFileName, 'utf8'));
    });
};

// Looks like this:
// {
//     "<apiId>": {
//         "date": <date of read>,
//         "valid": true/false,
//         "swagger": <swagger JSON document>
//     }
// }
const _swaggerMap = {};
function resolveSwagger(globalSettings, apiInfo, apiConfig, requestPaths, fileName, callback) {
    debug('resolveSwagger(' + fileName + ')');
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (_swaggerMap[apiInfo.id]) {
        const apiData = _swaggerMap[apiInfo.id];
        if ((new Date()) - apiData.date < FIVE_MINUTES) {
            // We'll return the cached data
            if (apiData.valid) {
                return callback(null, apiData.swagger);
            }
            // Invalid cached data
            return callback(new Error('Invalid swagger data for API ' + apiInfo.id));
        }
        // We'll refresh the data, fall past
    }

    function injectAuthAndReturn(swaggerJson) {
        if (apiInfo.auth == "oauth2" && (!apiInfo.authMethods)) {
            return callback(new Error('API does not have an authMethods setting.'));
        }

        swaggerJson = (swaggerJson.openapi) ?
            swaggerUtils.injectOpenAPIAuth(swaggerJson, globalSettings, apiInfo, requestPaths, apiConfig) ://Open API 3.0
            swaggerUtils.injectSwaggerAuth(swaggerJson, globalSettings, apiInfo, requestPaths, apiConfig); //Version 2.0

        // Cache it for a while
        _swaggerMap[apiInfo.id] = {
            date: new Date(),
            valid: true,
            swagger: swaggerJson
        };

        return callback(null, swaggerJson);
    }

    try {
        const swaggerText = fs.readFileSync(fileName, 'utf8');
        const rawSwagger = JSON.parse(swaggerText);
        if (rawSwagger.swagger || rawSwagger.openapi) { // version, e.g. "2.0" or "3.0" for open api case
            return injectAuthAndReturn(rawSwagger);
        } else if (rawSwagger.href) {
            // We have a href property inside the Swagger, we will try to retrieve it
            // from an URL here.
            utils.replaceEnvVars(rawSwagger);
            // We must be able to just get this thing
            request.get({
                url: rawSwagger.href
            }, (err, apiRes, apiBody) => {
                if (err) {
                    return callback(err);
                }
                if (apiRes.statusCode !== 200) {
                    error(apiBody);
                    return callback(new Error(`Getting remote Swagger from ${rawSwagger.href} returned an unexpected status code: ${apiRes.statusCode}`));
                }
                try {
                    const rawSwaggerRemote = utils.getJson(apiBody);
                    return injectAuthAndReturn(rawSwaggerRemote);
                } catch (err) {
                    error(err);
                    return callback(new Error('Could not parse remote Swagger from ' + rawSwagger.href));
                }
            });
        } else {
            // Bad case.
            throw new Error('The swagger file does neither contain a "swagger" nor a "href" property: ' + fileName);
        }
    } catch (err) {
        // Cache failure for five minutes
        _swaggerMap[apiInfo.id] = {
            date: new Date(),
            valid: false
        };
        return callback(err);
    }
}

apis.getSwagger = function (app, res, loggedInUserId, apiId) {
    debug('getSwagger(): ' + apiId);
    // if (apiId == '_portal')
    //     return getPortalSwagger(app, res);
    apis.checkAccess(app, res, loggedInUserId, apiId, (err) => {
        if (err) {
            return utils.fail(res, 403, 'Access denied', err);
        }
        const staticDir = utils.getStaticDir();
        let swaggerFileName = path.join(staticDir, 'apis', apiId, 'swagger.json');
        if (!fs.existsSync(swaggerFileName)) {
            // Check internal APIs
            swaggerFileName = path.join(__dirname, 'internal_apis', apiId, 'swagger.json');
            if (!fs.existsSync(swaggerFileName)) {
                return res.status(404).jsonp({ message: 'Not found. This is a bad sign; the Swagger definition must be there!' });
            }
        }

        const globalSettings = utils.loadGlobals(app);
        const configJson = loadApiConfig(app, apiId);

        if (!configJson || !configJson.api || !configJson.api.uris || !configJson.api.uris.length) {
            return res.status(500).jsonp({ message: 'Invalid API configuration; does not contain uris array.' });
        }
        const requestPaths = configJson.api.uris;

        const apiList = utils.loadApis(app);
        const apiInfo = apiList.apis.find(function (anApi) { return anApi.id == apiId; });

        // Read it, we want to do stuff with it.
        // resolveSwagger might read directly from the swagger file, or, if the
        // swagger JSON contains a href property, get it from a remote location.
        resolveSwagger(globalSettings, apiInfo, configJson, requestPaths, swaggerFileName, (err, swaggerJson) => {
            if (err) {
                error(err);
                return res.status(500).json({
                    message: 'Could not resolve the Swagger JSON file, an error occurred.',
                    error: err
                });
            }
            return res.json(swaggerJson);
        });
    });
};

apis.getSubscriptions = function (app, res, loggedInUserId, apiId, offset, limit) {
    debug('getSubscriptions() ' + apiId);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getSubscriptions: Could not load user', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not Allowed. Only Admins can get subscriptions for an API.');
        }
        dao.subscriptions.getByApi(apiId, offset, limit, (err, apiSubs, countResult) => {
            if (err) {
                return utils.fail(res, 500, 'api.getSubscriptions: DAO failed to get subscriptions per API', err);
            }
            if (apiSubs) {
                return res.json({
                    items: apiSubs,
                    count: countResult.count,
                    count_cached: countResult.cached,
                    offset: offset,
                    limit: limit
                });
            }
            utils.fail(res, 404, 'Not Found.');
        });
    });
};

module.exports = apis;
