'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow, URL */

const assert = require('chai').assert;
const request = require('request');
const async = require('async');
const wicked = require('wicked-sdk');

const utils = require('./testUtils');
const consts = require('./testConsts');

describe('Registration Flow', function () {

    this.slow(500);

    let ids;

    before(function (done) {
        this.timeout(20000);
        const now = new Date();
        utils.initAppsAndSubscriptions(function (err, idsAndSecrets) {
            assert.isNotOk(err);
            assert.isOk(idsAndSecrets);
            ids = idsAndSecrets;
            console.log('Before handler took ' + (new Date() - now) + 'ms.');
            done();
        });
    });

    after(function (done) {
        utils.destroyAppsAndSubcriptions(done);
    });

    afterEach(function (done) {
        async.parallel([
            callback => wicked.deleteAllUserGrants(ids.users.normal.id, callback),
            callback => wicked.deleteAllUserGrants(ids.users.admin.id, callback)
        ], done);
    });

    describe('happy path cases (no namespace)', function () {
        it('should display a registration form after logging in to echo-woo', function (done) {
            const cookieJar = request.jar();
            const apiId = 'echo-woo';
            const user = ids.users.normal;
            const url = utils.getAuthCodeUrl(apiId, ids.confidential.echo_woo, {});
            utils.authGet(url, cookieJar, function (err, res, body) {
                utils.assertIsHtml(body);
                const csrfToken = body.csrfToken;
                assert.equal('login', body.template);
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: user.email,
                    password: user.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.equal(body.template, 'register');
                    done();
                });
            });
        });

        it('should be possible to register the "normal" user with pool woo', function (done) {
            const user = ids.users.normal;
            const client = ids.confidential.echo_woo;
            const cookieJar = request.jar();
            utils.getRegistrationForm(cookieJar, 'echo-woo', client, user, function (err, res, body) {
                const csrfToken = body.csrfToken;
                const nonce = body.nonce;
                assert.isOk(csrfToken);
                assert.isOk(nonce);
                assert.isOk(body.registerUrl);
                utils.authPost(body.registerUrl, {
                    _csrf: csrfToken,
                    nonce: nonce,
                    name: 'Normal User'
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.assertIsCodeRedirect(res, function (err, code) {
                        assert.isNotOk(err);
                        utils.assertUserRegistration('woo', user.id, done);
                    });
                });
            });
        });
    });
});
