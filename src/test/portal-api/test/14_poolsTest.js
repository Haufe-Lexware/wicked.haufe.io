'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

describe('/pools', () => {
    it('must return a list of pool definitions', (done) => {
        request.get({
            url: baseUrl + 'pools'
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode, 'Unexpected status code');
            const jsonBody = utils.getJson(body);
            assert.isOk(jsonBody.wicked);
            assert.isOk(jsonBody.woo);
            done();
        });
    });

    describe('/{poolId}', () => {
        it('must return a single pool', (done) => {
            request.get({
                url: baseUrl + 'pools/wicked'
            }, (err, res, body) => {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'Unexpected status code');
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.id);
                assert.equal(jsonBody.id, 'wicked', 'Strange mismatch in name');
                done();
            });
        });

        it('must return a 400 if a bad pool ID is used', (done) => {
            request.get({
                url: baseUrl + 'pools/ünvalüd'
            }, (err, res, body) => {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode, 'Unexpected status code');
                done();
            });
        });

        it('must return a 404 if a pool is not defined', (done) => {
            request.get({
                url: baseUrl + 'pools/bad-pool-id'
            }, (err, res, body) => {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode, 'Unexpected status code');
                done();
            });
        });
    });
});