var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.PORTAL_URL;

describe('/apis', function() {
    
    var jar = request.jar();
    
    it('should be possible to get some APIs when not logged in', function (done) {
        request.get({
            url: baseUrl + 'apis',
            jar: jar,
            headers: { 'accept': 'application/json' }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal(2, jsonBody.length);
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
            done();
        });
    });
    
    it('should be possible to get more APIs after login', function (done) {
        request.get({
            url: baseUrl + 'apis',
            jar: jar,
            headers: { 'accept': 'application/json' }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal(7, jsonBody.length);
            done();
        });
    });
});

describe('/apis/:apiId', function () {
    var jar = request.jar();
    
    it('should be possible to get an API when not logged in', function (done) {
        request.get({
            url: baseUrl + 'apis/brilliant',
            jar: jar,
            headers: { 'accept': 'application/json' }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            //console.log(jsonBody);
            assert.equal("Brilliant API", jsonBody.apiInfo.name);
            done();
        });
    });

    it('should not be possible to get restricted API without login', function (done) {
        request.get({
            url: baseUrl + 'apis/users',
            jar: jar,
            headers: { 'accept': 'application/json' }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(403, res.statusCode);
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
            // Answers with redirect
            assert.equal(302, res.statusCode);
            assert.equal('/signup', res.headers.location); // /signup redirect means: success 
            done();
        });
    });
    
    it('should be possible to get restricted API after login', function (done) {
        request.get({
            url: baseUrl + 'apis/users',
            jar: jar,
            headers: { 'accept': 'application/json' }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal("User Management API", jsonBody.apiInfo.name);
            done();
        });
    });    
});