'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');
const http = require('http');
const async = require('async');

const baseUrl = consts.BASE_URL;
const HOOK_URL = consts.HOOK_URL;
const HOOK_PORT = consts.HOOK_PORT;

const READ_SUBS_SCOPE = 'read_subscriptions';
const WRITE_SUBS_SCOPE = 'write_subscriptions';

const READ_APPS_SCOPE = 'read_applications';
const WRITE_APPS_SCOPE = 'write_applications';

const WEBHOOKS_SCOPE = 'webhooks';

const INVALID_SCOPE = 'invalid_webhooks';
const READ_USERS_SCOPE = 'read_users';
const WRITE_USERS_SCOPE = 'write_users';

let __server = null;

function hookServer(callback, serverHooked) {
    if (__server)
        throw new Error('server is already hooked, release it first!');
    __server = http.createServer(function (req, res) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');

        __server.close(function () {
            __server = null;
            callback();
        });
    });
    __server.listen(HOOK_PORT, serverHooked);
}

function findEvent(eventList, action, entity) {
    let e = null;
    for (let i = 0; i < eventList.length; ++i) {
        const thisE = eventList[i];
        if (thisE.action == action &&
            thisE.entity == entity) {
            e = thisE;
            break;
        }
    }
    return e;
}

describe('/webhooks', function () {

    this.timeout(5000);

    beforeEach(function () {
        utils.correlationId = utils.createRandomId();
        console.log('Correlation ID: ' + utils.correlationId);
    });

    afterEach(function () {
        utils.correlationId = null;
    });

    describe('/listeners/:listenerId', function () {
        it('should not be possible to add a listener with a wrong scope', function (done) {
            request.put({
                url: baseUrl + 'webhooks/listeners/sample',
                json: true,
                headers: utils.makeHeaders('1', INVALID_SCOPE),
                body: {
                    id: 'sample',
                    url: 'http://localhost:3002'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should be possible to add a listener', function (done) {
            request.put({
                url: baseUrl + 'webhooks/listeners/sample',
                json: true,
                headers: utils.makeHeaders('1', WEBHOOKS_SCOPE),
                body: {
                    id: 'sample',
                    url: 'http://localhost:3002'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should not return a list of listeners with a wrong scope', function (done) {
            request.get({
                url: baseUrl + 'webhooks/listeners',
                headers: utils.makeHeaders('1', INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return a list of listeners', function (done) {
            request.get({
                url: baseUrl + 'webhooks/listeners',
                headers: utils.makeHeaders('1', WEBHOOKS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal('sample', jsonBody[0].id);
                done();
            });
        });

        it('should not return a list of listeners without admin user', function (done) {
            request.get({
                url: baseUrl + 'webhooks/listeners',
                headers: utils.onlyScope(WEBHOOKS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should not be possible to update a listener with a wrong scope', function (done) {
            request.put({
                url: baseUrl + 'webhooks/listeners/sample',
                headers: utils.makeHeaders('1', INVALID_SCOPE),
                json: true,
                body: {
                    id: 'sample',
                    url: 'http://lostalllocals:3002'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should be possible to update a listener', function (done) {
            request.put({
                url: baseUrl + 'webhooks/listeners/sample',
                headers: utils.makeHeaders('1', WEBHOOKS_SCOPE),
                json: true,
                body: {
                    id: 'sample',
                    url: 'http://lostalllocals:3002'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return the updated list of listeners', function (done) {
            request.get({
                url: baseUrl + 'webhooks/listeners',
                headers: utils.makeHeaders('1', WEBHOOKS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal('http://lostalllocals:3002', jsonBody[0].url);
                done();
            });
        });

        it('should not be possible to delete a listener with a wrong scope', function (done) {
            request.delete({
                url: baseUrl + 'webhooks/listeners/sample',
                headers: utils.makeHeaders('1', INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should be possible to delete a listener', function (done) {
            request.delete({
                url: baseUrl + 'webhooks/listeners/sample',
                headers: utils.makeHeaders('1', WEBHOOKS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(204, res.statusCode);
                done();
            });
        });

        it('should return an empty list of listeners after the delete', function (done) {
            request.get({
                url: baseUrl + 'webhooks/listeners',
                headers: utils.makeHeaders('1', WEBHOOKS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(0, jsonBody.length);
                done();
            });
        });
    });
    /*
    describe('/events/:listenerId', function() {
         it('should look good', function(done) {
             done();
         });
    });
    */

    describe('/events/:listenerId', function () {
        this.slow(500);

        let devUserId = '';
        const privateApi = 'users';

        before(function (done) {
            utils.createUser('Developer', 'dev', true, function (id) {
                devUserId = id;
                done();
            });
        });

        after(function (done) {
            utils.deleteUser(devUserId, done);
        });

        const LISTENER = 'test-listener';

        /*
        afterEach(function (done) {
            if (server) {
                server.close(function () {
                    server = null;
                    done();
                });
            } else {
                done();
            }
        });
        */

        it('should work to get called by a webhook', function (done) {
            // Totally brainfucking execution order. This is run
            // after the server is called.
            hookServer(function () {
                utils.deleteListener(LISTENER, done);
            }, function () {
                utils.createListener(LISTENER, HOOK_URL, function () {
                    utils.createUser('Dvolla', 'dev', true, function () {
                        // We don't need to do anything here.
                    });
                });
            });

        });

        it('should return expected events (create application)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {
                            utils.deleteApplication('dvolla', devUserId, function () {

                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'add', 'application');
                                assert.isOk(wh);
                                assert.isOk(wh.data);
                                assert.equal(devUserId, wh.data.userId);
                                assert.equal('dvolla', wh.data.applicationId);

                                done();
                            });
                        });
                    });
            }, function () {
                utils.createListener(LISTENER, HOOK_URL, function () {
                    utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                        // We don't need to do anything here.
                    });
                });
            });
        });

        it('should be possible to delete events (create application)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        const jsonBody = utils.getJson(apiBody);
                        const wh = findEvent(jsonBody, 'add', 'application');
                        request.delete({ url: `${baseUrl}webhooks/events/${LISTENER}/${wh.id}`, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) }, function (deleteErr, deleteRes, deleteBody) {
                            utils.deleteListener(LISTENER, function () {
                                utils.deleteApplication('dvolla', devUserId, function () {
                                    assert.isNotOk(deleteErr);
                                    assert.equal(204, deleteRes.statusCode);
                                    assert.isNotOk(err);
                                    assert.equal(200, apiResponse.statusCode);
                                    assert.isOk(wh);
                                    assert.isOk(wh.data);
                                    assert.equal(devUserId, wh.data.userId);
                                    assert.equal('dvolla', wh.data.applicationId);

                                    done();
                                });
                            });
                        });
                    });
            }, function () {
                utils.createListener(LISTENER, HOOK_URL, function () {
                    utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                        // We don't need to do anything here.
                    });
                });
            });
        });

        it('should be possible to flush events (create application)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) }, function (err, apiResponse, apiBody) {
                    request.delete({ url: `${baseUrl}webhooks/events/${LISTENER}`, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) }, function (deleteErr, deleteRes, deleteBody) {
                        request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) }, function (err2, apiResponse2, apiBody2) {
                            utils.deleteListener(LISTENER, function () {
                                utils.deleteApplication('dvolla', devUserId, function () {
                                    assert.isNotOk(deleteErr);
                                    assert.equal(204, deleteRes.statusCode);
                                    // Before flush
                                    assert.isNotOk(err);
                                    assert.equal(200, apiResponse.statusCode);
                                    const jsonBody = utils.getJson(apiBody);
                                    const wh = findEvent(jsonBody, 'add', 'application');
                                    assert.isOk(wh);
                                    assert.isOk(wh.data);
                                    // After flush
                                    assert.isNotOk(err2);
                                    assert.equal(200, apiResponse2.statusCode);
                                    const jsonBody2 = utils.getJson(apiBody2);
                                    assert.isTrue(Array.isArray(jsonBody2));
                                    assert.equal(0, jsonBody2.length);
                                    done();
                                });
                            });
                        });
                    });
                });
            }, function () {
                utils.createListener(LISTENER, HOOK_URL, function () {
                    utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                        // We don't need to do anything here.
                    });
                });
            });
        });

        it('should return expected events (delete application)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {

                            assert.isNotOk(err);
                            assert.equal(200, apiResponse.statusCode);
                            const jsonBody = utils.getJson(apiBody);
                            const wh = findEvent(jsonBody, 'delete', 'application');
                            assert.isOk(wh);
                            assert.equal('delete', wh.action);
                            assert.equal('application', wh.entity);
                            assert.isOk(wh.data);
                            assert.equal(devUserId, wh.data.userId);
                            assert.equal('dvolla', wh.data.applicationId);

                            done();
                        });
                    });
            }, function () {
                utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                    utils.createListener(LISTENER, HOOK_URL, function () {
                        utils.deleteApplication('dvolla', devUserId, function () {
                            // We don't need to do anything here.
                        });
                    });
                });
            });

        });

        it('should return expected events (delete application, including subscriptions)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {

                            assert.isNotOk(err);
                            assert.equal(200, apiResponse.statusCode);
                            const jsonBody = utils.getJson(apiBody);
                            const wh = findEvent(jsonBody, 'delete', 'application');
                            assert.isOk(wh);
                            assert.equal('delete', wh.action);
                            assert.equal('application', wh.entity);
                            assert.isOk(wh.data);
                            assert.equal(devUserId, wh.data.userId);
                            assert.equal('dvolla', wh.data.applicationId);
                            assert.isOk(wh.data.subscriptions, 'delete webhook did not pass subscriptions');
                            assert.equal(wh.data.subscriptions.length, 1, 'subscriptions length was not 1');
                            assert.equal(wh.data.subscriptions[0].api, 'brilliant', 'subscription to faulty API was returned');
                            assert.equal(wh.data.subscriptions[0].application, 'dvolla', 'subscription application not correct');
                            done();
                        });
                    });
            }, function () {
                async.series([
                    callback => utils.createApplication('dvolla', 'Dvolla App', devUserId, callback),
                    callback => utils.addSubscription('dvolla', devUserId, 'brilliant', 'basic', null, callback),
                    callback => utils.createListener(LISTENER, HOOK_URL, callback),
                    callback => utils.deleteApplication('dvolla', devUserId, callback)
                ], function (err, results) {
                    // We don't need to do anything here.
                });
            });

        });

        it('should return expected events (create subscription)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {
                            utils.deleteApplication('dvolla', devUserId, function () {

                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'add', 'subscription');
                                assert.isOk(wh);
                                assert.equal('add', wh.action);
                                assert.equal('subscription', wh.entity);
                                assert.isOk(wh.data);
                                assert.equal(devUserId, wh.data.userId);
                                assert.equal('dvolla', wh.data.applicationId);
                                assert.equal(privateApi, wh.data.apiId);

                                done();
                            });
                        });
                    });
            }, function () {
                utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                    utils.createListener(LISTENER, HOOK_URL, function () {
                        utils.addSubscription('dvolla', devUserId, privateApi, 'basic', null, function () {
                            // We don't need to do anything here.
                        });
                    });
                });
            });
        });

        it('should return expected events (patch subscription)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {
                            utils.deleteApplication('dvolla', devUserId, function () {

                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'update', 'subscription');
                                assert.isOk(wh);
                                assert.equal('update', wh.action);
                                assert.equal('subscription', wh.entity);
                                assert.isOk(wh.data);
                                assert.equal('1', wh.data.userId);
                                assert.equal('dvolla', wh.data.applicationId);
                                assert.equal(privateApi, wh.data.apiId);

                                done();
                            });
                        });
                    });
            }, function () {
                utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                    utils.addSubscription('dvolla', devUserId, privateApi, 'unlimited', null, function () {
                        utils.createListener(LISTENER, HOOK_URL, function () {
                            request.patch(
                                {
                                    url: baseUrl + 'applications/dvolla/subscriptions/' + privateApi,
                                    json: true,
                                    body: { approved: true },
                                    headers: utils.makeHeaders('1', WRITE_SUBS_SCOPE)
                                }, function (err, res, body) {
                                    assert.isNotOk(err);
                                    assert.equal(200, res.statusCode);
                                });
                        });
                    });
                });
            });

        });

        it('should return expected events (delete subscription)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {
                            utils.deleteApplication('dvolla', devUserId, function () {

                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'delete', 'subscription');
                                assert.isOk(wh);
                                assert.equal('delete', wh.action);
                                assert.equal('subscription', wh.entity);
                                assert.isOk(wh.data);
                                assert.equal(devUserId, wh.data.userId);
                                assert.equal('dvolla', wh.data.applicationId);
                                assert.equal(privateApi, wh.data.apiId);

                                done();
                            });
                        });
                    });
            }, function () {
                utils.createApplication('dvolla', 'Dvolla App', devUserId, function () {
                    utils.addSubscription('dvolla', devUserId, privateApi, 'unlimited', null, function () {
                        utils.createListener(LISTENER, HOOK_URL, function () {
                            utils.deleteSubscription('dvolla', devUserId, privateApi, function () {
                                // No need to do something here. 
                            });
                        });
                    });
                });
            });

        });

        it('should return expected events (create user)', function (done) {
            let noobUserId = '';
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {
                            utils.deleteUser(noobUserId, function () {

                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'add', 'user');
                                assert.isOk(wh);
                                assert.equal('add', wh.action);
                                assert.equal('user', wh.entity);
                                assert.isOk(wh.data);
                                assert.equal(noobUserId, wh.data.userId);

                                done();
                            });
                        });
                    });
            }, function () {
                utils.createListener(LISTENER, HOOK_URL, function () {
                    utils.createUser('Noob', '', true, function (userId) {
                        noobUserId = userId;
                    });
                });
            });
        });

        it('should return expected events (patch user)', function (done) {
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {

                            assert.isNotOk(err);
                            assert.equal(200, apiResponse.statusCode);
                            const jsonBody = utils.getJson(apiBody);
                            const wh = findEvent(jsonBody, 'update', 'user');
                            assert.isOk(wh);
                            assert.equal('update', wh.action);
                            assert.equal('user', wh.entity);
                            assert.isOk(wh.data);
                            assert.equal(devUserId, wh.data.updatedUserId);
                            assert.equal('1', wh.data.userId);

                            done();
                        });
                    });
            }, function () {
                utils.createListener(LISTENER, HOOK_URL, function () {
                    request.patch({
                        url: baseUrl + 'users/' + devUserId,
                        headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                        json: true,
                        body: {
                            firstName: 'Developer',
                            lastName: 'Doofus'
                        }
                    }, function () {
                        // Nothing to do here
                    });
                });
            });
        });

        it('should return expected events (delete user)', function (done) {
            let noobUserId = '';
            hookServer(function () {
                request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                    function (err, apiResponse, apiBody) {
                        utils.deleteListener(LISTENER, function () {

                            assert.isNotOk(err);
                            assert.equal(200, apiResponse.statusCode);
                            const jsonBody = utils.getJson(apiBody);
                            const wh = findEvent(jsonBody, 'delete', 'user');
                            assert.isOk(wh);
                            assert.equal('delete', wh.action);
                            assert.equal('user', wh.entity);
                            assert.isOk(wh.data);
                            assert.equal(noobUserId, wh.data.deletedUserId);
                            assert.equal(noobUserId, wh.data.userId);

                            done();
                        });
                    });
            }, function () {
                utils.createUser('Noob', '', true, function (userId) {
                    noobUserId = userId;
                    utils.createListener(LISTENER, HOOK_URL, function () {
                        utils.deleteUser(noobUserId, function () {
                            // Nothing to do here.
                        });
                    });
                });
            });

        });

        describe('adding and deleting owners', function () {

            let noobUserId = '';

            beforeEach(function (done) {
                utils.createUser('Noob', '', true, function (userId) {
                    noobUserId = userId;
                    utils.createApplication('dvolla', 'Dvolla App', devUserId, done);
                });
            });

            afterEach(function (done) {
                utils.deleteApplication('dvolla', devUserId, function () {
                    utils.deleteUser(noobUserId, done);
                });
            });

            it('should return expected events (add owner)', function (done) {
                hookServer(function () {
                    request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                        function (err, apiResponse, apiBody) {
                            utils.deleteListener(LISTENER, function () {
                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'add', 'owner');
                                assert.isOk(wh);
                                assert.equal('add', wh.action);
                                assert.equal('owner', wh.entity);
                                assert.isOk(wh.data);
                                assert.equal(noobUserId, wh.data.addedUserId);
                                assert.equal(devUserId, wh.data.userId);
                                assert.equal('dvolla', wh.data.applicationId);
                                assert.equal('collaborator', wh.data.role);

                                done();
                            });
                        });
                }, function () {
                    utils.createListener(LISTENER, HOOK_URL, function () {
                        utils.addOwner('dvolla', devUserId, 'noob@random.org', 'collaborator', function () {
                            // Nothing to do here.
                        });
                    });
                });
            });

            it('should return expected events (delete owner)', function (done) {
                hookServer(function () {
                    request({ url: baseUrl + 'webhooks/events/' + LISTENER, headers: utils.makeHeaders('1', WEBHOOKS_SCOPE) },
                        function (err, apiResponse, apiBody) {
                            utils.deleteListener(LISTENER, function () {
                                assert.isNotOk(err);
                                assert.equal(200, apiResponse.statusCode);
                                const jsonBody = utils.getJson(apiBody);
                                const wh = findEvent(jsonBody, 'delete', 'owner');
                                assert.isOk(wh);
                                assert.equal('delete', wh.action);
                                assert.equal('owner', wh.entity);
                                assert.isOk(wh.data);
                                assert.equal(noobUserId, wh.data.deletedUserId);
                                assert.equal(devUserId, wh.data.userId);
                                assert.equal('dvolla', wh.data.applicationId);

                                done();
                            });
                        });
                }, function () {
                    utils.addOwner('dvolla', devUserId, 'noob@random.org', 'collaborator', function () {
                        utils.createListener(LISTENER, HOOK_URL, function () {
                            utils.deleteOwner('dvolla', devUserId, 'noob@random.org', function () {
                                // Nothing to do here.
                            });
                        });
                    });
                });
            });
        });
    });
});