'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */


// These test cases do not apply to the Kong Adapter anymore, they
// need to be ported to a portal-auth test suite instead.

/*
var assert = require('chai').assert;
var request = require('request');
var async = require('async');
var http = require('http');
var URL = require('url');
var qs = require('querystring');
var utils = require('./testUtils');
var consts = require('./testConsts');

var adapterUrl = consts.KONG_ADAPTER_URL;
var kongUrl = consts.KONG_ADMIN_URL;
var gatewayUrl = consts.KONG_GATEWAY_URL;
var apiUrl = consts.BASE_URL;
var internalApiUrl = 'http://kong-adapter-test-data:3003/';
var INTERNAL_API_PORT = 3003;

var adminUserId = '1'; // See test-config/globals.json
var adminEmail = 'foo@bar.com';
var devUserId = '11'; // Fred Flintstone
var devEmail = 'fred@flintstone.com';

var oauth2Api = 'superduper';

var adapterQueue = 'kong-adapter';

function getAccessToken(authenticated_userid, api_id, client_id, scope, callback) {
    if (typeof (scope) === 'function' && !callback)
        callback = scope;
    var registerUrl = adapterUrl + 'oauth2/token/password';

    var correlationId = utils.createRandomId();
    console.log('getAccessToken, correlation id=' + correlationId);

    var reqBody = {
        authenticated_userid: authenticated_userid,
        api_id: api_id,
        client_id: client_id
    };
    if (scope)
        reqBody.scope = scope;

    request.post({
        url: registerUrl,
        json: true,
        body: reqBody,
        headers: {
            'Correlation-Id': correlationId
        }
    }, function (err, res, body) {
        // We expect something like this back:
        // {
        //   access_token: "ei5948t89457894759",
        //   token_type: "bearer",
        //   refresh_token: "8093480938403984038904",
        //   expires_in: 3600
        // }
        if (err)
            return callback(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/token/password did not return 200: ' + res.statusCode));
        var jsonBody = utils.getJson(body);
        if (!jsonBody.access_token)
            return callback(new Error('/oauth2/token/password did not return an access token'));
        if (!jsonBody.refresh_token)
            return callback(new Error('/oauth2/token/password did not return a refresh token'));
        if (!jsonBody.token_type)
            return callback(new Error('/oauth2/token/password did not return a token type'));
        callback(null, jsonBody);
    });
}

describe('With oauth2 password grant APIs,', function () {

    this.timeout(5000);

    var provisionKey = null;

    var badAppId = 'bad_app';
    var appId = 'good_app';

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
    var clientId = null;
    var badClientId = null;

    beforeEach(function (done) {
        // Reset before each test
        clientId = null;
        // Add a subscription to play with
        utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
            assert.isNotOk(err);
            clientId = subsInfo.clientId;
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
            done();
        });
    });

    it('must be possible to get an access token', function (done) {
        getAccessToken('12345', oauth2Api, clientId, null, function (err, accessToken) {
            assert.isNotOk(err);
            assert.isOk(accessToken, 'no access token structure received');
            assert.isOk(accessToken.access_token, 'no access token received');
            assert.isOk(accessToken.refresh_token, 'no refresh token received');
            done();
        });
    });

    it('must not be possible to get an access token for a non-password grant API', function (done) {
        getAccessToken('23456', 'mobile', badClientId, null, function (err, accessToken) {
            assert.isOk(err, 'getting an access token must not work');
            done();
        });
    });

    it('must be possible to retrieve the token via access token', function (done) {
        getAccessToken('34567', oauth2Api, clientId, null, function (err, accessToken) {
            assert.isNotOk(err);
            var access_token = accessToken.access_token;
            request.get({
                url: adapterUrl + 'oauth2/token?access_token=' + access_token
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.equal(accessToken.refresh_token, jsonBody.refresh_token, 'refresh tokens do not match');
                done();
            });
        });
    });

    it('must be possible to retrieve the token via refresh token', function (done) {
        getAccessToken('45678', oauth2Api, clientId, null, function (err, accessToken) {
            assert.isNotOk(err);
            var refresh_token = accessToken.refresh_token;
            request.get({
                url: adapterUrl + 'oauth2/token?refresh_token=' + refresh_token
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.equal(accessToken.access_token, jsonBody.access_token, 'access tokens do not match');
                done();
            });
        });
    });

    it('must be possible to refresh an access token', function (done) {
        getAccessToken('56789', oauth2Api, clientId, null, function (err, accessToken) {
            assert.isNotOk(err);
            var refresh_token = accessToken.refresh_token;
            request.post({
                url: adapterUrl + 'oauth2/token/refresh',
                json: true,
                body: {
                    refresh_token: refresh_token,
                    api_id: oauth2Api,
                    client_id: clientId
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.access_token, 'refreshed access token not returned.');
                assert.isOk(jsonBody.refresh_token, 'refreshed refresh token not returned.');
                done();
            });
        });
    });
});
*/