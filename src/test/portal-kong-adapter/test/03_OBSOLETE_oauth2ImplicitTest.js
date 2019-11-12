'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

// These test cases do not apply to the Kong Adapter anymore, they
// need to be ported to a portal-auth test suite instead.

/*
const assert = require('chai').assert;
const request = require('request');
const async = require('async');
const http = require('http');
const URL = require('url');
const qs = require('querystring');
const utils = require('./testUtils');
const consts = require('./testConsts');
const enableDestroy = require('server-destroy');

const adapterUrl = consts.KONG_ADAPTER_URL;
const kongUrl = consts.KONG_ADMIN_URL;
const gatewayUrl = consts.KONG_GATEWAY_URL;
const apiUrl = consts.BASE_URL;
const internalApiUrl = 'http://kong-adapter-test-data:3003/';
const INTERNAL_API_PORT = 3003;

const adminUserId = '1'; // See test-config/globals.json
const adminEmail = 'foo@bar.com';
const devUserId = '11'; // Fred Flintstone
const devEmail = 'fred@flintstone.com';

const oauth2Api = 'mobile';

const adapterQueue = 'kong-adapter';

let __server = null;
let __reqHandler = null;

const WRITE_SUBS_SCOPE = 'write_subscriptions';

function hookServer(serverListening) {
    if (__server)
        throw new Error('server is already hooked, release it first!');
    __server = http.createServer(function (req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Sample response' }));

        if (__reqHandler) {
            __reqHandler(req);
        }
    });
    __server.listen(INTERNAL_API_PORT, serverListening);
    // https://github.com/isaacs/server-destroy
    enableDestroy(__server);
}

function useReqHandler(reqHandler) {
    __reqHandler = reqHandler;
}

function closeServer(callback) {
    if (__server) {
        __server.destroy(function () {
            __server = null;
            callback();
        });
    } else {
        callback(new Error('No server currently listening.'));
    }
}

function getAccessToken(authenticated_userid, api_id, client_id, scope, auth_server, callback) {
    if (typeof (auth_server) === 'function' && !callback)
        callback = auth_server;
    else if (typeof (scope) === 'function' && !auth_server && !callback)
        callback = scope;
    const registerUrl = adapterUrl + 'oauth2/token/implicit';

    const correlationId = utils.createRandomId();
    console.log('getAccessToken, correlation id=' + correlationId);

    const reqBody = {
        authenticated_userid: authenticated_userid,
        api_id: api_id,
        client_id: client_id
    };
    if (scope)
        reqBody.scope = scope;
    if (auth_server)
        reqBody.auth_server = auth_server;
    request.post({
        url: registerUrl,
        json: true,
        body: reqBody,
        headers: {
            'Correlation-Id': correlationId
        }
    }, function (err, res, body) {
        // We expect something like this back:
        // https://good.uri#access_token=239239827389729837298372983&expires_in=3600&token_type=bearer
        if (err)
            return callback(err);
        //assert.isNotOk(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/token/implicit did not return 200: ' + res.statusCode));
        //assert.equal(200, res.statusCode);
        const jsonBody = utils.getJson(body);
        //console.log('getAccessToken(), jsonBody:');
        //console.log(jsonBody);
        if (!jsonBody.redirect_uri)
            return callback(new Error('/oauth2/token/implicit did not return a redirect_uri'));
        try {
            const redirectUriString = jsonBody.redirect_uri;
            const redirectUri = URL.parse(redirectUriString);
            //assert.isOk(redirectUri.hash, 'redirect_uri must have a hash (fragment)');
            //assert.isOk(redirectUri.hash.startsWith('#'), 'redirect_uri has must start with #');
            const fragmentString = redirectUri.hash.substring(1); // Strip #
            const queryParams = qs.parse(fragmentString);
            //assert.isOk(queryParams.access_token, 'access_token must be present');
            //assert.isOk(queryParams.expires_in, 'expires_in must be present');
            //assert.isOk(queryParams.token_type, 'token_type must be present');
            //assert.equal('bearer', queryParams.token_type, 'token_type must be equal "bearer"');
            callback(null, queryParams.access_token);
        } catch (ex) {
            return callback(ex);
        }
    });
}

function revokeAccessToken(accessToken, authenticatedUserId, callback) {
    //console.log(`revokeAccessToken(${accessToken}, ${authenticatedUserId})`);
    let revokeUrl = adapterUrl + 'oauth2/token?';
    if (accessToken)
        revokeUrl += ('access_token=' + qs.escape(accessToken));
    else if (authenticatedUserId)
        revokeUrl += ('authenticated_userid=' + qs.escape(authenticatedUserId));
    else
        throw new Error('revokeAccessToken - either accessToken or authenticatedUserId must be non-null');

    const correlationId = utils.createRandomId();
    console.log(`revokeAccessToken ${revokeUrl}, correlation id=${correlationId}`);

    request.delete({
        url: revokeUrl,
        headers: {
            'Correlation-Id': correlationId
        }
    }, function (err, res, body) {
        if (err)
            return callback(err);
        // Give Kong some slack here
        setTimeout(callback, 250);
    });
}

describe('With oauth2 implicit grant APIs,', function () {

    this.timeout(5000);

    let provisionKey = null;

    const badAppId = 'bad_app';
    const appId = 'good_app';

    before(function (done) {
        async.series([
            callback => utils.createApplication(appId, { name: 'Good App', redirectUri: 'https://good.uri' }, devUserId, callback),
            callback => utils.createApplication(badAppId, { name: 'Bad App' }, devUserId, callback)
        ], function (err, results) {
            assert.isNotOk(err, 'creating applications failed.');
            utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
        });
    });

    after(function (done) {
        async.series([
            callback => utils.deleteApplication(appId, devUserId, callback),
            callback => utils.deleteApplication(badAppId, devUserId, callback)
        ], function (err, results) {
            assert.isNotOk(err, 'deleting applications failed.');
            utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
        });
    });

    it('the API must have an oauth2 plugin and a provision_key', function (done) {
        async.series({
            kongApi: callback => utils.kongGet('apis/' + oauth2Api, callback),
            kongPlugins: callback => utils.kongGet('apis/' + oauth2Api + '/plugins', callback)
        }, function (err, results) {
            assert.isNotOk(err, 'some action went wrong: ' + err);
            const plugins = results.kongPlugins.body;
            //console.log(JSON.stringify(plugins, null, 2));
            assert.equal(3, plugins.total, 'api needs three plugins (oauth2, acl and correlation-id)');
            const oauthPlugin = utils.findWithName(plugins.data, 'oauth2');
            assert.isOk(oauthPlugin, 'oauth2 plugin must be present');
            provisionKey = oauthPlugin.config.provision_key;
            //console.log(oauthPlugin);
            assert.isOk(provisionKey, 'must get a provision_key back');
            done();
        });
    });

    describe('with an application with redirect URI,', function (done) {

        // This will be updated each time.
        let clientId = null;

        beforeEach(function (done) {
            // Reset before each test
            clientId = null;
            // If we don't have this, we needn't start.
            assert.isOk(provisionKey, 'there is no provision_key; cannot perform tests.');
            // Add a subscription to play with
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                clientId = subsInfo.clientId;
                assert.isOk(clientId);
                utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
            });
        });

        afterEach(function (done) {
            if (clientId) {
                utils.deleteSubscription(appId, devUserId, oauth2Api, function (err) {
                    assert.isNotOk(err);
                    utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
                });
            } else {
                done();
            }
        });

        it('should be possible to get an access token', function (done) {
            const registerUrl = adapterUrl + 'oauth2/token/implicit';
            //console.log(registerUrl);
            request.post({
                url: registerUrl,
                json: true,
                body: {
                    authenticated_userid: '12345',
                    api_id: oauth2Api,
                    client_id: clientId
                },
                headers: { 'Correlation-Id': 'should be possible to get an access token' }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                //console.log(jsonBody);
                assert.isOk(jsonBody.redirect_uri);
                done();
            });
        });

        it('should not be possible to get an access token without subscription', function (done) {
            const registerUrl = adapterUrl + 'oauth2/token/implicit';
            //console.log(registerUrl);
            request.post({
                url: registerUrl,
                json: true,
                body: {
                    authenticated_userid: '12345',
                    api_id: oauth2Api,
                    client_id: 'invalidclientid'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                //console.log(res);
                //console.log(body);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should be possible to get an access token twice with the same user', function (done) {
            getAccessToken('12345', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                getAccessToken('12345', oauth2Api, clientId, function (err, accessToken) {
                    assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                    assert.isOk(accessToken);
                    done();
                });
            });
        });

        //it('should not be possible to get an access token for a client credentials API');
    });

    describe('with a bad application (without redirect URI)', function () {
        it('should not be possible to add a subscription', function (done) {
            request.post({
                url: apiUrl + 'applications/' + badAppId + '/subscriptions',
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: badAppId,
                    api: oauth2Api,
                    plan: 'basic',
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'Application does not have a redirectUri');
                done();
            });
        });
    });

    describe('when accessing the API,', function () {
        // We implement our own API backend here.
        before(function (done) {
            hookServer(done);
        });

        after(function (done) {
            console.log('after all when accessing the API');
            closeServer(done);
        });

        // This will be updated each time.
        let clientId = null;

        beforeEach(function (done) {
            // Reset before each test
            clientId = null;
            // If we don't have this, we needn't start.
            assert.isOk(provisionKey);
            // Add a subscription to play with
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                clientId = subsInfo.clientId;
                assert.isOk(clientId);

                utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
            });
        });

        afterEach(function (done) {
            // Remove reqHandler after each test
            __reqHandler = null;
            if (clientId) {
                utils.deleteSubscription(appId, devUserId, oauth2Api, function (err) {
                    assert.isNotOk(err);
                    utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
                });
            } else {
                done();
            }
        });

        it('should be possible to access the internal API', function (done) {
            request.get({
                url: internalApiUrl
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.message);
                done();
            });
        });

        it('should not be possible to access the API without an access token', function (done) {
            request.get({
                url: gatewayUrl + 'mobile/'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(401, res.statusCode, 'Kong must reject calls without token');
                done();
            });
        });

        it('it should be possible to access the API with an access token', function (done) {
            getAccessToken('123456', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });
        });

        it('should be possible to revoke a token by access token', function (done) {
            getAccessToken('abc123', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    revokeAccessToken(accessToken, null, function (err) {
                        assert.isNotOk(err, 'revokeAccessToken returned an error: ' + err);
                        request.get({
                            url: gatewayUrl + 'mobile/',
                            headers: { 'Authorization': 'Bearer ' + accessToken }
                        }, function (err, res, body) {
                            assert.isNotOk(err, 'request should be denied, but not fail: ' + err);
                            assert.equal(res.statusCode, 401, 'Unexpected return code after revoking access token: ' + res.statusCode);
                            done();
                        });
                    });
                });
            });
        });

        it('should be possible to revoke a token by authenticated_userid', function (done) {
            const userId = 'abcdefg';
            getAccessToken(userId, oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    revokeAccessToken(null, userId, function (err) {
                        assert.isNotOk(err, 'revokeAccessToken returned an error: ' + err);
                        request.get({
                            url: gatewayUrl + 'mobile/',
                            headers: { 'Authorization': 'Bearer ' + accessToken }
                        }, function (err, res, body) {
                            assert.isNotOk(err, 'request should be denied, but not fail: ' + err);
                            assert.equal(res.statusCode, 401, 'Unexpected return code after revoking access token: ' + res.statusCode);
                            done();
                        });
                    });
                });
            });
        });

        it('should be possible to revoke a token by authenticated_userid (complicated userid)', function (done) {
            const userId = 'huid:abcdefg-1279232;email:hello@world.de';
            getAccessToken(userId, oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    revokeAccessToken(null, userId, function (err) {
                        assert.isNotOk(err, 'revokeAccessToken returned an error: ' + err);
                        request.get({
                            url: gatewayUrl + 'mobile/',
                            headers: { 'Authorization': 'Bearer ' + accessToken }
                        }, function (err, res, body) {
                            assert.isNotOk(err, 'request should be denied, but not fail: ' + err);
                            assert.equal(res.statusCode, 401, 'Unexpected return code after revoking access token: ' + res.statusCode);
                            done();
                        });
                    });
                });
            });
        });

        it('Kong should pass in its standard OAuth2 headers', function (done) {
            getAccessToken('12346', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                //console.log('Access Token: ' + accessToken);
                // This is called from the embedded server, before the call returns
                let headers = null;
                useReqHandler(function (req) {
                    //console.log(req.headers);
                    headers = req.headers;
                });
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    assert.isOk(headers, 'headers must have been collected');
                    assert.isOk(headers['x-consumer-custom-id'], 'x-consumer-custom-id must be present');
                    assert.isOk(headers['x-consumer-username'], 'x-consumer-username must be present');
                    //assert.equal('test2@test.com$mobile', headers['x-consumer-username'], 'x-consumer-username must match');
                    assert.isOk(headers['x-authenticated-userid']);
                    assert.equal('12346', headers['x-authenticated-userid'], 'x-authenticated-userid must match');
                    assert.isOk(headers['correlation-id'], 'must have a correlation id');
                    done();
                });
            });
        });

        it('should not be possible to get a token if API is configured for other auth server', function (done) {
            getAccessToken('7287382', oauth2Api, clientId, null, 'meep-auth', function (err, accessToken) {
                assert.isOk(err, 'got access token when you shouldn\'t');
                done();
            });
        });

        it('should be possible to get a token if API is configured for correct auth server', function (done) {
            getAccessToken('7287382', oauth2Api, clientId, null, 'sample-server', function (err, accessToken) {
                assert.isNotOk(err, 'did not get access token');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });



        // it('Kong should return the desired additional headers', function (done) {
        //     getAccessToken('12347', oauth2Api, clientId, function (err, accessToken) {
        //         assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
        //         //console.log('Access Token: ' + accessToken);
        //         // This is called from the embedded server, before the call returns
        //         var headers = null;
        //         useReqHandler(function (req) {
        //             headers = req.headers;
        //         });
        //         request.get({
        //             url: gatewayUrl + 'mobile/',
        //             headers: { 'Authorization': 'Bearer ' + accessToken }
        //         }, function (err, res, body) {
        //             assert.isNotOk(err);
        //             assert.equal(200, res.statusCode);
        //             // 'X-Internal-Id': 'ABCDEF',
        //             // 'X-More-Headers': '123456'
        //             assert.isOk(headers, 'headers must have been collected');
        //             assert.isOk(headers['x-internal-id'], 'x-internal-id must be present');
        //             assert.equal(headers['x-internal-id'], 'ABCDEF', 'x-internal-id must match input');
        //             assert.isOk(headers['x-more-headers'], 'x-more-headers must be present');
        //             assert.equal(headers['x-more-headers'], '123456', 'x-more-headers must match input');
        //             done();
        //         });
        //     });
        // });

        // it('Kong should have been configured with correct plugins for consumer', function (done) {
        //     getAccessToken('test4@test.com', '12348', oauth2Api, clientId, function (err, accessToken) {
        //         assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
        //         assert.isOk(accessToken);
        //         // 1. get consumer id from kong for custom_id
        //         // 2. get plugins for this consumer and API
        //         // 3. check that they are correct (see also plans.json, this is what goes in there)
        //         async.waterfall([
        //             function (callback) {
        //                 request.get({
        //                     url: kongUrl + 'consumers?custom_id=12348'
        //                 }, function (err, res, body) {
        //                     assert.isNotOk(err);
        //                     assert.equal(200, res.statusCode);
        //                     var consumers = utils.getJson(body);
        //                     assert.equal(1, consumers.total);
        //                     var consumerId = consumers.data[0].id;
        //                     return callback(null, consumerId);
        //                 });
        //             },
        //             function (consumerId, callback) {
        //                 request.get({
        //                     url: kongUrl + 'apis/' + oauth2Api + '/plugins?consumer_id=' + consumerId
        //                 }, function (err, res, body) {
        //                     assert.isNotOk(err, 'getting consumer API plugins failed');
        //                     assert.equal(200, res.statusCode, 'status code was not 200');
        //                     var plugins = utils.getJson(body);
        //                     assert.isOk(plugins.data, 'plugin data was returned');
        //                     //assert.equal(2, plugins.total, 'plugin count for consumer has to be 2 (rate-limiting and request-transformer)');
        //                     return callback(null, plugins.data);
        //                 });
        //             }
        //         ], function (err, consumerPlugins) {
        //             assert.isNotOk(err); // This is somewhat superfluous
        //             // This was defined in plans.json for basic plan, which is what the clientId
        //             // subscription is for.    
        //             var rateLimit = utils.findWithName(consumerPlugins, 'rate-limiting');
        //             assert.isOk(rateLimit, 'rate-limiting plugin was not found');
        //             var reqTransformer = utils.findWithName(consumerPlugins, 'request-transformer');
        //             assert.isOk(reqTransformer, 'request-transformer plugin was not found');
        //             done();
        //         });
        //     });
        // });
    });

    describe('when dealing with scopes,', function () {
        // This will be updated each time.
        let mobileClientId = null;
        let partnerClientId = null;

        beforeEach(function (done) {
            // Reset before each test
            mobileClientId = null;
            partnerClientId = null;

            async.parallel({
                mobile: callback => utils.addSubscription(appId, devUserId, 'mobile', 'basic', null, function (err, subsInfo) {
                    //console.log(subsInfo);
                    assert.isNotOk(err);
                    const clientId = subsInfo.clientId;
                    assert.isOk(clientId);
                    callback(null, clientId);
                }),
                partner: callback => utils.addSubscription(appId, devUserId, 'partner', 'basic', null, function (err, subsInfo) {
                    //console.log(subsInfo);
                    assert.isNotOk(err);
                    const clientId = subsInfo.clientId;
                    assert.isOk(clientId);
                    callback(null, clientId);
                })
            }, function (err, results) {
                //console.log('addSubscription calls returned');
                assert.isNotOk(err);
                mobileClientId = results.mobile;
                partnerClientId = results.partner;
                assert.isOk(mobileClientId);
                assert.isOk(partnerClientId);

                utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
            });
        });

        afterEach(function (done) {
            async.parallel([
                function (callback) {
                    if (mobileClientId) {
                        utils.deleteSubscription(appId, devUserId, 'mobile', callback);
                    } else {
                        callback(null);
                    }
                },
                function (callback) {
                    if (partnerClientId) {
                        utils.deleteSubscription(appId, devUserId, 'partner', callback);
                    } else {
                        callback(null);
                    }
                }
            ], function (err, results) {
                assert.isNotOk(err);

                utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
            });
        });

        it('should be impossible to get a token without a scope (if defined so)', function (done) {
            getAccessToken('23456', 'partner', partnerClientId, null, function (err, accessToken) {
                assert.isOk(err, 'things did not go wrong getting an access token, wtf?');
                assert.isNotOk(accessToken, 'there should be no access token here');
                done();
            });
        });

        it('should be possible to get a token with a sub scope', function (done) {
            getAccessToken('34567', 'partner', partnerClientId, ['some_scope'], function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });

        it('should be possible to get a token without a scope (if defined so)', function (done) {
            getAccessToken('45678', 'mobile', mobileClientId, null, function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });

        it('should be possible to get a token with full scope as a string', function (done) {
            getAccessToken('56789', 'partner', partnerClientId, 'some_scope other_scope', function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });

        it('should be possible to get a token with scopes as a huge array (500 scopes)', function (done) {
            const manyScopes = [];
            for (let i = 0; i < 500; ++i)
                manyScopes.push('scope_' + i);
            getAccessToken('98765', 'mobile', mobileClientId, manyScopes, function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });

        it('should be possible to get a token with scopes as a huge array (1000 scopes)', function (done) {
            const manyScopes = [];
            for (let i = 0; i < 1000; ++i)
                manyScopes.push('scope_' + i);
            getAccessToken('98765', 'mobile', mobileClientId, manyScopes, function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });


        // Re-enable this when Bug is fixed
        // it('should be possible to get a token with scopes as a huge array (2500 scopes)', function (done) {
        //     const manyScopes = [];
        //     for (let i=0; i<2500; ++i)
        //         manyScopes.push('scope_' + i);
        //     getAccessToken('98765', 'mobile', mobileClientId, manyScopes, function (err, accessToken) {
        //         assert.isNotOk(err, 'an access token could not be retrieved');
        //         assert.isOk(accessToken, 'an access token could not be retrieved');
        //         done();
        //     });
        // });

        // it('should be possible to get a token with scopes as a huge array (5000 scopes)', function (done) {
        //     const manyScopes = [];
        //     for (let i=0; i<5000; ++i)
        //         manyScopes.push('scope_' + i);
        //     getAccessToken('98765', 'mobile', mobileClientId, manyScopes, function (err, accessToken) {
        //         assert.isNotOk(err, 'an access token could not be retrieved');
        //         assert.isOk(accessToken, 'an access token could not be retrieved');
        //         done();
        //     });
        // });
    });
});
*/
