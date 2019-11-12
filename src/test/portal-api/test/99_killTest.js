'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const RESTART_API_SCOPE = 'restart_api';

describe('/kill', function () {

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

    it('should not be possible to kill the API without the correct scope', function (done) {
        request.post({
            url: baseUrl + 'kill'
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 403);
            const jsonBody = utils.getJson(body);
            assert.include(jsonBody.message, 'missing required scope');
            done();
        });
    });
    
    it('should not be possible to kill the API as a non-admin user', function (done) {
        request.post({
            url: baseUrl + 'kill',
            headers: utils.makeHeaders(devUserId, RESTART_API_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 403);
            const jsonBody = utils.getJson(body);
            assert.include(jsonBody.message, 'This is admin land');
            done();
        });
    });
    
    it('should be possible to kill the API as an admin user', function (done) {
        request.post({
            url: baseUrl + 'kill',
            headers: utils.makeHeaders(adminUserId, RESTART_API_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 204);
            done();
        });
    });
});