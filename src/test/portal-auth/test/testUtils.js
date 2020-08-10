'use strict';

const assert = require('chai').assert;
const crypto = require('crypto');
const request = require('request');
const qs = require('querystring');
const consts = require('./testConsts');
const wicked = require('wicked-sdk');
const async = require('async');

const utils = {};

// utils.SCOPES = {

// }

utils.createRandomId = function () {
    return crypto.randomBytes(5).toString('hex');
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

///

let _echoPlan;
function getEchoPlan(callback) {
    if (_echoPlan)
        return callback(null, _echoPlan);
    wicked.getApiPlans('echo', function (err, plans) {
        assert.isNotOk(err);
        assert.isOk(plans);
        assert.isArray(plans);
        _echoPlan = plans[0].id;
        return callback(null, _echoPlan);
    });
}

utils.createUsers = function (callback) {
    async.series({
        deleteUsers: callback => utils.destroyUsers(callback),
        normal: function (callback) {
            wicked.createUser({
                email: 'normal@user.com',
                password: 'normalwicked',
                validated: true,
                groups: ['dev']
            }, function (err, userInfo) {
                assert.isNotOk(err);
                userInfo.password = 'normalwicked';
                return callback(null, userInfo);
            });
        },
        admin: function (callback) {
            wicked.createUser({
                email: 'admin@user.com',
                password: 'adminwicked',
                validated: true,
                groups: ['admin']
            }, function (err, userInfo) {
                assert.isNotOk(err);
                userInfo.password = 'adminwicked';
                return callback(null, userInfo);
            });
        }
    }, function (err, results) {
        if (err)
            console.error(err);
        assert.isNotOk(err);
        return callback(null, results);
    });
};

utils.deleteUserByEmail = function (email, callback) {
    wicked.getUserByEmail(email, function (err, shortInfos) {
        if (err && err.status === 404)
            return callback(null);
        assert.isNotOk(err);
        if (shortInfos.length === 0)
            return callback(null);
        assert.equal(1, shortInfos.length);
        const shortInfo = shortInfos[0];
        wicked.deleteUser(shortInfo.id, callback);
    });
};

utils.destroyUsers = function (callback) {
    async.series([
        callback => utils.deleteUserByEmail('normal@user.com', callback),
        callback => utils.deleteUserByEmail('admin@user.com', callback)
    ], function (err) {
        if (err)
            console.error(err);
        assert.isNotOk();
        callback(null);
    });
};

function createAppSubscriptions(appId, echoPlan, trusted, redirectUris, callback) {
    async.parallel({
        echo: callback => wicked.createSubscription(appId, {
            api: 'echo',
            application: appId,
            auth: 'oauth2',
            plan: echoPlan,
            trusted: trusted
        }, callback),
        echo_woo: callback => wicked.createSubscription(appId, {
            api: 'echo-woo',
            application: appId,
            auth: 'oauth2',
            plan: 'basic',
            trusted: trusted
        }, callback),
        echo_woo_ns: callback => wicked.createSubscription(appId, {
            api: 'echo-woo-ns',
            application: appId,
            auth: 'oauth2',
            plan: 'basic',
            trusted: trusted
        }, callback),
        echo_client_credentials: callback => wicked.createSubscription(appId, {
            api: 'echo-client-credentials',
            application: appId,
            auth: 'oauth2',
            plan: 'basic',
            trusted: trusted
        }, callback)
    }, function (err, subs) {
        if (err)
            return callback(err);
        return callback(null, {
            echo: {
                clientId: subs.echo.clientId,
                clientSecret: subs.echo.clientSecret,
                redirectUris: redirectUris,
            },
            echo_woo: {
                clientId: subs.echo_woo.clientId,
                clientSecret: subs.echo_woo.clientSecret,
                redirectUris: redirectUris,
            },
            echo_woo_ns: {
                clientId: subs.echo_woo_ns.clientId,
                clientSecret: subs.echo_woo_ns.clientSecret,
                redirectUris: redirectUris,
            },
            echo_client_credentials: {
                clientId: subs.echo_client_credentials.clientId,
                clientSecret: subs.echo_client_credentials.clientSecret,
                redirectUris: redirectUris,
            }
        });
    });
}

function createTrustedApp(echoPlan, callback) {
    const appId = consts.APP_ID + '-trusted';
    const redirectUris = [consts.REDIRECT_URI, consts.REDIRECT_URI2];
    wicked.createApplication({
        id: appId,
        name: appId,
        confidential: true,
        clientType: 'confidential',
        redirectUris
    }, function (err, appInfo) {
        if (err)
            return callback(err);
        createAppSubscriptions(appId, echoPlan, true /*trusted*/, redirectUris, callback);
    });
}

function createConfidentialApp(echoPlan, callback) {
    const appId = consts.APP_ID + '-confidential';
    const redirectUris = [consts.REDIRECT_URI, consts.REDIRECT_URI2];
    wicked.createApplication({
        id: appId,
        name: appId,
        confidential: true,
        clientType: 'confidential',
        redirectUris
    }, function (err, appInfo) {
        if (err)
            return callback(err);
        createAppSubscriptions(appId, echoPlan, false /*trusted*/, redirectUris, callback);
    });
}

function createPublicApp(echoPlan, callback) {
    const appId = consts.APP_ID + '-public';
    const redirectUris = [consts.REDIRECT_URI, consts.REDIRECT_URI2];
    wicked.createApplication({
        id: appId,
        name: appId,
        confidential: false,
        clientType: 'public_spa',
        redirectUris
    }, function (err, appInfo) {
        if (err)
            return callback(err);
        createAppSubscriptions(appId, echoPlan, true /*trusted*/, redirectUris, callback);
    });
}

function createNativeApp(echoPlan, callback) {
    const appId = consts.APP_ID + '-native';
    const redirectUris = [consts.REDIRECT_URI, consts.REDIRECT_URI2];
    wicked.createApplication({
        id: appId,
        name: appId,
        confidential: false,
        clientType: 'public_native',
        redirectUris
    }, function (err, appInfo) {
        if (err)
            return callback(err);
        createAppSubscriptions(appId, echoPlan, true /*trusted*/, redirectUris, callback);
    });
}

function createWithoutUriApp(echoPlan, callback) {
    const appId = consts.APP_ID + '-withouturi';
    wicked.createApplication({
        id: appId,
        name: appId,
        confidential: true
    }, function (err, appInfo) {
        if (err)
            return callback(err);
        createAppSubscriptions(appId, echoPlan, false /*trusted*/, null, callback);
    });
}

utils.initAppsAndSubscriptions = function (callback) {
    let now = new Date().getTime();
    utils.destroyAppsAndSubcriptions(function (err) {
        console.log('Destroying previous apps: ' + (new Date().getTime() - now) + 'ms.');
        now = new Date().getTime();
        getEchoPlan(function (err, echoPlan) {
            async.series({
                users: callback => utils.createUsers(callback),
                trusted: callback => createTrustedApp(echoPlan, callback),
                confidential: callback => createConfidentialApp(echoPlan, callback),
                public: callback => createPublicApp(echoPlan, callback),
                native: callback => createNativeApp(echoPlan, callback),
                withoutUri: callback => createWithoutUriApp(echoPlan, callback),
                awaitQueue: callback => utils.awaitEmptyAdapterQueue(callback)
            }, function (err, results) {
                console.log('Creating and propagating new apps: ' + (new Date().getTime() - now) + 'ms.');
                if (err)
                    console.error(err);
                assert.isNotOk(err);

                delete results.awaitQueue;
                return callback(null, results);
            });
        });
    });
};

function deleteApplication(appId, callback) {
    wicked.getApplication(appId, function (err, appInfo) {
        if (err && err.statusCode !== 404)
            return callback(err);
        if (err && err.statusCode === 404)
            return callback(null);
        // console.log('DELETE ' + appId);
        wicked.deleteApplication(appId, callback);
    });
}

utils.destroyAppsAndSubcriptions = function (done) {
    async.series([
        callback => deleteApplication(consts.APP_ID + '-trusted', callback),
        callback => deleteApplication(consts.APP_ID + '-confidential', callback),
        callback => deleteApplication(consts.APP_ID + '-public', callback),
        callback => deleteApplication(consts.APP_ID + '-native', callback),
        callback => deleteApplication(consts.APP_ID + '-withouturi', callback),
        callback => utils.destroyUsers(callback),
        callback => utils.awaitEmptyAdapterQueue(callback)
    ], function (err) {
        assert.isNotOk(err);
        return done();
    });
};

utils.ensureNoSlash = function (s) {
    if (s.endsWith('/'))
        return s.substring(0, s.length - 1);
    return s;
};

utils.ensureSlash = function (s) {
    if (!s.endsWith('/'))
        return s + '/';
    return s;
};

let _authServerUrl;
utils.getAuthServerUrl = function (callback) {
    if (_authServerUrl)
        return callback(null, _authServerUrl);
    wicked.getAuthServer('default', function (err, as) {
        if (err)
            return callback(err);
        const apiUrl = utils.ensureNoSlash(wicked.getExternalApiUrl());
        const authPath = as.config.api.routes[0].paths[0];
        _authServerUrl = utils.ensureSlash(apiUrl + authPath);
        console.log('Using Auth Server URL: ' + _authServerUrl);
        return callback(null, _authServerUrl);
    });
};


utils.authGet = function (urlPath, cookieJar, callback) {
    assert.notEqual(urlPath[0], '/', 'Do not prepend the url path with a /');
    if (typeof cookieJar === 'function' && !callback)
        callback = cookieJar;
    const corrId = utils.createRandomId();
    if (process.env.OUTPUT_CORRELATION_IDS)
        console.log(`GET ${urlPath}: Correlation-Id ${corrId}`);
    utils.getAuthServerUrl(function (err, authUrl) {
        assert.isNotOk(err);
        request.get({
            url: authUrl + urlPath,
            headers: {
                'Accept': 'application/json',
                'Correlation-Id': corrId
            },
            jar: cookieJar,
            followRedirect: false
        }, function (err, res, body) {
            assert.isNotOk(err);
            const contentType = res.headers["content-type"];
            if (contentType && contentType.indexOf('application/json') >= 0)
                return callback(null, res, utils.getJson(body));
            return callback(null, res, body);
        });
    });
};

utils.authPost = function (urlPath, body, cookieJar, callback) {
    if (typeof cookieJar === 'function' && !callback)
        callback = cookieJar;
    assert.notEqual(urlPath[0], '/', 'Do not prepend the url path with a /');
    const corrId = utils.createRandomId();
    if (process.env.OUTPUT_CORRELATION_IDS)
        console.log(`POST ${urlPath}: Correlation-Id ${corrId}`);
    utils.getAuthServerUrl(function (err, authUrl) {
        assert.isNotOk(err);
        request.post({
            url: authUrl + urlPath,
            headers: {
                'Accept': 'application/json',
                'Correlation-Id': corrId
            },
            jar: cookieJar,
            json: true,
            body: body
        }, function (err, res, body) {
            assert.isNotOk(err);
            const contentType = res.headers["content-type"];
            if (contentType && contentType.indexOf('application/json') >= 0)
                return callback(null, res, utils.getJson(body));
            return callback(null, res, body);
        });
    });
};

utils.assertIsHtml = function (body) {
    assert.isTrue(body.would_be_html);
};

utils.assertIsNotHtml = function (body) {
    assert.isFalse(body.would_be_html);
};

utils.awaitEmptyAdapterQueue = function (callback) {
    const maxCount = 80;
    const timeOut = 400;
    const _awaitEmptyQueue = function (tryCount) {
        if (tryCount >= maxCount)
            return callback(new Error('awaitEmptyQueue: Max count of ' + maxCount + ' was reached: ' + tryCount));
        wicked.getWebhookEvents('kong-adapter', function (err, events) {
            assert.isNotOk(err);
            if (events.length === 0) {
                if (tryCount > 7)
                    console.log('INFO: awaitEmptyQueue needed ' + tryCount + ' tries.');
                return callback(null);
            }
            setTimeout(_awaitEmptyQueue, timeOut, tryCount + 1);
        });
    };

    // Let the queue build up first before hammering the API.
    setTimeout(_awaitEmptyQueue, 250, 1);
};

utils.getAuthCodeUrl = function (apiId, client, options) {
    let scope = options.scope;
    let code_challenge = options.code_challenge;
    let code_challenge_method;
    let prompt = options.prompt;
    if (code_challenge) {
        if (!options.code_challenge_method)
            code_challenge_method = 'plain';
        else
            code_challenge_method = options.code_challenge_method;
        if (code_challenge_method === 'S256') {
            const h = crypto.createHash('sha256');
            h.update(code_challenge);
            code_challenge = h.digest('base64');
        }
    }
    let redirectUri = client.redirectUris[0];
    if (options.redirect_uri) {
        redirectUri = options.redirect_uri;
    }
    let url = `local/api/${apiId}/authorize?response_type=code&client_id=${client.clientId}&redirect_uri=${redirectUri}`;
    if (scope) {
        const scopeString = scope.join(' ');
        url += `&scope=${qs.escape(scopeString)}`;
    }
    if (code_challenge) {
        url += `&code_challenge=${qs.escape(code_challenge)}&code_challenge_method=${code_challenge_method}`;
    }
    if (prompt) {
        url += `&prompt=${prompt}`;
    }
    return url;
};

utils.assertIsCodeRedirect = function (res, options, callback) {
    if (typeof (options) === 'function') {
        callback = options;
        options = null;
    }
    assert.equal(302, res.statusCode);
    const redir = res.headers.location;
    assert.isOk(redir);
    // console.log(redir);
    if (options && options.redirect_uri) {
        // console.log('Custom redirect_uri: ' + options.redirect_uri);
        assert.isTrue(redir.startsWith(options.redirect_uri), `redirect_uri does not start with ${options.redirect_uri} (${redir})`);
    } else {
        // console.log('Assuming standard redirect_uri');
        assert.isTrue(redir.startsWith(consts.REDIRECT_URI), `redirect_uri does not start with ${consts.REDIRECT_URI} (${redir})`);
    }
    const redirUrl = new URL(redir);
    const code = redirUrl.searchParams.get('code');
    const error = redirUrl.searchParams.get('error');
    if (code) {
        return callback(null, code);
    }
    const err = new Error(error);
    err.error_description = redirUrl.searchParams.get('error_description');
    return callback(err);
};

utils.getAuthCode = function (cookieJar, apiId, client, user, options, callback) {
    let url = utils.getAuthCodeUrl(apiId, client, options);
    if (options.prompt != 'none') {
        utils.authGet(url, cookieJar, function (err, res, body) {
            const csrfToken = body.csrfToken;
            assert.equal(res.statusCode, 200);
            assert.isOk(csrfToken);
            utils.authPost(body.loginUrl, {
                _csrf: csrfToken,
                username: user.email,
                password: user.password
            }, cookieJar, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertIsCodeRedirect(res, options, callback);
            });
        });
    } else {
        utils.authGet(url, cookieJar, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertIsCodeRedirect(res, options, callback);
        });
    }
};

utils.getAuthCodeToken = function (cookieJar, apiId, client, user, options, callback) {
    utils.getAuthCode(cookieJar, apiId, client, user, options, function (err, code) {
        assert.isNotOk(err);
        assert.isOk(code);
        utils.authPost(`local/api/${apiId}/token`, {
            grant_type: 'authorization_code',
            client_id: client.clientId,
            client_secret: client.clientSecret,
            code: code
        }, function (err, res, accessToken) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            assert.isOk(accessToken);
            assert.isObject(accessToken);
            assert.isOk(accessToken.access_token);
            assert.isOk(accessToken.refresh_token);
            assert.equal('bearer', accessToken.token_type);
            callback(null, accessToken);
        });
    });
};

const _apiUrlMap = {};
function getApiUrl(apiId, callback) {
    if (_apiUrlMap[apiId])
        return callback(null, _apiUrlMap[apiId]);
    wicked.getApiConfig(apiId, function (err, apiConfig) {
        assert.isNotOk(err);
        assert.isOk(apiConfig.api);
        assert.isOk(apiConfig.api.routes);
        assert.isArray(apiConfig.api.routes);
        assert.equal(apiConfig.api.routes.length, 1);
        assert.isArray(apiConfig.api.routes[0].paths);
        const path = apiConfig.api.routes[0].paths[0];
        const url = utils.ensureSlash(utils.ensureNoSlash(wicked.getExternalApiUrl()) + path);
        _apiUrlMap[apiId] = url;
        return callback(null, url);
    });
}

utils.callApi = function (apiId, accessToken, method, url, body, callback) {
    getApiUrl(apiId, function (err, apiUrl) {
        assert.isNotOk(err);
        const requestBody = {
            url: apiUrl + url,
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        if (requestBody) {
            requestBody.json = true;
            requestBody.body = body;
        }
        request(requestBody, function (err, res, body) {
            const contentType = res.headers["content-type"];
            if (contentType && contentType.indexOf('application/json') >= 0)
                return callback(null, res, utils.getJson(body));
            return callback(null, res, body);
        });
    });
};

utils.assertIsRedirectError = function (res, expectedError) {
    assert.isOk(res.headers.location);
    const redirUrl = new URL(res.headers.location);
    assert.isOk(redirUrl.searchParams);
    assert.equal(redirUrl.searchParams.get('error'), expectedError);
};

utils.getPasswordToken = function (apiId, client, clientIsPublic, user, callback) {
    const body = {
        grant_type: 'password',
        client_id: client.clientId,
        username: user.email,
        password: user.password
    };
    if (!clientIsPublic)
        body.client_secret = client.clientSecret;
    utils.authPost(`local/api/${apiId}/token`, body, function (err, res, body) {
        assert.isNotOk(err);
        assert.equal(res.statusCode, 200);
        assert.isOk(body.access_token);
        assert.isOk(body.refresh_token);
        assert.equal(body.token_type, 'bearer');
        callback(null, body);
    });
};

utils.getRegistrationForm = function (cookieJar, apiId, client, user, callback) {
    const url = utils.getAuthCodeUrl(apiId, client, {});
    utils.authGet(url, cookieJar, function (err, res, body) {
        utils.assertIsHtml(body);
        const csrfToken = body.csrfToken;
        assert.equal('login', body.template);
        assert.isOk(csrfToken);
        utils.authPost(body.loginUrl, {
            _csrf: csrfToken,
            username: user.email,
            password: user.password
        }, cookieJar, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertIsHtml(body);
            assert.equal(res.statusCode, 200);
            assert.equal(body.template, 'register');
            callback(null, res, body);
        });
    });
};

utils.assertUserRegistration = function (poolId, userId, callback) {
    wicked.getUserRegistrations(poolId, userId, function (err, regs) {
        assert.isNotOk(err);
        assert.equal(regs.items.length, 1);
        assert.equal(regs.items[0].poolId, poolId);
        assert.equal(regs.items[0].userId, userId);
        callback(null);
    });
};

utils.assertAccessTokensMatch = function (token1, token2) {
    for (let k in token1) {
        if (k === 'access_token' || k === 'expires' || k === 'refresh_token' || k === 'expires_refresh' || k === 'changedDate') {
            // These have to exist, but not be equal
            assert.isOk(token2[k]);
        } else {
            // The rest actually has to be equal
            assert.isDefined(token2[k], `key ${k} on access token is not defined`);
            if (k !== 'profile')
                assert.equal(token1[k], token2[k]);
            else
                assert.deepEqual(token1[k], token2[k]);
        }
    }
};

module.exports = utils;
