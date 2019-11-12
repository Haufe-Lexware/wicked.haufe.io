'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const READ_PLANS_SCOPE = 'read_plans';
const INVALID_SCOPE = 'invalid_plans';

describe('/plans', function () {
    describe('GET', function () {
        it('should return 403 using wrong scope', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return all plans', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.plans);
                assert.equal(7, jsonBody.plans.length);
                done();
            });
        });

        it('should return also the internal API Plans', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.plans);
                let foundApiPlanBasic = false;
                let foundApiPlanUnlimited = false;
                for (let i = 0; i < jsonBody.plans.length; ++i) {
                    if ("__internal_api_basic" == jsonBody.plans[i].id)
                        foundApiPlanBasic = true;
                    if ("__internal_api_unlimited" == jsonBody.plans[i].id)
                        foundApiPlanUnlimited = true;
                }
                assert.isOk(foundApiPlanBasic, 'did not find api basic plan');
                assert.isOk(foundApiPlanUnlimited, 'did not find api unlimited plan');
                done();
            });
        });

        it('should not care about logged in users', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.makeHeaders('somethinginvalid', READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return valid _links', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody._links);
                assert.isOk(jsonBody._links.self);
                assert.equal(jsonBody._links.self.href, '/plans');
                done();
            });
        });
    });
});