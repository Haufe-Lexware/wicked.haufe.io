'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

describe('/ping', function () {
    describe('GET', function () {
        it('should return an OK message', function (done) {
            request({ url: baseUrl + 'ping' },
                function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal('OK', jsonBody.message);
                    done();
                });
        });
    });
});

describe('/globals', function () {
    it('should return global settings with correctly replaced env vars', function (done) {
        request({ url: baseUrl + 'globals' },
            function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal('Portal Title', jsonBody.title);
                assert.equal('Recursive Recursive Recursive', jsonBody.footer);
                done();
            });
    });
});