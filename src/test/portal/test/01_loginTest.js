var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.PORTAL_URL;

var acceptJson = { 'accept': 'application/json' };

describe('/login', function () {

    var jar = request.jar();

    it('should not be possible to get restricted content without logging in', function (done) {
        request.get({
            url: baseUrl + 'content/restricted',
            jar: jar
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(403, res.statusCode);
            done();
        });
    });

    it('should reject a login with faulty credentials', function (done) {
        request.post({
            url: baseUrl + 'login/local',
            json: true,
            jar: jar,
            body: {
                email: 'initial@user.com',
                password: 'wrong!passsword'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            // Answers with redirect
            assert.equal(302, res.statusCode);
            assert.equal('/login', res.headers.location); // /signup redirect means: success 
            done();
        });
    });

    it('should be possible to log in with a predefined user (which is admin)', function (done) {
        request.post({
            url: baseUrl + 'login/local',
            json: true,
            jar: jar,
            body: {
                email: 'initial@user.com',
                password: 'password'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            // Answers with redirect if successful
            assert.equal(302, res.statusCode);
            assert.equal('/signup', res.headers.location);
            done();
        });
    });

    it('should be possible to get restricted content with session', function (done) {
        request.get({
            url: baseUrl + 'content/restricted',
            jar: jar
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            done();
        });
    });
});

describe('/signup', function () {

    var jar = request.jar();
    var adminJar = request.jar();
    
    before(function (done) {
        // Open up an admin user session
        request.post({
            url: baseUrl + 'login/local',
            headers: acceptJson,
            json: true,
            jar: adminJar,
            body: {
                email: 'initial@user.com',
                password: 'password'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(302, res.statusCode);
            done();
        });
    });

    it('should be possible to sign up as a new user', function (done) {
        request.post({
            url: baseUrl + 'signup',
            json: true,
            jar: jar,
            body: {
                firstName: 'Dynamic',
                lastName: 'User',
                email: 'dynamic@user.com',
                password: 'password'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(302, res.statusCode);
            //assert.equal('/login', res.headers.location);
            done();
        });
    });

    it('should not be possible to create an application with an unvalidated email address', function (done) {
        request.post({
            url: baseUrl + 'applications/register',
            headers: acceptJson,
            json: true,
            jar: jar,
            body: {
                appid: 'my-app-id',
                appname: 'My Application'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(403, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal('Not allowed. Email address not validated.', jsonBody.message);
            done();
        });
    });
    
    var verificationId;
    
    it('should have generated a verification request', function (done) {
        request.get({
            url: baseUrl + 'admin/verifications',
            headers: acceptJson,
            jar: adminJar
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            //console.log(jsonBody);
            assert.equal(1, jsonBody.verifications.length);
            assert.isOk(jsonBody.verifications[0].id);
            verificationId = jsonBody.verifications[0].id;
            done();
        });
    });
    
    it('should be possible to GET the verification URL', function (done) {
        request.get({
            url: baseUrl + 'verification/' + verificationId,
            jar: jar,
            headers: acceptJson
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal(true, jsonBody.success);
            done();
        });
    });
    
    it('should now be possible to create an application', function (done) {
        request.post({
            url: baseUrl + 'applications/register',
            headers: acceptJson,
            json: true,
            jar: jar,
            body: {
                appid: 'my-app-id',
                appname: 'My Application'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(201, res.statusCode);
            done();
        });
    });
});
