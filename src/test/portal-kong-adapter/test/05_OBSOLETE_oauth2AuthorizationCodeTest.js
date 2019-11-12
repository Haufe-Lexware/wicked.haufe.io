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

const oauth2Api = 'superduper';

const adapterQueue = 'kong-adapter';

function getAuthorizationCode(authenticated_userid, api_id, client_id, scope, auth_server, callback) {
    if (typeof (auth_server) === 'function' && !callback)
        callback = auth_server;
    else if (typeof (scope) === 'function' && !auth_server && !callback)
        callback = scope;
    const registerUrl = adapterUrl + 'oauth2/token/code';

    const correlationId = utils.createRandomId();
    console.log('getAuthorizationCode, correlation id=' + correlationId);

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
        // https://good.uri#code=239239827389729837298372983
        if (err)
            return callback(err);
        //assert.isNotOk(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/token/code did not return 200: ' + res.statusCode));
        const jsonBody = utils.getJson(body);
        //console.log('getAuthorizationCode(), jsonBody:');
        //console.log(jsonBody);
        if (!jsonBody.redirect_uri) {
            return callback(new Error('/oauth2/token/implicit did not return a redirect_uri'));
        }
        try {
            const redirectUriString = jsonBody.redirect_uri;
            const redirectUri = URL.parse(redirectUriString);
            const query = redirectUri.query;
            //console.log('query: ' + query);
            const queryParams = qs.parse(query);
            //console.log(queryParams);
            //console.log('Code: ' + queryParams.code);
            //console.log('callback: ' + callback);
            return callback(null, queryParams.code);
        } catch (ex) {
            console.error(ex);
            console.error(ex.stack);
            return callback(ex);
        }
    });
}

function getAccessToken(code, client_id, client_secret, api_id, callback) {
    const tokenUrl = gatewayUrl + api_id + '/oauth2/token';
    const headers = {
        'X-Forwarded-Proto': 'https'
    };
    const tokenRequest = {
        grant_type: 'authorization_code',
        code: code,
        client_id: client_id,
        client_secret: client_secret
    };
    request.post({
        url: tokenUrl,
        headers: headers,
        json: true,
        body: tokenRequest
    }, function (err, res, body) {
        if (err)
            return callback(err);
        //assert.isNotOk(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/token/code did not return 200: ' + res.statusCode));
        //console.log('getAccessToken(), body:');
        //console.log(body);
        const jsonBody = utils.getJson(body);
        //console.log(jsonBody);
        callback(null, jsonBody.access_token);
    });
}

describe('Using the Authorization Code grant,', function () {
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

    // This will be updated each time.
    let clientId = null;
    let clientSecret = null;
    let badClientId = null;

    beforeEach(function (done) {
        // Reset before each test
        clientId = null;
        // Add a subscription to play with
        utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
            assert.isNotOk(err);
            clientId = subsInfo.clientId;
            clientSecret = subsInfo.clientSecret;
            assert.isOk(clientId);
            utils.addSubscription(appId, devUserId, 'mobile', 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                badClientId = subsInfo.clientId;
                utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
            });
        });
    });

    afterEach(function (done) {
        async.parallel([
            function (callback) {
                if (clientId) {
                    utils.deleteSubscription(appId, devUserId, oauth2Api, function (err) {
                        assert.isNotOk(err);
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) {
                if (badClientId) {
                    utils.deleteSubscription(appId, devUserId, 'mobile', function (err) {
                        assert.isNotOk(err);
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            }
        ], function (err) {
            assert.isNotOk(err);
            utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
        });
    });

    it('must be possible to get an authorization code', function (done) {
        getAuthorizationCode('12345', oauth2Api, clientId, function (err, authCode) {
            assert.isNotOk(err, 'getAuthorizationCode failed');
            assert.isOk(authCode, 'no code received');
            done();
        });
    });

    it('must not be possible to get an authorization code for a non-auth-code grant API', function (done) {
        getAuthorizationCode('23456', 'mobile', clientId, function (err, accessToken) {
            assert.isOk(err, 'getting a authorization code must not work');
            done();
        });
    });

    it('must be possible to get an access token via authorization code code', function (done) {
        getAuthorizationCode('12345', oauth2Api, clientId, function (err, authCode) {
            assert.isNotOk(err);
            assert.isOk(authCode, 'no code received');
            getAccessToken(authCode, clientId, clientSecret, oauth2Api, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error');
                assert.isOk(accessToken, 'did not receive an access token');
                done();
            });
        });
    });
});
*/
