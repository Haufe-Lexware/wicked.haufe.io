'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const READ_SUBS_SCOPE = 'read_subscriptions';
const WRITE_SUBS_SCOPE = 'write_subscriptions';

const READ_APPROVALS_SCOPE = 'read_approvals';
const INVALID_SCOPE = 'invalid_approvals';

describe('/approvals', function () {

    let devUserId = '';
    let superDevUserId = '';
    let adminUserId = '';
    let noobUserId = '';
    let approverUserId = '';

    const appId = 'approval-test';
    const appDescId = 'approval-description-test';
    const superAppId = 'super-approval-test';
    const publicApi = 'superduper';
    const privateApi = 'partner';
    const veryPrivateApi = 'restricted';
    const appInfo = { name: 'My Application with description', description: 'Its a description of application' };

    // Let's create some users and an application to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('SuperDev', 'superdev', true, function (id) {
                superDevUserId = id;
                utils.createUser('Admin', 'admin', true, function (id) {
                    adminUserId = id;
                    utils.createUser('Noob', null, true, function (id) {
                        noobUserId = id;
                        utils.createUser('Approver', ['approver', 'dev'], true, function (id) {
                            approverUserId = id;
                            utils.createApplication(appId, 'My Application', devUserId, function () {
                                utils.createApplication(appDescId, appInfo, devUserId, function () {
                                    utils.createApplication(superAppId, 'My Super Application', superDevUserId, done);
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    // And delete them afterwards
    after(function (done) {
        utils.deleteApplication(appId, devUserId, function () {
            utils.deleteApplication(appDescId, devUserId, function () {
                utils.deleteApplication(superAppId, superDevUserId, function () {
                    utils.deleteUser(noobUserId, function () {
                        utils.deleteUser(adminUserId, function () {
                            utils.deleteUser(devUserId, function () {
                                utils.deleteUser(superDevUserId, function () {
                                    utils.deleteUser(approverUserId, function () {
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    describe('GET', function () {
        it('should return a 403 if using the wrong scope', function (done) {
            request.get({
                url: baseUrl + 'approvals',
                headers: utils.makeHeaders(adminUserId, INVALID_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should generate an approval request for subscriptions to plans requiring approval', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request({
                    url: baseUrl + 'approvals',
                    headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
                }, function (err, res, body) {
                    utils.deleteSubscription(appId, devUserId, privateApi, function () {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(1, jsonBody.length);
                        done();
                    });
                });
            });
        });
        it('should be possible to get application description as approver', function(done) {
            utils.addSubscription(appDescId, devUserId, privateApi, 'unlimited', null, function () {
                request({
                    url: baseUrl + 'approvals',
                    headers: utils.makeHeaders(approverUserId, READ_APPROVALS_SCOPE)
                }, function (err, res, body) {
                    utils.deleteSubscription(appDescId, devUserId, privateApi, function () {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(1, jsonBody.length);
                        assert.isDefined(jsonBody[0].application.description);
                        done();
                    });
                });
            });
        });
        it('should be possible to retrieve an approval request by id', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request({
                    url: baseUrl + 'approvals',
                    headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
                }, function (err, res, body) {
                    const jsonBody = utils.getJson(body);
                    const approvalId = jsonBody[0].id;
                    request({
                        url: baseUrl + `approvals/${approvalId}`,
                        headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
                    }, function (err, res2, body2) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            assert.equal(1, jsonBody.length);
                            assert.equal(200, res2.statusCode);
                            const jsonBody2 = utils.getJson(body2);
                            assert.equal(jsonBody2.id, approvalId);
                            done();
                        });
                    });
                });
            });
        });

        it('should return a 404 if an approval was not found', function (done) {
            request({
                url: `${baseUrl}approvals/invalidapprovalid`,
                headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });

        it('should return a 403 if using a non-admin user id', function (done) {
            request({
                url: `${baseUrl}approvals/invalidapprovalid`,
                headers: utils.makeHeaders(devUserId, READ_APPROVALS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should return a 403 if using an invalid scope', function (done) {
            request({
                url: `${baseUrl}approvals/invalidapprovalid`,
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should generate an approval request for subscriptions to plans requiring approval, but it mustn\'t be visible to approvers if they do not belong to the right group', function (done) {
            utils.addSubscription(superAppId, superDevUserId, veryPrivateApi, 'restricted_unlimited', null, function () {
                request.get({
                    url: baseUrl + 'approvals',
                    headers: utils.makeHeaders(approverUserId, READ_APPROVALS_SCOPE)
                }, function (err, res, body) {
                    request({
                        url: baseUrl + 'approvals',
                        headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
                    }, function (adminErr, adminRes, adminBody) {
                        utils.deleteSubscription(superAppId, superDevUserId, veryPrivateApi, function () {
                            assert.isNotOk(err);
                            assert.isNotOk(adminErr);
                            assert.equal(200, res.statusCode);
                            assert.equal(200, adminRes.statusCode);
                            const jsonBody = utils.getJson(body);
                            const adminJsonBody = utils.getJson(adminBody);
                            assert.equal(0, jsonBody.length);
                            assert.equal(1, adminJsonBody.length);
                            done();
                        });
                    });
                });
            });
        });

        it('should not generate an approval request for subscriptions to plans not requiring approval', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                request({
                    url: baseUrl + 'approvals',
                    headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
                }, function (err, res, body) {
                    utils.deleteSubscription(appId, devUserId, privateApi, function () {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode);
                        const jsonBody = utils.getJson(body);
                        assert.equal(0, jsonBody.length);
                        done();
                    });
                });
            });
        });

        it('should remove an approval request after approving via patch subscription', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch({
                    url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: { approved: true }
                }, function (err, res, body) {
                    request({
                        url: baseUrl + 'approvals',
                        headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
                    }, function (err, res, body) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
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

        it('should be possible to approve an approval request as non-admin, but having the approval role', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch({
                    url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                    headers: utils.makeHeaders(approverUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: { approved: true }
                }, function (err, res, body) {
                    request({
                        url: baseUrl + 'approvals',
                        headers: utils.makeHeaders(approverUserId, READ_APPROVALS_SCOPE)
                    }, function (err, res, body) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
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

        it('should not be possible to approve your own subscription requests', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch({
                    url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                    headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: { approved: true }
                }, function (err, res, body) {
                    utils.deleteSubscription(appId, devUserId, privateApi, function () {
                        assert.isNotOk(err);
                        utils.assertNotScopeReject(res, body);
                        done();
                    });
                });
            });
        });

        it('should generate an apikey after approving', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch({
                    url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                    headers: utils.makeHeaders(adminUserId, WRITE_SUBS_SCOPE),
                    json: true,
                    body: { approved: true }
                }, function (err, res, body) {
                    request({
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                        headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            const jsonBody = utils.getJson(body);
                            assert.isOk(jsonBody.approved);
                            assert.isOk(jsonBody.apikey, "After approval, subscription must have an API key");
                            done();
                        });
                    });
                });
            });
        });

        it('should remove pending approvals if the subscription is deleted', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                utils.deleteSubscription(appId, devUserId, privateApi, function () {
                    request({
                        url: baseUrl + 'approvals',
                        headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
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

        it('should remove pending approvals if the application is deleted', function (done) {
            utils.createApplication('second-app', 'Second App', devUserId, function () {
                utils.addSubscription('second-app', devUserId, privateApi, 'unlimited', null, function () {
                    utils.deleteApplication('second-app', devUserId, function () {
                        request({
                            url: baseUrl + 'approvals',
                            headers: utils.makeHeaders(adminUserId, READ_APPROVALS_SCOPE)
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
    });
});