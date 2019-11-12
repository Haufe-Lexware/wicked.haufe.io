var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.PORTAL_URL;
var acceptJson = { 'accept': 'application/json' };

describe('Without logging in', function () {

    describe('/applications', function () {
        it('should return an empty applications list ', function (done) {
            request.get({
                url: baseUrl + 'applications',
                headers: acceptJson
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                //console.log(jsonBody);
                assert.equal(0, jsonBody.applications.length);

                done();
            });
        });

        describe('/register', function () {
            it('should not be possible to register an application', function (done) {
                request.post({
                    url: baseUrl + 'applications/register',
                    headers: acceptJson,
                    json: true,
                    body: {
                        appid: 'new-app-id',
                        appname: 'New Application'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode);
                    done();
                });
            });
        });
    });
});

describe('After logging in', function () {
    var jar = request.jar();
    var adminJar = request.jar();

    before(function (done) {
        // Log in
        request.post({
            url: baseUrl + 'login/local',
            jar: jar,
            json: true,
            body: {
                email: 'fred@flintstone.com',
                password: 'pebbles'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(302, res.statusCode);
            assert.equal('/signup', res.headers.location);
            request.post({
                url: baseUrl + 'login/local',
                jar: adminJar,
                json: true,
                body: {
                    email: 'initial@user.com',
                    password: 'password'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(302, res.statusCode);
                assert.equal('/signup', res.headers.location);
                done();
            });
        });
    });

    after(function (done) {
        done();
    });

    describe('/applications', function () {
        it('should return an empty list before registering an application', function (done) {
            request.get({
                url: baseUrl + 'applications',
                headers: acceptJson,
                jar: jar
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                //console.log(jsonBody);
                assert.equal(0, jsonBody.applications.length);

                done();
            });
        });

        describe('/register', function () {
            it('should be possible to register an application', function (done) {
                request.post({
                    url: baseUrl + 'applications/register',
                    headers: acceptJson,
                    json: true,
                    jar: jar,
                    body: {
                        appid: 'new-app-id',
                        appname: 'New Application'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });

        });

        describe('GET', function () {
            it('should return the new application', function (done) {
                request.get({
                    url: baseUrl + 'applications',
                    headers: acceptJson,
                    jar: jar
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    //console.log(jsonBody);
                    assert.equal(1, jsonBody.applications.length);
                    done();
                });
            });
        });

        describe('/:appId/owners/*', function () {
            it('should be possible to add an owner', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/owners/add',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        owneremail: 'initial@user.com',
                        ownerrole: 'collaborator'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });

            it('should be seen in the application data that an owner was added', function (done) {
                request.get({
                    url: baseUrl + 'applications/new-app-id',
                    jar: jar,
                    headers: acceptJson
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    assert.equal(2, jsonBody.application.owners.length);
                    done();
                });
            });

            it('should be possible to remove an owner', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/owners/delete',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        owneremail: 'initial@user.com'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });

            it('should be possible to patch an application name', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/patch',
                    headers: acceptJson,
                    json: true,
                    jar: jar,
                    body: {
                        appname: 'Updated App Name'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    assert.equal('Updated App Name', jsonBody.name);
                    done();
                });
            });
        }); // /owners*

        describe('/:appId/subscribe/:apiId', function () {
            it('should not be possible to add a subscription to plan which is not assigned to an API', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/subscribe/brilliant',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        application: 'new-app-id',
                        api: 'brilliant',
                        plan: 'godlike'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    done();
                });
            });

            it('should be possible to add a subscription to a plan not requiring a subscription', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/subscribe/brilliant',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        application: 'new-app-id',
                        api: 'brilliant',
                        plan: 'basic'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });

            it('should be possible to retrieve the API key from the application page', function (done) {
                request.get({
                    url: baseUrl + 'applications/new-app-id',
                    jar: jar,
                    headers: acceptJson
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    //assert.equal(1, jsonBody.userInfo.applications.length);
                    //assert.equal(1, jsonBody.userInfo.applications[0].subscriptions.length);
                    //assert.isOk(jsonBody.userInfo.applications[0].subscriptions[0].apikey);
                    //console.log(jsonBody.userInfo.applications[0].subscriptions[0].apikey);
                    assert.equal(1, jsonBody.subscriptions.length);
                    assert.isOk(jsonBody.subscriptions[0].apikey);
                    done();
                });
            });

            it('shouldn\'t be possible to add another subscription for the same API', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/subscribe/brilliant',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        application: 'new-app-id',
                        api: 'brilliant',
                        plan: 'basic'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(409, res.statusCode);
                    done();
                });
            });

            it('should be possible to subscribe to an API with a plan requiring approval', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/subscribe/superduper',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        application: 'new-app-id',
                        api: 'superduper',
                        plan: 'unlimited'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(201, res.statusCode);
                    done();
                });
            });

            it('shouldn\'t return any API key for that API without approval', function (done) {
                request.get({
                    url: baseUrl + 'applications/new-app-id',
                    jar: jar,
                    headers: acceptJson
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    //assert.equal(1, jsonBody.userInfo.applications.length);
                    assert.equal(2, jsonBody.subscriptions.length);
                    var subs = jsonBody.subscriptions[1];
                    assert.isNotOk(subs.apikey);
                    assert.isNotOk(subs.clientId);
                    assert.isNotOk(subs.clientSecret);
                    //console.log(jsonBody.userInfo.applications[0].subscriptions[0].apikey);
                    done();
                });
            });

            it('should generate a pending approval when subscribing to an according plan', function (done) {
                request.get({
                    url: baseUrl + 'admin/approvals',
                    jar: adminJar,
                    headers: acceptJson
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    assert.equal(1, jsonBody.approvals.length);
                    done();
                });
            });
            
            it('should not be possible to approve a subscription yourself', function (done) {
                request.post({
                    url: baseUrl + 'admin/approvals/approve',
                    jar: jar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        app: 'new-app-id',
                        api: 'superduper'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode);
                    done();
                });
            });
            
            it('should be possible to approve a subscription as an admin', function (done) {
                request.post({
                    url: baseUrl + 'admin/approvals/approve',
                    jar: adminJar,
                    headers: acceptJson,
                    json: true,
                    body: {
                        app: 'new-app-id',
                        api: 'superduper'
                    }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });
            
            it('should be able to retrieve api keys/client credentials after the approval', function (done) {
                request.get({
                    url: baseUrl + 'applications/new-app-id',
                    jar: jar,
                    headers: acceptJson
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var jsonBody = utils.getJson(body);
                    //assert.equal(1, jsonBody.userInfo.applications.length);
                    assert.equal(2, jsonBody.subscriptions.length);
                    var subs = jsonBody.subscriptions[1];
                    assert.isNotOk(subs.apikey);
                    assert.isOk(subs.clientId);
                    assert.isOk(subs.clientSecret);
                    //console.log(jsonBody.userInfo.applications[0].subscriptions[0].apikey);
                    done();
                });
            });
            
            it('should be able to unsubscribe from an API', function (done) {
                request.post({
                    url: baseUrl + 'applications/new-app-id/unsubscribe/brilliant',
                    json: true,
                    headers: acceptJson,
                    jar: jar,
                    body: {}
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode);
                    done();
                });
            });
        }); // /:appId/subscriptions
    }); // /applications
}); // When logged in
