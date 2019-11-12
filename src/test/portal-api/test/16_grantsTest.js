'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL + 'grants/';
const APP_ID = 'test-app';
const APP_NAME = 'Test Application';
const API_ID = 'oauth2-api';

const READ_SCOPE = 'read_grants';
const WRITE_SCOPE = 'write_grants';

describe('/grants', () => {

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                utils.createUser('Noob', null, true, function (id) {
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

    function putGrantsUnchecked(userId, thisApiId, scopeList, done) {
        const grants = [];
        for (let i = 0; i < scopeList.length; ++i) {
            grants.push({
                scope: scopeList[i]
            });
        }
        request.put({
            url: baseUrl + `${userId}/applications/${APP_ID}/apis/${thisApiId}`,
            headers: utils.makeHeaders(userId, WRITE_SCOPE),
            body: {
                userId: userId,
                applicationId: APP_ID,
                apiId: thisApiId,
                grants: grants
            },
            json: true
        }, done);
    }

    function putGrants(userId, thisApiId, scopeList, done) {
        putGrantsUnchecked(userId, thisApiId, scopeList, (err, res, body) => {
            assert.isNotOk(err);
            if (res.statusCode !== 204) {
                console.log(body);
            }
            assert.equal(204, res.statusCode, 'Unexpected status code');
            done();
        });
    }

    function getGrantsUnchecked(userId, apiId, done) {
        request.get({
            url: baseUrl + `${userId}/applications/${APP_ID}/apis/${apiId}`,
            headers: utils.makeHeaders(userId, READ_SCOPE)
        }, done);
    }

    function getGrants(userId, apiId, done) {
        getGrantsUnchecked(userId, apiId, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode, 'Unexpected status code');
            const jsonBody = utils.getJson(body);
            assert.isOk(jsonBody.grants, 'Expected grants property');
            return done(jsonBody);
        });
    }

    function assertHasGrant(grantInfo, scopeToCheck) {
        assert.isOk(grantInfo.grants);
        assert.isTrue(grantInfo.grants.length > 0);
        const index = grantInfo.grants.findIndex(g => g.scope === scopeToCheck);
        assert.isTrue(index >= 0, `Scope ${scopeToCheck} not found in list of grants`);
        assert.isOk(grantInfo.grants[index].grantedDate, 'Scope grant did not have grantedDate property');
    }

    describe('/{userId}/applications/{applicationId}/apis/{apiId}', () => {
        describe('PUT', () => {

            before((done) => {
                utils.createApplication(APP_ID, APP_NAME, devUserId, done);
            });

            after((done) => {
                utils.deleteApplication(APP_ID, devUserId, done);
            });

            it('should be possible to add grants to an API', (done) => {
                putGrants(devUserId, API_ID, ['write'], done);
            });

            it('should be possible to retrieve the grant', (done) => {
                getGrants(devUserId, API_ID, (grantInfo) => {
                    assertHasGrant(grantInfo, 'write');
                    done();
                });
            });

            it('should be possible to update grants', (done) => {
                putGrants(devUserId, API_ID, ['read', 'write'], () => {
                    getGrants(devUserId, API_ID, (grantInfo) => {
                        assertHasGrant(grantInfo, 'read');
                        assertHasGrant(grantInfo, 'write');
                        done();
                    });
                });
            });

            it('should be possible to add a grant to another API', (done) => {
                putGrants(devUserId, 'portal-api', ['read_grants'], done);
            });

            it('should not be possible to add grants without matching scope', (done) => {
                request.put({
                    url: baseUrl + `${devUserId}/applications/${APP_ID}/apis/${API_ID}`,
                    headers: utils.makeHeaders(devUserId),
                    body: {
                        userId: devUserId,
                        applicationId: APP_ID,
                        apiId: API_ID,
                        grants: []
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to add grants to non-existing APIs', (done) => {
                putGrantsUnchecked(devUserId, 'non-existing-api', [], (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to add grants to non-existing applications', (done) => {
                request.put({
                    url: baseUrl + `${devUserId}/applications/non-existing/apis/${API_ID}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        userId: devUserId,
                        applicationId: 'non-existing',
                        apiId: API_ID,
                        grants: []
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });
        });

        describe('GET', () => {
            before((done) => {
                utils.createApplication(APP_ID, APP_NAME, devUserId, done);
            });

            after((done) => {
                utils.deleteApplication(APP_ID, devUserId, done);
            });

            it('should be possible to write and subsequently read grants', (done) => {
                putGrants(devUserId, 'portal-api', ['read_grants', 'write_grants'], () => {
                    getGrants(devUserId, 'portal-api', (grantList) => {
                        done();
                    });
                });
            });

            it('should not be possible to get grants as a different user', (done) => {
                request.get({
                    url: baseUrl + `${devUserId}/applications/${APP_ID}/apis/${API_ID}`,
                    headers: utils.makeHeaders(noobUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to get grants with a wrong scope', (done) => {
                request.get({
                    url: baseUrl + `${devUserId}/applications/${APP_ID}/apis/${API_ID}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to get grants for a different user with as an admin user', (done) => {
                request.get({
                    url: baseUrl + `${devUserId}/applications/${APP_ID}/apis/${API_ID}`,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    done();
                });
            });
        });

        describe('DELETE', () => {
            before((done) => {
                utils.createApplication(APP_ID, APP_NAME, devUserId, done);
            });

            after((done) => {
                utils.deleteApplication(APP_ID, devUserId, done);
            });

            it('should be possible to delete a single grant', (done) => {
                putGrants(devUserId, API_ID, ['read'], () => {
                    getGrants(devUserId, API_ID, (grantsInfo) => {
                        const deleteUrl = baseUrl + `${devUserId}/applications/${APP_ID}/apis/${API_ID}`;
                        request.delete({
                            url: deleteUrl,
                            headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                        }, (err, res, body) => {
                            assert.isNotOk(err);
                            assert.equal(204, res.statusCode, 'Unexpected status code');
                            done();
                        });
                    });
                });
            });

            it('should not be possible to delete a single grant with wrong scope', (done) => {
                putGrants(devUserId, API_ID, ['read'], () => {
                    request.delete({
                        url: baseUrl + `${devUserId}/applications/${APP_ID}/apis/${API_ID}`,
                        headers: utils.makeHeaders(devUserId, READ_SCOPE)
                    }, (err, res, body) => {
                        assert.isNotOk(err);
                        assert.equal(403, res.statusCode, 'Unexpected status code');
                        done();
                    });
                });
            });
        });
    });

    describe('/{userId}', () => {
        before((done) => {
            utils.createApplication(APP_ID, APP_NAME, devUserId, done);
        });

        after((done) => {
            utils.deleteApplication(APP_ID, devUserId, done);
        });

        describe('GET', () => {
            it('should be possible to retrieve all grants for a user', (done) => {
                // There should be two entries
                request.get({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.equal(2, jsonBody.items.length);
                    done();
                });
            });

            it('should be possible to retrieve all grants for a user as an admin', (done) => {
                // There should be two entries
                request.get({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.equal(2, jsonBody.items.length);
                    done();
                });
            });

            it('should be not possible to retrieve all grants for a user as a different user', (done) => {
                request.get({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(noobUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be not possible to retrieve all grants for a user without correct scope', (done) => {
                request.get({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });
        });

        describe('DELETE', () => {
            it('should be possible to delete all user grants', (done) => {
                request.delete({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should have deleted all grants after a delete', (done) => {
                // There should be two entries
                request.get({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.equal(0, jsonBody.items.length);
                    done();
                });
            });

            it('should not be possible to delete all user grants without correct scope', (done) => {
                request.delete({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to delete all user grants as a different user', (done) => {
                request.delete({
                    url: baseUrl + devUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to delete all user grants as an admin user', (done) => {
                putGrants(devUserId, API_ID, ['read'], () => {
                    request.delete({
                        url: baseUrl + devUserId,
                        headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                    }, (err, res, body) => {
                        assert.isNotOk(err);
                        assert.equal(204, res.statusCode, 'Unexpected status code');
                        done();
                    });
                });
            });
        });
    });
});