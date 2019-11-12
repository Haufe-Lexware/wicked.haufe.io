'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL + 'templates/';

const READ_SCOPE = 'read_templates';
const INVALID_SCOPE = 'invalid_templates';

describe('/templates', () => {
    describe('/chatbot', () => {
        it('should return 403 if using the wrong scope', (done) => {
            request.get({
                url: baseUrl + 'chatbot',
                headers: utils.makeHeaders('1', INVALID_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return the chatbot template (as admin)', (done) => {
            request.get({
                url: baseUrl + 'chatbot',
                headers: utils.makeHeaders('1', READ_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return 403 if not using an admin user', (done) => {
            request.get({
                url: baseUrl + 'chatbot',
                headers: utils.onlyScope(READ_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });
    });

    describe('/email/<id>', () => {
        it('should return 403 if using the wrong scope', (done) => {
            request.get({
                url: baseUrl + 'email/lost_password',
                headers: utils.makeHeaders('1', INVALID_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return a valid email template (as admin)', (done) => {
            request.get({
                url: baseUrl + 'email/lost_password',
                headers: utils.makeHeaders('1', READ_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return 403 if not using an admin user', (done) => {
            request.get({
                url: baseUrl + 'email/lost_password',
                headers: utils.onlyScope(READ_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });
    });
});