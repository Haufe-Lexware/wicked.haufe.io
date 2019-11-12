'use strict';

const express = require('express');
const qs = require('querystring');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('portal:apis');
const utils = require('./utils');
const marked = require('marked');
const markedOptions = utils.markedOptions;
const async = require('async');
const cors = require('cors');
const wicked = require('wicked-sdk');

router.get('/', function (req, res, next) {
    debug("get('/')");
    // Let's hit the API, and then render it.

    async.parallel({
        getApis: function (callback) {
            utils.getFromAsync(req, res, '/apis', 200, callback);
        },
        getDesc: function (callback) {
            utils.getFromAsync(req, res, '/apis/desc', 200, callback);
        }
    }, function (err, results) {
        if (err)
            return next(err);
        let apiList = results.getApis.apis;
        // Markdownify short descriptions.
        const apiTags = [];
        for (let i = 0; i < apiList.length; ++i) {
            if (apiList[i].desc)
                apiList[i].desc = marked(apiList[i].desc, markedOptions);
            if (apiList[i].tags && apiList[i].tags.length > 0) {
                for (let j = 0; j < apiList[i].tags.length; ++j) {
                    apiTags.push(apiList[i].tags[j]);
                }
            }
        }
        if (req.query && req.query.filter) {
            apiList = apiList.filter(function (api) {
                if (!api.tags)
                    return false;
                for (let i = 0; i < api.tags.length; i++) {
                    if (req.query[api.tags[i]]) {
                        return true;
                    }
                }
                return false;
            });
        }
        const desc = results.getDesc;
        if (!utils.acceptJson(req)) {
            res.render('apis',
                {
                    authUser: req.user,
                    params: req.query,
                    glob: req.app.portalGlobals,
                    route: '/apis',
                    title: 'APIs',
                    desc: marked(desc, markedOptions),
                    apilist: apiList,
                    apiTags: unique(apiTags)
                });
        } else {
            res.json(apiList);
        }
    });
});

function unique(arr) {
    const u = {}, a = [];
    for (let i = 0, l = arr.length; i < l; ++i) {
        if (!u.hasOwnProperty(arr[i])) {
            a.push(arr[i]);
            u[arr[i]] = 1;
        }
    }
    return a;
}

function deduceHostAndSchema(req, apiConfig) {
    const nw = req.app.portalGlobals.network;
    const host = (apiConfig.api.host) ?  apiConfig.api.host : nw.apiHost;
    const ssl = (nw.schema == 'https') ? true : false;
    let schema = nw.schema;
    switch (apiConfig.api.protocol) {
        case 'ws:':
        case 'wss:':
            schema = (ssl) ? 'wss' : 'ws';
    }
    return `${schema}://${host}`;
}

router.get('/:api', function (req, res, next) {
    debug("get('/:api')");

    // This is going to be more interesting, as we also want
    // to retrieve the applications of the user. But it'll work
    // out in the end. I found 'async' to do lists of REST calls
    // more or less in parallel. That looks nifty:
    //
    // https://github.com/caolan/async

    // We need to fetch the following things:

    // /apis/:api
    // /apis/:api/desc
    // /apis/:api/subscriptions (if user is admin)
    // /users/:userId
    // For all the user's applications:
    // /applications/:appId
    // /applications/:appId/subscriptions/:apiId
    // And possibly also the Auth Server of the API:
    // /auth-servers/:serverId

    const apiId = req.params.api;
    const loggedInUserId = utils.getLoggedInUserId(req);

    async.parallel({
        getApi: callback => utils.getFromAsync(req, res, '/apis/' + apiId, 200, callback),
        getApiDesc: callback => utils.getFromAsync(req, res, '/apis/' + apiId + '/desc', 200, callback),
        getSubscriptions: function (callback) {
            if (loggedInUserId && req.user && req.user.admin) // Don't try if we don't think the user is an admin
                utils.getFromAsync(req, res, '/apis/' + apiId + '/subscriptions', 200, callback);
            else
                callback(null, null);
        },
        getApiConfig: callback => utils.getFromAsync(req, res, '/apis/' + apiId + '/config', 200, callback),
        getUser: function (callback) {
            if (loggedInUserId)
                utils.getFromAsync(req, res, '/users/' + loggedInUserId, 200, callback);
            else {
                const nullUser = {
                    applications: []
                };
                callback(null, nullUser);
            }
        },
        getPlans: callback => utils.getFromAsync(req, res, '/apis/' + apiId + '/plans', 200, callback)
    }, function (err, results) {
        if (err)
            return next(err);
        const apiInfo = results.getApi;
        if (apiInfo.desc)
            apiInfo.desc = marked(apiInfo.desc, markedOptions);
        let apiDesc = results.getApiDesc;
        if (!apiDesc)
            apiDesc = '';
        const userInfo = results.getUser;
        const apiConfig = results.getApiConfig;

        let apiSubscriptions = null;
        if (results.getSubscriptions && results.getSubscriptions.items)
            apiSubscriptions = results.getSubscriptions.items;
        // TODO: This makes me a little unhappy, as this is Kong specific.
        // The "right" thing to do here would be to have the API, and more specific
        // even the Kong Adapter (or something) translate this into this Request URI.
        // Idea: Make this part of the generic configuration, as it would be a
        // necessary configuration option for any API gateway.
        // console.log(JSON.stringify(apiConfig));
        const apiUris = [];
        const host = deduceHostAndSchema(req, apiConfig);
        for (let u = 0; u < apiConfig.api.uris.length; ++u) {
            const apiRequestUri = apiConfig.api.uris[u];
            apiUris.push(`${host}${apiRequestUri}`);
        }

        const plans = results.getPlans;
        const plansMap = {};
        for (let i = 0; i < plans.length; ++i)
            plansMap[plans[i].id] = plans[i];

        const appIds = [];
        if (userInfo.applications) {
            for (let i = 0; i < userInfo.applications.length; ++i)
                appIds.push(userInfo.applications[i].id);
        }

        // Note: callback and results are used all the time, but in the end, all's
        // good, as the variable scopes are playing nice with us. Just watch out.
        async.parallel({
            getSubs: function (callback) {
                async.map(appIds, function (appId, callback) {
                    utils.get(req, '/applications/' + appId + '/subscriptions/' + apiId, function (err, apiResponse, apiBody) {
                        if (err)
                            return callback(err);
                        if (200 == apiResponse.statusCode) {
                            const jsonBody = utils.getJson(apiBody);
                            debug('Found subscriptions for application ' + appId + ' for API ' + apiId + ':');
                            debug(jsonBody);
                            return callback(null, jsonBody);
                        }
                        debug('No subscriptions found for application ' + appId + ' for API ' + apiId);
                        // We got a 404, most probably; let's return null for this
                        callback(null, null);
                    });
                }, function (err, results) {
                    if (err)
                        return callback(err);
                    debug('Results of getting subscriptions for API ' + apiId + ':');
                    debug(results);
                    callback(null, results);
                });
            },
            getApps: function (callback) {
                async.map(appIds, function (appId, callback) {
                    utils.getFromAsync(req, res, '/applications/' + appId, 200, callback);
                }, function (err, results) {
                    if (err)
                        return callback(err);
                    callback(null, results);
                });
            }
        }, function (err, results) {
            if (err)
                return next(err);

            debug('Results from querying apps, subscriptions and auth-server:');
            const appsResults = results.getApps;
            debug('appsResults:');
            debug(appsResults);
            const subsResults = results.getSubs;
            debug('subsResults:');
            debug(subsResults);

            let genericSwaggerUrl = `${utils.ensureNoSlash(wicked.getExternalPortalUrl())}/apis/${apiId}/swagger`;
            if (loggedInUserId)
                genericSwaggerUrl += `?forUser=${loggedInUserId}`;

            const apps = [];
            let hasSwaggerApplication = false;
            for (let i = 0; i < userInfo.applications.length; ++i) {
                const thisApp = userInfo.applications[i];
                thisApp.name = appsResults[i].name;
                if (appsResults[i]._links.addSubscription)
                    thisApp.maySubscribe = true;
                // Special case oauth2 with Authorization Code or Implicit Grant
                if (apiInfo.auth === 'oauth2' &&
                    apiInfo.settings &&
                    !apiInfo.settings.enable_client_credentials &&
                    !apiInfo.settings.enable_password_grant &&
                    !appsResults[i].redirectUri) {
                    thisApp.maySubscribe = false;
                    thisApp.subscribeError = 'App needs Redirect URI for this API';
                }
                if (apiInfo.deprecated) {
                    thisApp.maySubscribe = false;
                    thisApp.subscribeError = 'API deprecated';
                }
                // Swagger UI App must be detected even if it doesn't have a subscription to this API
                const thisRedirectUri = appsResults[i].redirectUri;
                if ((thisRedirectUri && thisRedirectUri.indexOf("swagger-ui/oauth2-redirect.html")) > 0)
                    hasSwaggerApplication = true;

                thisApp.hasSubscription = false;
                if (subsResults[i]) {
                    thisApp.hasSubscription = true;
                    thisApp.redirectUri = thisRedirectUri;
                    thisApp.plan = plansMap[subsResults[i].plan];
                    thisApp.apiKey = subsResults[i].apikey;
                    thisApp.clientId = subsResults[i].clientId;
                    thisApp.clientSecret = subsResults[i].clientSecret;
                    thisApp.mayUnsubscribe = false;
                    thisApp.maySubscribe = false;
                    thisApp.subscriptionApproved = subsResults[i].approved;
                    thisApp.subscriptionTrusted = subsResults[i].trusted;
                    if (subsResults[i]._links.deleteSubscription)
                        thisApp.mayUnsubscribe = true;
                    thisApp.swaggerLink = utils.ensureNoSlash(wicked.getExternalPortalUrl()) +
                        '/apis/' + apiId + '/swagger?forUser=' + loggedInUserId;
                    thisApp.swaggerLink = qs.escape(thisApp.swaggerLink);
                }
                apps.push(thisApp);
                debug(thisApp);
            }

            let authMethods = utils.loadAuthServersEndpoints(req.app, apiInfo);
            // Check for protected Auth Methods
            let hasProtectedMethods = false;
            if (!userInfo.admin) {
                const strippedMethods = [];
                for (let am of authMethods) {
                    if (!am.protected)
                        strippedMethods.push(am);
                    else
                        hasProtectedMethods = true;
                }
                authMethods = strippedMethods;
            }
            apiInfo.authMethods = authMethods;
            apiInfo.hasProtectedAuthMethods = hasProtectedMethods;
            apiInfo.hasSwaggerApplication = hasSwaggerApplication;
            // See also views/models/api.json for how this looks
            if (!utils.acceptJson(req)) {
                res.render('api', {
                    authUser: req.user,
                    glob: req.app.portalGlobals,
                    route: '/apis/' + apiId,
                    title: apiInfo.name,
                    apiInfo: apiInfo,
                    apiDesc: marked(apiDesc, markedOptions),
                    applications: apps,
                    apiPlans: plans,
                    apiUris: apiUris,
                    apiSubscriptions: apiSubscriptions,
                    genericSwaggerUrl: genericSwaggerUrl
                });
            } else {
                delete apiInfo.authMethods;
                res.json({
                    title: apiInfo.name,
                    apiInfo: apiInfo,
                    apiPlans: plans,
                    applications: apps,
                    apiUris: apiUris,
                    apiSubscriptions: apiSubscriptions
                });
            }
        });
    });
});// /apis/:apiId

// Dynamically allow CORS for this end point. Otherwise: No.
let corsOptions = null;
const corsOptionsDelegate = function (req, callback) {
    debug('corsOptionDelegate()');
    debug('Origin: ' + req.header('Origin'));
    if (!corsOptions) {
        corsOptions = {
            origin: utils.ensureNoSlash(wicked.getExternalApiUrl()),
            credentials: true
        };
    }
    debug(utils.getText(corsOptions));
    callback(null, corsOptions);
};

router.get('/:api/swagger', cors(corsOptionsDelegate), function (req, res, next) {
    debug("get('/:api/swagger')");
    const apiId = req.params.api;

    const apiCallback = function (err, swaggerJson) {
        if (err)
            return next(err);
        // Pipe it
        return res.json(swaggerJson);
    };

    // Let's call the API, it has all the data we need.
    const swaggerUri = '/apis/' + apiId + '/swagger';

    // Do we have a forUser query parameter?
    let forUser = req.query.forUser;
    if (!/^[a-z0-9]+$/.test(forUser)) {
        debug("get('/:api/swagger') - invalid forUser used: " + forUser);
        forUser = null;
    }
    if (forUser) {
        utils.getAsUser(req, swaggerUri, forUser, apiCallback);
    } else {
        utils.get(req, swaggerUri, function (err, apiResponse, apiBody) {
            if (err)
                return next(err);
            if (apiResponse.statusCode !== 200) {
                const err = new Error(`Could not retrieve Swagger JSON, unexpected status code ${apiResponse.statusCode}`);
                err.status = apiResponse.statusCode;
                return next(err);
            }
            try {
                const swaggerJson = utils.getJson(apiBody);
                return apiCallback(null, swaggerJson);
            } catch (ex) {
                error(ex);
                const err = new Error(`Swagger: Could not parse JSON body, error: ${ex.message}`);
                err.status = 500;
                return next(err);
            }
        });
    }
}); // /apis/:apiId/swagger

module.exports = router;
