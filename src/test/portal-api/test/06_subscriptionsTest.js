'use strict';

const assert = require('chai').assert;
const async = require('async');
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const poolId = 'woo-ns';
const READ_SUBS_SCOPE = 'read_subscriptions';
const WRITE_SUBS_SCOPE = 'write_subscriptions';

const INVALID_SCOPE = 'invalid_applications';
const READ_USERS_SCOPE = 'read_users';
const READ_APIS_SCOPE = 'read_apis';

describe('/applications/<appId>/subscriptions', function () {

    this.timeout(5000);

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';
    let approverUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Approver', ['approver', 'dev'], true, function (id) {
                approverUserId = id;
                utils.createUser('Admin', 'admin', true, function (id) {
                    adminUserId = id;
                    utils.createUser('Noob', null, true, function (id) {
                        noobUserId = id;
                        done();
                    });
                });
            });
        });
    });

    // And delete them afterwards    
    after(function (done) {
        utils.deleteUser(noobUserId, function () {
            utils.deleteUser(approverUserId, function () {
                utils.deleteUser(adminUserId, function () {
                    utils.deleteUser(devUserId, function () {
                        done();
                    });
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

    const subsUrl = baseUrl + 'applications/' + appId + '/subscriptions';
    const publicApi = 'superduper';
    const privateApi = 'partner';
    const oauth2Api = 'oauth2-api';

    describe('POST', function () {
        it('should not be possible to add a subscription with the wrong scope', function (done) {
            request.post({
                url: subsUrl,
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: publicApi,
                    plan: 'unlimited'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should be possible to add a subscription', function (done) {
            request.post({
                url: subsUrl,
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: publicApi,
                    plan: 'unlimited'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                done();
            });
        });

        it('should be possible for co-owners to add a subscription', function (done) {
            utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', function () {
                request.post({
                    url: subsUrl,
                    headers: utils.makeHeaders(noobUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        application: appId,
                        api: publicApi,
                        plan: 'unlimited'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });
        });

        it('should be possible for collaborators to add a subscription', function (done) {
            utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                request.post({
                    url: subsUrl,
                    headers: utils.makeHeaders(noobUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        application: appId,
                        api: publicApi,
                        plan: 'godlike'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });
        });

        it('should not be possible for readers to add a subscription', function (done) {
            utils.addOwner(appId, devUserId, 'noob@random.org', 'reader', function () {
                request.post({
                    url: subsUrl,
                    headers: utils.makeHeaders(noobUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        application: appId,
                        api: publicApi,
                        plan: 'basic'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode);
                    done();
                });
            });
        });

        it('should not be possible to add a subscription with an invalid user', function (done) {
            request.post({
                url: subsUrl,
                headers: utils.makeHeaders('somethinginvalid', WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: publicApi,
                    plan: 'basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should not be possible to add a subscription with an invalid plan', function (done) {
            request.post({
                url: subsUrl,
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: publicApi,
                    plan: 'invalidplan'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should not be possible to add a subscription with a restricted plan', function (done) {
            request.post({
                url: subsUrl,
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: 'orders',
                    plan: 'restricted_basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should, with the required group, be possible to add a subscription to a restricted plan', function (done) {
            utils.setGroups(devUserId, ["dev", "superdev"], function () {
                utils.addSubscription(appId, devUserId, 'orders', 'restricted_basic', null, function () {
                    utils.deleteSubscription(appId, devUserId, 'orders', function () {
                        done();
                    });
                });
            });

        });

        it('should, as an admin, be possible to add a subscription to a restricted plan', function (done) {
            utils.addSubscription(appId, adminUserId, 'orders', 'restricted_basic', null, function () {
                utils.deleteSubscription(appId, adminUserId, 'orders', function () {
                    done();
                });
            });
        });

        it('should not be possible to add a subscription with an invalid API', function (done) {
            request.post({
                url: subsUrl,
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: 'invalid-api',
                    plan: 'basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should not be possible to add a subscription without a user', function (done) {
            request.post({
                url: subsUrl,
                json: true,
                body: {
                    application: appId,
                    api: publicApi,
                    plan: 'basic'
                },
                headers: utils.onlyScope(WRITE_SUBS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should not be possible to add a subscription to an invalid app', function (done) {
            request.post({
                url: baseUrl + 'applications/invalid-app/subscriptions',
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: 'invalid-app',
                    api: publicApi,
                    plan: 'basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });
        it('should not be possible to add a subscription to a restricted API', function (done) {
            utils.createApplication('noobapp', 'Noob App', noobUserId, function () {
                request.post({
                    url: baseUrl + 'applications/noobapp/subscriptions',
                    headers: utils.makeHeaders(noobUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        application: 'noobapp',
                        api: 'restricted',
                        plan: 'restricted_basic'
                    }
                }, function (err, res, body) {
                    utils.deleteApplication('noobapp', noobUserId, function () {
                        assert.isNotOk(err);
                        utils.assertNotScopeReject(res, body);
                        done();
                    });
                });
            });
        });

        it('should not return an apikey for plans which require approval', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.get({
                    url: subsUrl,
                    headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isNotOk(jsonBody[0].apikey);
                    assert.isNotOk(jsonBody[0].approved);
                    done();
                });
            });
        });

        it('should, for admins, return an apikey for plans which require approval', function (done) {
            utils.addSubscription(appId, adminUserId, privateApi, 'unlimited', null, function () {
                request({
                    url: subsUrl,
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody[0].apikey, "Admins must get the apikey back, no approval needed.");
                    assert.isOk(jsonBody[0].approved, "Subscriptions must be marked as approved.");
                    done();
                });
            });
        });
    }); // /subscriptions POST

    describe('GET', function () {
        it('should be possible to get all subscriptions', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                request({
                    url: subsUrl,
                    headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(1, jsonBody.length);
                    done();
                });
            });
        });

        it('should be possible for collaborators to get all subscriptions', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                    request({
                        url: subsUrl,
                        headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(1, jsonBody.length);
                        done();
                    });
                });
            });
        });

        it('should be possible for readers to get all subscriptions', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'reader', function () {
                    request({
                        url: subsUrl,
                        headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(1, jsonBody.length);
                        done();
                    });
                });
            });
        });

        it('should be possible for admins to get all subscriptions, even if not owner', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                request({
                    url: subsUrl,
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(1, jsonBody.length);
                    done();
                });
            });
        });

        it('should not be possible for unrelated users to get all subscriptions', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                request({
                    url: subsUrl,
                    headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.assertNotScopeReject(res, body);
                    done();
                });
            });
        });
    }); // /subscriptions GET

    describe('/<apiId>', function () {
        describe('GET', function () {
            it('should be possible to get subscription', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    request({
                        url: subsUrl + '/' + privateApi,
                        headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(privateApi, jsonBody.api);
                        done();
                    });
                });
            });

            it('should return the correct apikey for a subscription', function (done) {
                const APIKEY = 'abcdefghijklmno';
                utils.addSubscription(appId, devUserId, privateApi, 'basic', APIKEY, function () {
                    request({
                        url: subsUrl + '/' + privateApi,
                        headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(privateApi, jsonBody.api);
                        assert.equal(APIKEY, jsonBody.apikey);
                        done();
                    });
                });
            });

            it('should be possible for collaborators to get subscription', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                        request({
                            url: subsUrl + '/' + privateApi,
                            headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            const jsonBody = utils.getJson(body);
                            assert.equal(privateApi, jsonBody.api);
                            done();
                        });
                    });
                });
            });

            it('should be possible for readers to get subscription', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    utils.addOwner(appId, devUserId, 'noob@random.org', 'reader', function () {
                        request({
                            url: subsUrl + '/' + privateApi,
                            headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            const jsonBody = utils.getJson(body);
                            assert.equal(privateApi, jsonBody.api);
                            done();
                        });
                    });
                });
            });

            it('should be possible for admins to get subscription, even if not owner', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    request({
                        url: subsUrl + '/' + privateApi,
                        headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(privateApi, jsonBody.api);
                        done();
                    });
                });
            });

            it('should contain data for allowedScopes(Mode)', function (done) {
                utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                    request({
                        url: subsUrl + '/' + oauth2Api,
                        headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(oauth2Api, jsonBody.api);
                        assert.isDefined(jsonBody.allowedScopesMode, 'allowedScopesMode is not defined');
                        assert.isDefined(jsonBody.allowedScopes, 'allowedScopesMode is not defined');
                        done();
                    });
                });
            });

            it('should not be possible for unrelated users to get subscription', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    request({
                        url: subsUrl + '/' + privateApi,
                        headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        utils.assertNotScopeReject(res, body);
                        done();
                    });
                });
            });

            it('should return valid _links', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    request({
                        url: subsUrl + '/' + privateApi,
                        headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody._links);
                        assert.isOk(jsonBody._links.self);
                        assert.isOk(jsonBody._links.application);
                        assert.isOk(jsonBody._links.plans);
                        assert.isOk(jsonBody._links.apis);
                        assert.equal(jsonBody._links.self.href, '/applications/' + appId + '/subscriptions/' + privateApi);
                        assert.equal(jsonBody._links.application.href, '/applications/' + appId);
                        assert.equal(jsonBody._links.plans.href, '/plans');
                        assert.equal(jsonBody._links.apis.href, '/apis');
                        done();
                    });
                });
            });

        }); // /subscriptions/<apiId> GET

        describe('DELETE', function () {
            it('should be possible to delete a subscription', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    request.delete({
                        url: subsUrl + '/' + privateApi,
                        headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(204, res.statusCode);
                        done();
                    });
                });
            });

            it('should return a 404 if the application is invalid', function (done) {
                request.delete({
                    url: baseUrl + 'applications/invalid-app/subscriptions/' + privateApi,
                    headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode);
                    done();
                });
            });

            it('should return a 403 if using the wrong scope', function (done) {
                request.delete({
                    url: subsUrl + '/' + privateApi,
                    headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.assertScopeReject(res, body);
                    done();
                });
            });

            it('should return a 403 if the user is invalid', function (done) {
                request.delete({
                    url: subsUrl + '/' + privateApi,
                    headers: utils.makeHeaders('somethinginvalid', WRITE_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.assertNotScopeReject(res, body);
                    done();
                });
            });

            it('should return a 404 if trying to delete a non-existing subscription', function (done) {
                request.delete({
                    url: subsUrl + '/' + privateApi,
                    headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode);
                    done();
                });
            });

            it('should be possible to delete a subscription for a collaborator', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'collaborator', function () {
                    utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                        request.delete({
                            url: subsUrl + '/' + privateApi,
                            headers: utils.makeHeaders(noobUserId, WRITE_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(204, res.statusCode);
                            done();
                        });
                    });
                });
            });

            it('should not be possible to delete a subscription for a reader', function (done) {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'reader', function () {
                    utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                        request.delete({
                            url: subsUrl + '/' + privateApi,
                            headers: utils.makeHeaders(noobUserId, WRITE_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            utils.assertNotScopeReject(res, body);
                            done();
                        });
                    });
                });
            });

            it('should be removed from subscriptions after deleting', function (done) {
                utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                    request({
                        url: subsUrl,
                        headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(1, jsonBody.length);

                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
                            request({
                                url: subsUrl,
                                headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                            }, function (err, res, body) {
                                assert.isNotOk(err);
                                assert.equal(200, res.statusCode);
                                const jsonBody = utils.getJson(body);
                                assert.equal(0, jsonBody.length);
                                done();
                            });
                        });
                    });
                });
            });

        }); // /subscriptions/<apiId> DELETE
    }); // /subscriptions/<apiId>

    describe('deprecated APIs', function () {
        it('should not be possible to create a subscription for a deprecated API', function (done) {
            request.post({
                url: baseUrl + 'applications/' + appId + '/subscriptions',
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: appId,
                    api: 'deprecated',
                    plan: 'basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'API is deprecated. Subscribing not possible.');
                done();
            });
        });
    });

    describe('/apis/<apiIs>/subscriptions', function () {
        it('should be forbidden to call for non-admin users', function (done) {
            request.get({
                url: baseUrl + 'apis/superduper/subscriptions',
                headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE + ' ' + READ_APIS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'Not Allowed. Only Admins can get subscriptions for an API.');
                done();
            });
        });

        it('should return subscriptions per API', function (done) {
            utils.addSubscription(appId, devUserId, 'superduper', 'basic', null, function (err) {
                assert.isNotOk(err);
                request.get({
                    url: baseUrl + 'apis/superduper/subscriptions',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE + ' ' + READ_APIS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.deleteSubscription(appId, devUserId, 'superduper', function (err) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.items);
                        assert.isArray(jsonBody.items);
                        assert.equal(jsonBody.items.length, 1);
                        assert.equal(jsonBody.count, 1);
                        assert.equal(jsonBody.items[0].application, appId);
                        assert.equal(jsonBody.items[0].plan, 'basic');
                        done();
                    });
                });
            });
        });

        it('should delete applications from subscription API index again (when deleting subscriptions)', function (done) {
            async.series([
                callback => utils.addSubscription(appId, devUserId, 'superduper', 'basic', null, callback),
                callback => utils.deleteSubscription(appId, devUserId, 'superduper', callback)
            ], function (err, results) {
                assert.isNotOk(err);
                request.get({
                    url: baseUrl + 'apis/superduper/subscriptions',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE + ' ' + READ_APIS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(0, jsonBody.items.length);
                    done();
                });
            });
        });

        it('should delete applications from subscription API index again (when deleting applications)', function (done) {
            async.series([
                callback => utils.createApplication('whoawhoa', 'Whoa App', devUserId, callback),
                callback => utils.addSubscription('whoawhoa', devUserId, 'superduper', 'basic', null, callback),
                callback => utils.deleteApplication('whoawhoa', devUserId, callback)
            ], function (err, results) {
                assert.isNotOk(err);
                request.get({
                    url: baseUrl + 'apis/superduper/subscriptions',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE + ' ' + READ_APIS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(0, jsonBody.items.length);
                    done();
                });
            });
        });
    });

    describe('PATCH', function () {
        it('should be possible to patch a subscription (trust subscription)', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        trusted: true
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.trusted, true);
                    assert.isDefined(jsonBody.allowedScopes, 'allowedScopes must be defined');
                    assert.isDefined(jsonBody.allowedScopesMode, 'allowedScopesMode must be defined');
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });

        it('should be possible to patch a subscription (change allowed scopes)', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        allowedScopesMode: 'select',
                        allowedScopes: ['hello', 'world']
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.trusted, false);
                    assert.equal(jsonBody.allowedScopesMode, 'select');
                    assert.isDefined(jsonBody.allowedScopesMode, 'allowedScopesMode must be defined');
                    assert.isDefined(jsonBody.allowedScopes, 'allowedScopes must be defined');
                    assert.isArray(jsonBody.allowedScopes, 'allowedScopes must be an array');
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });

        it('should be possible to patch a subscription (change allowed scopes, just one scope)', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        allowedScopesMode: 'select',
                        allowedScopes: ['hello']
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.trusted, false);
                    assert.equal(jsonBody.allowedScopesMode, 'select');
                    assert.isDefined(jsonBody.allowedScopesMode, 'allowedScopesMode must be defined');
                    assert.isDefined(jsonBody.allowedScopes, 'allowedScopes must be defined');
                    assert.isArray(jsonBody.allowedScopes, 'allowedScopes must be an array');
                    assert.equal(jsonBody.allowedScopes.length, 1);
                    assert.equal(jsonBody.allowedScopes[0], 'hello');
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });

        it('should reject an invalid patch request (invalid mode)', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        allowedScopesMode: 'invalid',
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });

        it('should reject an invalid patch request (invalid scope array)', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        allowedScopesMode: 'select',
                        allowedScopes: 'aoow jlslf slkjslkjdfksdf'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });

        it('should reject an invalid patch request (invalid scope array (2))', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        allowedScopesMode: 'select',
                        allowedScopes: [{ scope: 'hello' }, { scope: 'world' }]
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });

        it('should not be possible to patch a subscription as a non-admin (trust subscription)', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function () {
                request.patch({
                    url: subsUrl + '/' + oauth2Api,
                    headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: {
                        trusted: true
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode);
                    utils.deleteSubscription(appId, devUserId, oauth2Api, done);
                });
            });
        });
    });

    function addSomeRegistrations(callback) {
        utils.putRegistration(poolId, adminUserId, adminUserId, 'Admin User', 'ns1', (err) => {
            assert.isNotOk(err);
            utils.putRegistration(poolId, devUserId, adminUserId, 'Dan Developer', 'ns1', (err) => {
                assert.isNotOk(err);
                utils.putRegistration(poolId, noobUserId, adminUserId, 'Norah Noob', 'ns2', (err) => {
                    assert.isNotOk(err);
                    callback();
                });
            });
        });
    }

    function deleteSomeRegistrations(callback) {
        utils.deleteRegistration(poolId, adminUserId, 'ns1', true, (err) => {
            utils.deleteRegistration(poolId, devUserId, 'ns1', true, (err2) => {
                utils.deleteRegistration(poolId, noobUserId, 'ns2', true, (err3) => {
                    assert.isNotOk(err);
                    assert.isNotOk(err2);
                    assert.isNotOk(err3);
                    callback();
                });
            });
        });
    }

    describe('subscriptions?embed=1', function () {
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
            addSomeRegistrations(function () {
                async.each(appList, (appId, callback) => {
                    utils.createApplication(appId, makeAppInfo(appId), devUserId, function () {
                        utils.addSubscription(appId, devUserId, publicApi, 'unlimited', null, function () {
                            utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', callback);
                        });
                    });
                }, done);
            });
        });

        after(function (done) {
            deleteSomeRegistrations(function () {
                async.each(appList, (appId, callback) => {
                    utils.deleteSubscription(appId, devUserId, publicApi, function () {
                        utils.deleteApplication(appId, devUserId, callback);
                    });
                }, done);
            });
        });

        it('should be possible to get a list of subscriptions as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 5);
                    assert.equal(jsonBody.count, 5);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should be possible to get a list of subscriptions using offset and count as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&offset=0&limit=1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 1);
                    assert.equal(jsonBody.count, 5);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&offset=0&limit=1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should be possible to return a list of subscriptions ordered by application name as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&order_by=application_name%20ASC&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items[0].application, 'abcde-hello');
                    assert.equal(jsonBody.items[4].application, 'uvwxyz-world');
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&order_by=application_name%20ASC&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should return a 403 if using a non-admin user id', function (done) {
            request({
                url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should be possible return a list of subscriptions ordered by application name in descending order as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&order_by=application_name%20DESC&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items[0].application, 'uvwxyz-world');
                    assert.equal(jsonBody.items[4].application, 'abcde-hello');
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&order_by=application_name%20DESC&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should be possible to return a list of subscriptions, filtering it by application name as an admin ', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22application_name%22%3A%20%22uvwxyz%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 1);
                    assert.equal(jsonBody.items[0].application, 'uvwxyz-world');
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22application_name%22%3A%20%22uvwxyz%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should not be possible to get a subscription list, filtering it by incorrect application name as an admin ', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22application_name%22%3A%20%22invalidappname%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 0);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22application_name%22%3A%20%22invalidappname%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should be possible to return a list of subscription, filtering it by plan name as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%plan%22%3A%20%22unlim%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 5);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%plan%22%3A%20%22unlim%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should not be possible to get a list of subscripitions, filtering it by incorrect plan name as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22plan%22%3A%20%22invalid%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 0);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22plan%22%3A%20%22invalid%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });
        it('should be possible to return a list of subscriptions, filtering it by api as an admin ', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22api%22%3A%20%22superduper%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 5);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22api%22%3A%20%22superduper%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should not be possible to get a list of subscriptions, filtering it by incorrect api as an admin', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22api%22%3A%20%22pet%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 0);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&filter=%7B%0A%20%20%22api%22%3A%20%22pet%22%0A%7D&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should not be possible as an approver, to get a list of subscriptions which does not belong to the same group as approver', function (done) {
            if (utils.isPostgres()) {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                    headers: utils.makeHeaders(approverUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isArray(jsonBody.items);
                    assert.equal(jsonBody.items.length, 0);
                    assert.equal(jsonBody.count, 0);
                    done();
                });
            } else {
                request.get({
                    url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                    headers: utils.makeHeaders(approverUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('should be possible as an approver, to get a list of subscriptions which does belong to the same group as approver', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', function () {
                    if (utils.isPostgres()) {
                        request.get({
                            url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                            headers: utils.makeHeaders(approverUserId, READ_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(res.statusCode, 200);
                            const jsonBody = utils.getJson(body);
                            assert.isOk(jsonBody.items);
                            assert.isArray(jsonBody.items);
                            assert.equal(jsonBody.items.length, 1);
                            assert.equal(jsonBody.count, 1);
                            done();
                        });
                    } else {
                        request.get({
                            url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                            headers: utils.makeHeaders(approverUserId, READ_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(res.statusCode, 501);
                            done();
                        });
                    }
                });
            });

        });
        it('should be possible to get all subscriptions if user belongs both approver and admin groups ', function (done) {
            utils.setGroups(noobUserId, ["admin", "approver"], function () {
                if (utils.isPostgres()) {
                    request.get({
                        url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                        headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(res.statusCode, 200);
                        const jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.items);
                        assert.isArray(jsonBody.items);
                        assert.equal(jsonBody.items.length, 5);
                        assert.equal(jsonBody.count, 5);
                        done();
                    });
                } else {
                    request.get({
                        url: baseUrl + 'subscriptions?embed=1&no_cache=1',
                        headers: utils.makeHeaders(noobUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(res.statusCode, 501);
                        done();
                    });
                }
            });
        });
    });
});