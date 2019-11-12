'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const request = require('request');
const async = require('async');
const utils = require('./testUtils');
const consts = require('./testConsts');

const adapterUrl = consts.KONG_ADAPTER_URL;
const kongUrl = consts.KONG_ADMIN_URL;
const apiUrl = consts.BASE_URL;

const adminUserId = '1'; // See test-config/globals.json
const adminEmail = 'foo@bar.com';
const devUserId = '11'; // Fred Flintstone
const devEmail = 'fred@flintstone.com';

function adminHeaders(scope) {
    return utils.makeHeaders(adminUserId, scope);
}

const WEBHOOKS_SCOPE = 'webhooks';

async function deleteApiObject(apiName, done) {

}

function addApiObject(apiName, done) {
    const addIt = (callback) => request.post({
        url: consts.KONG_ADMIN_URL + 'apis',
        json: true,
        body: {
            name: apiName,
            upstream_url: 'http://mockbin.com',
            uris: ['/' + apiName]
        }
    }, function (err, res, body) {
        assert.isNotOk(err);
        assert.equal(res.statusCode, 201);
        callback(null);
    });

    const deleteIt = (callback) => {
        request.delete({
            url: consts.KONG_ADMIN_URL + 'apis/' + apiName
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 204);
            callback(null);
        });
    };

    request.get({
        url: consts.KONG_ADMIN_URL + 'apis/' + apiName
    }, function (err, res, body) {
        if (res.statusCode === 200)
            return deleteIt(() => addIt(done));
        return addIt(done);
    });
}

function addApiObjects(done) {
    async.series([
        callback => addApiObject('some-api', callback),
        callback => addApiObject('another', callback)
    ], done);
}

describe('With legacy /api objects,', function () {

    before(addApiObjects);

    it('should clean up old /api objects at initialization', function (done) {
        request.post({
            url: adapterUrl + 'resync'
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode, 'Resync status code not 200');
            request.get({
                uri: consts.KONG_ADMIN_URL + 'apis'
            }, function (err, res, body) {
                assert.isNotOk(err);
                const jsonBody = utils.getJson(body);
                assert.equal(jsonBody.total, 0);
                assert.isArray(jsonBody.data);
                assert.equal(jsonBody.data.length, 0);
                done();
            });
        });
    });
});
