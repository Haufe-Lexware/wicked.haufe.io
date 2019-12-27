'use strict';

const assert = require('chai').assert;
const request = require('request');
const wicked = require('wicked-sdk');
const utils = require('./testUtils');
const consts = require('./testConsts');

const authMethodId = 'standard-oauth2';

describe('IdP type "oauth2"', function () {
    it('should return an HTML error page if receiving unexpected error callback', function (done) {
        const cookieJar = request.jar();
        utils.authGet(`${authMethodId}/callback?error=This%20is%20an%error%20message&error_description=Boooo`, cookieJar, function (err, res, body) {
            assert.equal(res.statusCode, 400);
            utils.assertIsHtml(body);
            done();
        });
    });
});
