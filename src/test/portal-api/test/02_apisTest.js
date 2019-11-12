'use strict';

const assert = require('chai').assert;
const http = require('http');
const fs = require('fs');
const path = require('path');
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const READ_APIS_SCOPE = 'read_apis';
const READ_PLANS_SCOPE = 'read_plans';
const INVALID_SCOPE = 'invalid_apis';

describe('/apis', function () {

    let swaggerServer = null;
    before(function (done) {
        const swaggerText = fs.readFileSync(path.join(__dirname, 'res', 'swagger.json'), 'utf8');
        // Hook up a stupid little web server which serves a Swagger file
        swaggerServer = http.createServer(function (req, res) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(swaggerText);
        });
        swaggerServer.listen(8080, done);
    });

    after(function (done) {
        if (swaggerServer) {
            swaggerServer.close(function () {
                swaggerServer = null;
                done();
            });
        } else {
            done();
        }
    });

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                utils.createUser('Noob', null, false, function (id) {
                    noobUserId = id;
                    done();
                });
            });
        });
    });

    // And delete them afterwards    
    after(function (done) {
        utils.deleteUser(noobUserId, function () {
            utils.deleteUser(adminUserId, function () {
                utils.deleteUser(devUserId, function () {
                    done();
                });
            });
        });
    });

    describe('GET', function () {
        it('should return a 403 if the wrong scope is passed', function (done) {
            request({
                url: baseUrl + 'apis',
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return all matching APIs for a logged in user', function (done) {
            request({
                url: baseUrl + 'apis',
                headers: utils.makeHeaders(devUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                const jsonBody = utils.getJson(body);
                assert.equal(10, jsonBody.apis.length);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should only return public APIs if not logged in', function (done) {
            request({
                url: baseUrl + 'apis',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                const jsonBody = utils.getJson(body);
                assert.equal(5, jsonBody.apis.length);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should only return public APIs if user does not have required group', function (done) {
            request({
                url: baseUrl + 'apis',
                headers: utils.makeHeaders(noobUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                const jsonBody = utils.getJson(body);
                assert.equal(5, jsonBody.apis.length);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return 403 if invalid user id is passed', function (done) {
            request({
                url: baseUrl + 'apis',
                headers: utils.makeHeaders('somethinginvalid', READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });
    }); // /apis GET

    describe('/<apiID>', function () {
        it('should return 403 if wrong scope is passed', function (done) {
            request({
                uri: baseUrl + 'apis/brilliant',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return a JSON representation', function (done) {
            request({
                uri: baseUrl + 'apis/brilliant',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'Body: ' + utils.getText(body));
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });

        it('should return a 404 if the API is not known', function (done) {
            request({
                uri: baseUrl + 'apis/invalidapi',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should return a 403 for group-less users if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users',
                headers: utils.makeHeaders(noobUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should succeed for users of right group if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users',
                headers: utils.makeHeaders(devUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });

        it('should succeed for admin users if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users',
                headers: utils.makeHeaders(adminUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });
    });

    describe('/desc', function () {
        it('should return the generic description', function (done) {
            request({
                url: baseUrl + 'apis/desc',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('text/markdown'));
                done();
            });
        });
    });

    describe('/<apiID>/config', function () {
        it('should return a 403 if using wrong scope', function (done) {
            request({
                uri: baseUrl + 'apis/superduper/config',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return a JSON config representation', function (done) {
            request({
                uri: baseUrl + 'apis/superduper/config',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });

        it('should return a 404 if the API is not known', function (done) {
            request({
                uri: baseUrl + 'apis/invalidapi/config',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });
    });

    describe('/<apiID>/desc', function () {
        it('should return 403 if using wrong scope', function (done) {
            request({
                uri: baseUrl + 'apis/brilliant/desc',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return a markdown representation', function (done) {
            request({
                uri: baseUrl + 'apis/brilliant/desc',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('text/markdown'));
                done();
            });
        });

        it('should return a 404 if the API is not known', function (done) {
            request({
                uri: baseUrl + 'apis/invalidapi/desc',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should return a 403 for group-less users if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users/desc',
                headers: utils.makeHeaders(noobUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should succeed for users of right group if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users/desc',
                headers: utils.makeHeaders(devUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('text/markdown'));
                done();
            });
        });

        it('should succeed for admin users if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users/desc',
                headers: utils.makeHeaders(adminUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('text/markdown'));
                done();
            });
        });
    });

    describe('/<apiID>/swagger', function () {
        it('should return 403 if using wrong scope', function (done) {
            request({
                uri: baseUrl + 'apis/brilliant/swagger',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return a JSON swagger representation', function (done) {
            request({
                uri: baseUrl + 'apis/brilliant/swagger',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'Body: ' + utils.getText(body));
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });

        it('should return a JSON swagger representation (remote lookup of swagger)', function (done) {
            request({
                uri: baseUrl + 'apis/superduper/swagger',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'Body: ' + utils.getText(body));
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });

        it('should contain a correct host, basePath and scheme setting for the swagger', function (done) {
            request({
                uri: baseUrl + 'apis/superduper/swagger',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'Body: ' + utils.getText(body));
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                const swaggerJson = utils.getJson(body);
                // From globals.json
                assert.equal(swaggerJson.host, 'localhost:8000', 'Mismatched host property');
                // From globals.json
                assert.equal(swaggerJson.schemes[0], 'http', 'Mismatched scheme');
                // From apis/superduper/config.json
                assert.equal(swaggerJson.basePath, '/mock', 'Mismatched basePath');
                done();
            });
        });

        it('should return a 404 if the API is not known', function (done) {
            request({
                uri: baseUrl + 'apis/invalidapi/swagger',
                headers: utils.onlyScope(READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should return a 403 for group-less users if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users/swagger',
                headers: utils.makeHeaders(noobUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should succeed for users of right group if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users/swagger',
                headers: utils.makeHeaders(devUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });

        it('should succeed for admin users if the API is restricted', function (done) {
            request({
                uri: baseUrl + 'apis/users/swagger',
                headers: utils.makeHeaders(adminUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('application/json'));
                done();
            });
        });
    });

    describe('/:apiId/plans', function () {
        const READ_APIS_PLANS_SCOPE = READ_APIS_SCOPE + ' ' + READ_PLANS_SCOPE;

        it('must return a 403 when using a wrong scope', (done) => {
            request({
                uri: baseUrl + 'apis/orders/plans',
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('must return a 403 when using a wrong scope (read_apis missing)', (done) => {
            request({
                uri: baseUrl + 'apis/orders/plans',
                headers: utils.makeHeaders(devUserId, READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('must return a 403 when using a wrong scope (read_plans missing)', (done) => {
            request({
                uri: baseUrl + 'apis/orders/plans',
                headers: utils.makeHeaders(devUserId, READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('must not be possible to retrieve restricted plans without corresponding groups', function (done) {
            request({
                uri: baseUrl + 'apis/orders/plans',
                headers: utils.makeHeaders(devUserId, READ_APIS_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(0, jsonBody.length);
                done();
            });
        });

        it('must be possible to retrieve restricted plans as an admin', function (done) {
            request({
                uri: baseUrl + 'apis/orders/plans',
                headers: utils.makeHeaders(adminUserId, READ_APIS_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(2, jsonBody.length);
                done();
            });
        });

        it('should be possible to see restricted plans if in right group', function (done) {
            utils.setGroups(devUserId, ["dev", "superdev"], function () {
                request({
                    uri: baseUrl + 'apis/orders/plans',
                    headers: utils.makeHeaders(devUserId, READ_APIS_PLANS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(2, jsonBody.length);
                    done();
                });
            });
        });
    });
});