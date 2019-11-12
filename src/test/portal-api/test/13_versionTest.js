'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');
const packageJson = require('../package.json'); 

const baseUrl = consts.BASE_URL;

describe('/confighash', function () {

    let configHash = null;

    it('should be possible to retrieve a config hash', function (done) {
        request.get({
            url: baseUrl + 'confighash'
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            configHash = utils.getText(body);
            assert.isOk(configHash, 'did not retrieve config hash');
            done();
        });
    });

    it('should be possible to retrieve globals with a valid hash', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should not be possible to retrieve globals with an invalid hash', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': 'configHash'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 428);
            done();
        });
    });

    it('should not be possible to retrieve globals via Kong', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash,
                'X-Consumer-Custom-Id': 'abcdefgh'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertKongReject(res, body);
            done();
        });
    });

    it('should be possible to retrieve globals with an valid version', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash,
                'User-Agent': 'wicked.test/' + packageJson.version
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should not be possible to retrieve globals with an invalid version', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash,
                'User-Agent': 'wicked.test/0.1.0'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 428);
            done();
        });
    });


    it('should be possible to retrieve globals with a non-wicked user agent version', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'User-Agent': 'curl/7.5.23'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should have added a default sessionStore configuration in globals', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            const jsonBody = utils.getJson(body);
            assert.isOk(jsonBody.sessionStore, 'globals.json do not contain a sessionStore property');
            assert.equal(jsonBody.sessionStore.type, 'file', 'default sessionStore.type is not equal "file"');
            done();
        });
    });
});