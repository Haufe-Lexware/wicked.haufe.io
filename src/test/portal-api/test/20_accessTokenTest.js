'use strict';

const assert = require('chai').assert;
const async = require('async');
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;
const ACCESS_TOKEN_SCOPE = 'access_tokens';
const ONE_HOUR = 60 * 60 * 1000;

if (!utils.isPostgres()) {
    console.log('NOT POSTGRES TESTS: Access token tests are skipped.');
    return;
}

const baseToken = {
    client_id: 'acbacbacbacbabcbacbabcbacbac',
    expires_in: 1800,
    api_id: 'superduper',
    plan_id: 'basic',
    application_id: 'some-application',
    profile: {
        sub: 'someid',
        first_name: 'Herbert',
        last_name: 'Feuerstein'
    },
    auth_method: 'default:local',
    grant_type: 'authorization_code',
    token_type: 'bearer',
};

describe('/accesstokens', function () {

    this.timeout(5000);

    let devUserId = '';
    let adminUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                done();
            });
        });
    });

    // And delete them afterwards    
    after(function (done) {
        utils.deleteUser(adminUserId, function () {
            utils.deleteUser(devUserId, function () {
                done();
            });
        });
    });

    describe('POST', function () {
        it('should reject calls without the correct scope', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, 'wrong_scope'),
                json: true,
                body: { ...baseToken,
                    access_token: 'token1',
                    expires: (Date.now() + ONE_HOUR),
                    authenticated_userid: 'sub=someid',
                    scope: ''
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should not be possible to add an access as non-admin', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(devUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token2',
                    expires: (Date.now() + ONE_HOUR),
                    authenticated_userid: 'sub=someid',
                    scope: ''
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should be possible to add an access token (admin)', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token3',
                    expires: (Date.now() + ONE_HOUR),
                    scope: 'some_scope hello_world'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 201);
                done();
            });
        });

        it('should not be possible to add an access token without the base properties', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: {
                    access_token: 'token3',
                    expires: (Date.now() + ONE_HOUR),
                    scope: 'some_scope hello_world'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should reject payloads not having an access token', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    expires: (Date.now() + ONE_HOUR),
                    authenticated_userid: 'sub=someid',
                    scope: ''
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should reject payloads without expiry date', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token4',
                    authenticated_userid: 'sub=someid',
                    scope: ''
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should reject payloads with refresh token, but without refresh expiry', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token5',
                    expires: (Date.now() + ONE_HOUR),
                    refresh_token: 'refresh5',
                    authenticated_userid: 'sub=someid',
                    scope: 'some_scope hello_world'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should accept a payload with refresh token and expiry date', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token6',
                    expires: (Date.now() + ONE_HOUR),
                    refresh_token: 'refresh6',
                    expires_refresh: (Date.now() + 2 * ONE_HOUR),
                    scope: 'some_scope hello_world'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 201);
                done();
            });
        });

        it('should accept a payload with access token and user id (without refresh token)', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token7',
                    expires: (Date.now() + ONE_HOUR),
                    authenticated_userid: 'sub=someid',
                    scope: 'some_scope hello_world'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 201);
                done();
            });
        });

        it('should accept a payload with access token, user id and refresh token', function (done) {
            request({
                method: 'POST',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                json: true,
                body: { ...baseToken,
                    access_token: 'token8',
                    expires: (Date.now() + ONE_HOUR),
                    refresh_token: 'refresh8',
                    expires_refresh: (Date.now() + 2 * ONE_HOUR),
                    authenticated_userid: 'sub=someid',
                    scope: 'some_scope hello_world'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 201);
                done();
            });
        });
    });

    describe('GET', function () {
        it('should reject calls without the correct scope', function (done) {
            request({
                uri: baseUrl + 'accesstokens?access_token=sometoken',
                headers: utils.makeHeaders(adminUserId, 'wrong_scope')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should reject calls from non-admins', function (done) {
            request({
                uri: baseUrl + 'accesstokens?access_token=sometoken',
                headers: utils.makeHeaders(devUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should not accept a GET without query parameters', function (done) {
            request({
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should not accept a GET with multiple query parameters', function (done) {
            request({
                uri: baseUrl + 'accesstokens?access_token=token8&refresh_token=refresh5',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should not accept a GET with multiple query parameters (2)', function (done) {
            request({
                uri: baseUrl + 'accesstokens?refresh_token=refresh5&authenticated_userid=sub%3Dsomeid',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should accept querying for access token (and returns all things)', function (done) {
            request({
                uri: baseUrl + 'accesstokens?access_token=token8',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.count, 1);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 1);
                const token = jsonBody.items[0];
                assert.equal(token.access_token, 'token8');
                assert.isOk(token.expires);
                assert.equal(token.refresh_token, 'refresh8');
                assert.isOk(token.expires_refresh);
                assert.equal(token.scope, 'some_scope hello_world');
                assert.equal(token.api_id, baseToken.api_id);
                assert.equal(token.plan_id, baseToken.plan_id);
                assert.equal(token.application_id, baseToken.application_id);
                assert.isOk(token.profile);
                assert.equal(token.profile.sub, baseToken.profile.sub);
                assert.equal(token.profile.first_name, baseToken.profile.first_name);
                assert.equal(token.profile.last_name, baseToken.profile.last_name);
                assert.equal(token.token_type, baseToken.token_type);
                assert.equal(token.grant_type, baseToken.grant_type);
                assert.equal(token.auth_method, baseToken.auth_method);
                assert.equal(token.client_id, baseToken.client_id);
                assert.equal(token.expires_in, baseToken.expires_in);
                done();
            });
        });

        it('should accept querying for access token (and does not returns things)', function (done) {
            request({
                uri: baseUrl + 'accesstokens?access_token=unknown_token',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.count, 0);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 0);
                done();
            });
        });

        it('should accept querying for refresh token (and returns things)', function (done) {
            request({
                uri: baseUrl + 'accesstokens?refresh_token=refresh8',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.count, 1);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 1);
                assert.isUndefined(jsonBody.items[0].id, 'id is exposed')
                assert.equal(jsonBody.items[0].access_token, 'token8');
                assert.equal(jsonBody.items[0].refresh_token, 'refresh8');
                assert.equal(jsonBody.items[0].scope, 'some_scope hello_world');
                done();
            });
        });

        it('should accept querying for refresh token (and does not returns things)', function (done) {
            request({
                uri: baseUrl + 'accesstokens?refresh_token=unknown_token',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.count, 0);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 0);
                done();
            });
        });

        it('should accept querying for authenticated user id (and returns multiple things)', function (done) {
            request({
                uri: baseUrl + `accesstokens?authenticated_userid=${encodeURIComponent('sub=someid')}`,
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);

                assert.equal(jsonBody.count, 2);
                assert.isArray(jsonBody.items);

                assert.equal(jsonBody.items.length, 2);
                const token8 = jsonBody.items.find(at => at.access_token === 'token8');
                const token7 = jsonBody.items.find(at => at.access_token === 'token7');
                assert.isOk(token8);
                assert.isOk(token7);

                assert.equal(token8.access_token, 'token8');
                assert.equal(token8.refresh_token, 'refresh8');
                assert.equal(token8.scope, 'some_scope hello_world');

                assert.equal(token7.access_token, 'token7');
                assert.isNotOk(token7.refresh_token);
                assert.equal(token7.scope, 'some_scope hello_world');
                done();
            });
        });

        it('should accept querying for authenticated user id (and does not returns things)', function (done) {
            request({
                uri: baseUrl + `accesstokens?authenticated_userid=${encodeURIComponent('sub=badid')}`,
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.count, 0);
                done();
            });
        });
    });

    describe('DELETE', function () {

        async function addToken(token, userId) {
            return new Promise((resolve, reject) => {
                request({
                    method: 'POST',
                    uri: baseUrl + 'accesstokens',
                    headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE),
                    json: true,
                    body: { ...baseToken,
                        access_token: token,
                        expires: (Date.now() + ONE_HOUR),
                        refresh_token: 'refresh_' + token,
                        expires_refresh: (Date.now() + 2 * ONE_HOUR),
                        authenticated_userid: userId,
                        scope: 'some scope'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 201);
                    err ? reject(err) : resolve();
                });
            });
        }

        async function getTokens(token) {
            return new Promise((resolve, reject) => {
                request({
                    uri: baseUrl + `accesstokens?access_token=${token}`,
                    headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    resolve(utils.getJson(body));
                });
            });
        }

        async function getTokensByUserId(userId) {
            return new Promise((resolve) => {
                request({
                    uri: baseUrl + `accesstokens?authenticated_userid=${encodeURIComponent(userId)}`,
                    headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    resolve(utils.getJson(body));
                })
            })
        }

        async function deleteByAccessToken(token) {
            return new Promise((resolve) => {
                request({
                    method: 'DELETE',
                    uri: baseUrl + `accesstokens?access_token=${token}`,
                    headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 204);
                    resolve();
                });
            });
        }

        async function deleteByRefreshToken(token) {
            return new Promise((resolve) => {
                request({
                    method: 'DELETE',
                    uri: baseUrl + `accesstokens?refresh_token=${token}`,
                    headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 204);
                    resolve();
                });
            });
        }

        async function deleteByUserId(userId) {
            return new Promise((resolve) => {
                request({
                    method: 'DELETE',
                    uri: baseUrl + `accesstokens?authenticated_userid=${encodeURIComponent(userId)}`,
                    headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 204);
                    resolve();
                });
            });
        }

        before(async function () {
            await addToken('token10', 'sub=someuser');
            await addToken('token11', 'sub=someuser');
            await addToken('token12', 'sub=otheruser');
            await addToken('token13', 'sub=otheruser');
        });

        it('should reject calls without the correct scope', function (done) {
            request({
                method: 'DELETE',
                uri: baseUrl + 'accesstokens?access_token=sometoken',
                headers: utils.makeHeaders(adminUserId, 'wrong_scope')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should reject calls from non-admins', function (done) {
            request({
                method: 'DELETE',
                uri: baseUrl + 'accesstokens?access_token=sometoken',
                headers: utils.makeHeaders(devUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should not accept a DELETE without query parameters', function (done) {
            request({
                method: 'DELETE',
                uri: baseUrl + 'accesstokens',
                headers: utils.makeHeaders(adminUserId, ACCESS_TOKEN_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should accept deleting by access token', async function () {
            await deleteByAccessToken('token10');
        });

        it('should have really deleted the access token', async function () {
            const tokenResult = await getTokens('token10');
            assert.equal(tokenResult.count, 0);
            assert.isArray(tokenResult.items);
        });

        it('should accept deleting by refresh token', async function () {
            const tokenResult = await getTokens('token11');
            assert.equal(tokenResult.count, 1);
            assert.equal(tokenResult.items[0].refresh_token, 'refresh_token11');
            await deleteByRefreshToken('refresh_token11');
        });

        it('should have really deleted the access token by refresh token', async function () {
            const tokenResult = await getTokens('token11');
            assert.equal(tokenResult.count, 0);
        });

        it('should accept deleting by authenticated user id', async function () {
            const tokenResult = await getTokensByUserId('sub=otheruser');
            assert.equal(tokenResult.count, 2);
            await deleteByUserId('sub=otheruser');
        });

        it('should have really deleted the access token by  authenticated user id', async function () {
            const tokenResult = await getTokensByUserId('sub=otheruser');
            assert.equal(tokenResult.count, 0);
        });
    });
});
