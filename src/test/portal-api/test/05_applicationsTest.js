'use strict';

const assert = require('chai').assert;
const request = require('request');
const async = require('async');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const READ_APPS_SCOPE = 'read_applications';
const WRITE_APPS_SCOPE = 'write_applications';
const INVALID_SCOPE = 'invalid_applications';
const READ_USERS_SCOPE = 'read_users';

describe('/applications', function () {

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

    const appId = 'myapp';
    const appName = 'My Application';

    // Let's create a standard application to play with for each test case
    beforeEach(function (done) {
        utils.createApplication(appId, appName, devUserId, function () {
            done();
        });
    });

    afterEach(function (done) {
        utils.deleteApplication(appId, devUserId, function () {
            done();
        });
    });

    // ------------

    describe('POST', function () {
        it('should be possible to create a new application', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application',
                    name: 'Application'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                utils.deleteApplication('application', devUserId, function () {
                    done();
                });
            });
        });

        it('should assign a default clientType to the application', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application',
                    name: 'Application'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                utils.deleteApplication('application', devUserId, function () {
                    assert.equal(jsonBody.clientType, 'public_spa');
                    assert.isFalse(jsonBody.confidential);
                    done();
                });
            });
        });

        it('should overrule confidential with clientType', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application',
                    name: 'Application',
                    confidential: true,
                    clientType: 'public_native'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                utils.deleteApplication('application', devUserId, function () {
                    assert.equal(jsonBody.clientType, 'public_native');
                    assert.isFalse(jsonBody.confidential);
                    done();
                });
            });
        });

        it('should not be possible to create a new application with an invalid clientType', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application',
                    name: 'Application',
                    clientType: 'invalid'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                assert.include(jsonBody.message, 'Invalid clientType');
                done();
            });
        });

        it('should be possible to create a new application with two redirectUris', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application2',
                    name: 'Application',
                    redirectUris: [
                        'https://hello.com',
                        'http://localhost:8080'
                    ]
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                utils.deleteApplication('application2', devUserId, function () {
                    assert.isArray(jsonBody.redirectUris);
                    assert.equal(jsonBody.redirectUris.length, 2);
                    assert.equal(jsonBody.redirectUris[0], 'https://hello.com');
                    assert.equal(jsonBody.redirectUris[1], 'http://localhost:8080');
                    assert.equal(jsonBody.redirectUri, 'https://hello.com');
                    done();
                });
            });
        });

        it('should filter out empty redirect_uris', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application2',
                    name: 'Application',
                    redirectUris: [
                        '',
                        '   ',
                        'https://hello.com',
                        '       ',
                        'http://localhost:8080'
                    ]
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                utils.deleteApplication('application2', devUserId, function () {
                    assert.isArray(jsonBody.redirectUris);
                    assert.equal(jsonBody.redirectUris.length, 2);
                    assert.equal(jsonBody.redirectUris[0], 'https://hello.com');
                    assert.equal(jsonBody.redirectUris[1], 'http://localhost:8080');
                    assert.equal(jsonBody.redirectUri, 'https://hello.com');
                    done();
                });
            });
        });

        it('should not be possible to create a new application with a wrong scope', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE),
                json: true,
                body: {
                    id: 'application2',
                    name: 'Application2'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should not be possible to add a duplicate appId', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: appId,
                    name: appName
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(409, res.statusCode);
                done();
            });
        });

        it('should not be possible to create a new application without user', function (done) {
            request.post({
                url: baseUrl + 'applications',
                json: true,
                body: {
                    id: 'application',
                    name: 'Application'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should not be possible to create a new application with invalid user', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders('somethinginvalid', WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'application',
                    name: 'Application'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should rule out invalid appId characters (special chars)', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'my-app$id',
                    name: appName
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should rule out invalid appId characters (upper case)', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'My-Cool-App',
                    name: appName
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should rule out too short appIds', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'app',
                    name: appName
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should rule out too long appIds', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'app456789012345678901app456789012345678901app456789012345678901',
                    name: appName
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should be possible to create a new application with 4 char appId', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'appl',
                    name: appName
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                utils.deleteApplication('appl', devUserId, function () {
                    done();
                });
            });
        });

        it('should be possible to create a new application with 50 char appId', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'appl5678901234567890appl56789012345678900123456789',
                    name: appName
                }
            }, function (err, res, body) {
                utils.deleteApplication('appl5678901234567890appl56789012345678900123456789', devUserId, function () {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody);
                    done();
                });
            });
        });

        it('should be possible to create a new application, cap name at 128 chars', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'appl5678901234567890appl56789012345678900123456789',
                    name: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefXXXX'
                }
            }, function (err, res, body) {
                utils.deleteApplication('appl5678901234567890appl56789012345678900123456789', devUserId, function () {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody);
                    assert.equal(jsonBody.name, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
                    done();
                });
            });
        });
    }); // POST

    describe('GET', function () {
        it('should set the user as owner of the application', function (done) {
            request({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                assert.equal(1, jsonBody.owners.length);
                assert.equal(jsonBody.owners[0].userId, devUserId);
                done();
            });
        });
        it('should provide correct _links', function (done) {
            request({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody);
                assert.isOk(jsonBody._links);
                assert.isOk(jsonBody._links.self);
                assert.equal(jsonBody._links.self.href, '/applications/' + appId);
                assert.equal(1, jsonBody.owners.length);
                const owner = jsonBody.owners[0];
                assert.isOk(owner._links);
                assert.isOk(owner._links.user);
                assert.equal(owner._links.user.href, '/users/' + devUserId);
                done();
            });
        });

        it('should let an admin retrieve the application', function (done) {
            request({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(adminUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should not let a different user retrieve the application', function (done) {
            request({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(noobUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should not let an invalid user retrieve the application', function (done) {
            request({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders('somethinginvalid', READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should let an admin retrieve a list of all applications', function (done) {
            request.get({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(adminUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200, 'Unexpected status code');
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isOk(jsonBody.count);
                assert.isTrue(jsonBody.hasOwnProperty('count_cached'));
                assert.isArray(jsonBody.items);
                done();
            });
        });

        it('should not let a non-admin retrieve a list of all applications', function (done) {
            request.get({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403, 'Unexpected status code');
                done();
            });
        });
    }); // GET

    describe('PATCH', function () {
        it('should allow for changing an application name', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: appId,
                    name: 'A different name'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal('A different name', jsonBody.name);
                assert.isArray(jsonBody.redirectUris);
                assert.equal(jsonBody.redirectUris.length, 0);
                done();
            });
        });

        it('should not allow for changing an application name with a wrong scope', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE),
                json: true,
                body: {
                    id: appId,
                    name: 'A different name'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should allow for changing an application name, cap at 128 chars', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: appId,
                    name: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefXXXX'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', jsonBody.name);
                done();
            });
        });

        it('should not allow for changing an application name for other user', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: appId,
                    name: 'A different name'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should allow for changing an application name for admin user', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(adminUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: appId,
                    name: 'A different name'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        /*
        it('sometimes takes some debugging', function(done) {
            request(
                {
                    url: baseUrl + 'users',
                    headers: utils.makeHeaders(adminUserId)
                },
                function(err, res, body) {
                    assert.equal(200, res.statusCode);
                    console.log(body);
                    done();
                });
        });
        */

        it('should allow for changing an application name for co-owner', function (done) {
            utils.addOwner(appId, devUserId, "noob@random.org", "owner", function () {
                request.patch({
                    url: baseUrl + 'applications/' + appId,
                    headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE),
                    json: true,
                    body: {
                        id: appId,
                        name: 'A different name'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });
        });
    }); // PATCH

    describe('DELETE', function () {
        it('should return 404 if application is not found', function (done) {
            request.delete({
                url: baseUrl + 'applications/unknownApp',
                headers: utils.makeHeaders(adminUserId, WRITE_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should return 403 if scope is wrong', function (done) {
            utils.createApplication('otherapp', 'My Application', devUserId, function () {
                request.delete({
                    url: baseUrl + 'applications/otherapp',
                    headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
                }, function (err, res, body) {
                    request.delete({
                        url: baseUrl + 'applications/otherapp',
                        headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE)
                    }, (err2, res2, body2) => {
                        assert.isNotOk(err);
                        assert.isNotOk(err2);
                        assert.equal(403, res.statusCode);
                        assert.equal(204, res2.statusCode);
                        done();
                    });
                });
            });
        });

        it('should not allow delete for unknown userId', function (done) {
            request.delete({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders('somethinginvalid', WRITE_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should not allow delete without userId', function (done) {
            request.delete({
                url: baseUrl + 'applications/' + appId,
                headers: utils.onlyScope(WRITE_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should return 204 if successful', function (done) {
            utils.createApplication('otherapp', 'My Application', devUserId, function () {
                request.delete({
                    url: baseUrl + 'applications/otherapp',
                    headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode);
                    done();
                });
            });
        });

        it('should allow co-owners to delete applications', function (done) {
            utils.createApplication('otherapp', 'My Application', devUserId, function () {
                utils.addOwner('otherapp', devUserId, 'noob@random.org', 'owner', function () {
                    request.delete({
                        url: baseUrl + 'applications/otherapp',
                        headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(204, res.statusCode);
                        done();
                    });
                });
            });
        });

        it('should not allow collaborators to delete application', function (done) {
            utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                request.delete({
                    url: baseUrl + 'applications/' + appId,
                    headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode);
                    done();
                });
            });
        });

        it('should not allow readers to delete application', function (done) {
            utils.addOwner(appId, devUserId, 'noob@random.org', 'reader', function () {
                request.delete({
                    url: baseUrl + 'applications/' + appId,
                    headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode);
                    done();
                });
            });
        });

        it('should remove application from owner', function (done) {
            utils.createApplication('otherapp', 'My Application', noobUserId, function () {
                utils.deleteApplication('otherapp', noobUserId, function () {
                    request({
                        url: baseUrl + 'users/' + noobUserId,
                        headers: utils.makeHeaders(noobUserId, READ_USERS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(0, jsonBody.applications.length);
                        done();
                    });
                });
            });
        });

        it('should remove application from collaborator', function (done) {
            utils.createApplication('otherapp', 'My Application', devUserId, function () {
                utils.addOwner('otherapp', devUserId, 'noob@random.org', 'collaborator', function () {
                    utils.deleteApplication('otherapp', devUserId, function () {
                        request({
                            url: baseUrl + 'users/' + noobUserId,
                            headers: utils.makeHeaders(noobUserId, READ_USERS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            const jsonBody = utils.getJson(body);
                            assert.equal(0, jsonBody.applications.length);
                            done();
                        });
                    });
                });
            });
        });

        it('should remove application from index', function (done) {
            utils.createApplication('otherapp', 'My Application', noobUserId, function () {
                utils.deleteApplication('otherapp', noobUserId, function () {
                    request({
                        url: baseUrl + 'applications',
                        headers: utils.makeHeaders(adminUserId, READ_APPS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        const expectNothing = jsonBody.items.find(a => a.id === 'otherapp');
                        assert.isNotOk(expectNothing, 'Application was not deleted from index');
                        done();
                    });
                });
            });
        });// DELETE
    }); // /applications

    describe('/roles', function () {
        it('should return a list of roles (3)', function (done) {
            request({
                url: baseUrl + 'applications/roles',
                headers: utils.makeHeaders(devUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(3, jsonBody.length);
                done();
            });
        });
    }); // /applications/roles

    describe('/<appId>/owners', function () {
        describe('POST', function () {
            it('should be possible to add an owner', function (done) {
                request.post({
                    url: baseUrl + 'applications/' + appId + '/owners',
                    headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                    json: true,
                    body: {
                        email: 'admin@random.org',
                        role: 'owner'
                    }
                }, function (err, res, body) {
                    //console.log(body);
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });

            it('should be possible for co-owners to add a collaborator', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', function () {
                    request.post({
                        url: baseUrl + 'applications/' + appId + '/owners',
                        headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE),
                        json: true,
                        body: {
                            email: 'admin@random.org',
                            role: 'collaborator'
                        }
                    }, function (err, res, body) {
                        //console.log(body);
                        assert.isNotOk(err);
                        assert.equal(201, res.statusCode);
                        done();
                    });
                });
            });

            it('should not be allowed for collaborators to add owners', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                    request.post({
                        url: baseUrl + 'applications/' + appId + '/owners',
                        headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE),
                        json: true,
                        body: {
                            email: 'admin@random.org',
                            role: 'collaborator'
                        }
                    }, function (err, res, body) {
                        //console.log(body);
                        assert.isNotOk(err);
                        assert.equal(403, res.statusCode);
                        done();
                    });
                });
            });

            it('should reflect in the users applications after he was added', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'reader', function () {
                    utils.getUser(noobUserId, function (user) {
                        // console.log(utils.getText(user));
                        assert.equal(1, user.applications.length);
                        assert.equal(appId, user.applications[0].id);
                        done();
                    });
                });
            });
        }); // /owners POST

        describe('DELETE', function () {
            it('should not be possible for an owner to delete a co-owner with a wrong scope', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', function () {
                    request.delete({
                        url: baseUrl + 'applications/' + appId + '/owners?userEmail=noob@random.org',
                        headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(403, res.statusCode);
                        done();
                    });
                });
            });

            it('should be possible for an owner to delete a co-owner', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', function () {
                    request.delete({
                        url: baseUrl + 'applications/' + appId + '/owners?userEmail=noob@random.org',
                        headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        done();
                    });
                });
            });

            it('should be possible for a co-owner to delete an owner', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', function () {
                    request.delete({
                        url: baseUrl + 'applications/' + appId + '/owners?userEmail=dev@random.org',
                        headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE)
                    }, function (err, res, body) {
                        // We have to re-add devUserId as owner to fulfill postcondition (for afterEach)
                        utils.addOwner(appId, noobUserId, 'dev@random.org', 'owner', function () {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            done();
                        });
                    });
                });
            });

            it('should not be possible for a collaborator to delete an owner', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                    request.delete({
                        url: baseUrl + 'applications/' + appId + '/owners?userEmail=dev@random.org',
                        headers: utils.makeHeaders(noobUserId, WRITE_APPS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(403, res.statusCode);
                        done();
                    });
                });
            });

            it('should not be possible to delete the last owner', function (done) {
                request.delete({
                    url: baseUrl + 'applications/' + appId + '/owners?userEmail=dev@random.org',
                    headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(409, res.statusCode);
                    done();
                }
                );
            });

            it('should react gracefully to non-existing user emails', function (done) {
                request.delete({
                    url: baseUrl + 'applications/' + appId + '/owners?userEmail=non@existing.com',
                    headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    done();
                }
                );
            });

            it('should not allow deleting owners without giving a user', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                    request.delete({
                        url: baseUrl + 'applications/' + appId + '/owners?userEmail=noob@random.org',
                        headers: utils.onlyScope(WRITE_APPS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(403, res.statusCode);
                        done();
                    });
                });
            });
        }); // DELETE
    });

    describe('GET ?embed=1', function () {

        const appList = ['abcde-hello', 'fghij-hello', 'klmno-world', 'pqrst-world', 'uvwxyz-world'];

        function makeAppInfo(appId) {
            return {
                id: appId,
                name: appId,
                description: appId,
                mainUrl: `https://${appId}.wicked.com`
            };
        }

        before(function (done) {
            async.each(appList, (appId, callback) => { utils.createApplication(appId, makeAppInfo(appId), adminUserId, callback); }, done);
        });

        after(function (done) {
            async.each(appList, (appId, callback) => { utils.deleteApplication(appId, adminUserId, callback); }, done);
        });

        it('should, as an admin, be possible to get a list of applications', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 6);
                assert.equal(jsonBody.count, 6);
                done();
            });
        });

        it('the response should contain ownerUserId and ownerEmail properties', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.items[0].ownerUserId, adminUserId);
                assert.equal(jsonBody.items[0].ownerEmail, 'admin@random.org');
                done();
            });
        });

        it('should by default return the list ordered by application id', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items[0].id, 'abcde-hello');
                assert.equal(jsonBody.items[5].id, 'uvwxyz-world');
                done();
            });
        });

        it('should on demand return the list ordered by application id decreasing order', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&order_by=id%20DESC&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items[0].id, 'uvwxyz-world');
                assert.equal(jsonBody.items[5].id, 'abcde-hello');
                done();
            });
        });

        it('should be possible to filter for name', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&' + utils.makeFilter({ name: 'hello' }) + '&order_by=id&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                // console.log(JSON.stringify(jsonBody, null, 2));
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.count, 2);
                assert.equal(jsonBody.items[0].id, 'abcde-hello');
                assert.equal(jsonBody.items[1].id, 'fghij-hello');
                done();
            });
        });

        it('should be possible to filter for id', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&' + utils.makeFilter({ id: 'hello' }) + '&order_by=id&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                // console.log(JSON.stringify(jsonBody, null, 2));
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.count, 2);
                assert.equal(jsonBody.items[0].id, 'abcde-hello');
                assert.equal(jsonBody.items[1].id, 'fghij-hello');
                done();
            });
        });

        it('should be possible to filter for ownerEmail', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&' + utils.makeFilter({ ownerEmail: 'dev@random.org' }) + '&order_by=id&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                // console.log(JSON.stringify(jsonBody, null, 2));
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.count, 1);
                assert.equal(jsonBody.items[0].id, appId);
                done();
            });
        });

        it('should be possible to filter for ownerEmail and id', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&' + utils.makeFilter({ id: appId, ownerEmail: 'dev@random.org' }) + '&order_by=id&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                // console.log(JSON.stringify(jsonBody, null, 2));
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.count, 1);
                assert.equal(jsonBody.items[0].id, appId);
                done();
            });
        });

        it('should be possible to filter for description', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&' + utils.makeFilter({ description: 'hello' }) + '&order_by=id&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                // console.log(JSON.stringify(jsonBody, null, 2));
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.count, 2);
                assert.equal(jsonBody.items[0].id, 'abcde-hello');
                assert.equal(jsonBody.items[1].id, 'fghij-hello');
                done();
            });
        });

        it('should be possible to filter for mainUrl', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&' + utils.makeFilter({ mainUrl: 'hello' }) + '&order_by=id%20DESC&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                // console.log(JSON.stringify(jsonBody, null, 2));
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.count, 2);
                assert.equal(jsonBody.items[0].id, 'fghij-hello');
                assert.equal(jsonBody.items[1].id, 'abcde-hello');
                done();
            });
        });

        it('should allow use of offset and limit (offset=0)', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&offset=0&limit=3&order_by=id%20ASC&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 3);
                assert.equal(jsonBody.count, 6);
                assert.equal(jsonBody.items[0].id, 'abcde-hello');
                assert.equal(jsonBody.items[2].id, 'klmno-world');
                done();
            });
        });

        it('should allow use of offset and limit (offset=3)', function (done) {
            request.get({
                url: baseUrl + 'applications?embed=1&offset=3&limit=3&order_by=id%20ASC&no_cache=1',
                headers: utils.makeHeaders(adminUserId, 'read_applications')
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                assert.equal(jsonBody.items.length, 3);
                assert.equal(jsonBody.count, 6);
                assert.equal(jsonBody.items[0].id, 'myapp');
                assert.equal(jsonBody.items[2].id, 'uvwxyz-world');
                done();
            });
        });
    });
});
