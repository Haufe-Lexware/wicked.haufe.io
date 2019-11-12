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

const keyAuthApi = 'brilliant';
const oauth2Api = 'superduper';

const adapterQueue = 'kong-adapter';

function kongConsumer(appId, apiId) {
    return appId + '$' + apiId;
}

describe('With subscriptions,', function () {

    this.timeout(10000); // These things can take a while to do.
    this.slow(2500); // But usually not much longer than this

    describe('the kong adapter', function () {

        const appId = 'some-app';
        const appName = 'Some Application';

        beforeEach(function (done) {
            utils.createApplication(appId, appName, devUserId, done);
        });

        afterEach(function (done) {
            async.series([
                callback => utils.deleteApplication(appId, devUserId, callback),
                callback => utils.awaitEmptyQueue(adapterQueue, adminUserId, callback)
            ], done);
        });

        it('should write API keys correctly', function (done) {
            const consumer = kongConsumer(appId, keyAuthApi);
            utils.addSubscription(appId, devUserId, keyAuthApi, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                utils.awaitEmptyQueue(adapterQueue, adminUserId, function (err) {
                    assert.isNotOk(err, 'Waiting for empty queue failed: ' + err);
                    async.series({
                        getConsumer: callback => utils.kongGet('consumers/' + consumer, callback),
                        getAcls: callback => utils.kongGet('consumers/' + consumer + '/acls', callback),
                        getKeyAuth: callback => utils.kongGet('consumers/' + consumer + '/key-auth', callback)
                    }, function (err, results) {
                        assert.isNotOk(err);
                        const kongConsumer = results.getConsumer.body;
                        assert.isOk(kongConsumer);
                        const kongAcls = results.getAcls.body;
                        assert.isOk(kongAcls.total >= 1, 'consumer must have an ACL group');
                        assert.equal(kongAcls.data[0].group, keyAuthApi, 'consumer ACL must match API name');
                        const kongKeyAuth = results.getKeyAuth.body;
                        assert.isOk(kongKeyAuth.total >= 1, 'consumer must have key-auth setting');
                        assert.equal(kongKeyAuth.data[0].key, subsInfo.apikey, 'API keys must match');
                        done();
                    });
                });
            });
        });

        it('resync with subscription should not change anything', function (done) {
            const consumer = kongConsumer(appId, keyAuthApi);
            utils.addSubscription(appId, devUserId, keyAuthApi, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                utils.awaitEmptyQueue(adapterQueue, adminUserId, function (err) {
                    assert.isNotOk(err, 'Waiting for empty queue failed: ' + err);
                    request.post({
                        url: adapterUrl + 'resync'
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode, 'Resync status code not 200');
                        const jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.actions, 'Strange - resync response has no actions property');
                        if (0 !== jsonBody.actions.length) {
                            console.log(JSON.stringify(jsonBody, 0, 2));
                        }
                        assert.equal(0, jsonBody.actions.length, 'There were API actions done at resync, must be empty');
                        done();
                    });
                });
            });
        });


        // After each, the application is deleted and re-added; should remove subscriptions
        it('should clean up keys after deleting an application', function (done) {
            const consumer = kongConsumer(appId, keyAuthApi);
            utils.awaitEmptyQueue(adapterQueue, adminUserId, function (err) {
                assert.isNotOk(err, 'Waiting for empty queue failed: ' + err);
                utils.kongGet('consumers/' + consumer, 404, function (err, apiRes) {
                    assert.isNotOk(err);
                    assert.equal(apiRes.res.statusCode, 404);
                    done();
                });
            });
        });

        it('should clean up keys after deleting a subscription', function (done) {
            const consumer = kongConsumer(appId, keyAuthApi);
            async.series({
                subsInfo: callback => utils.addSubscription(appId, devUserId, keyAuthApi, 'basic', null, callback),
                queue1: callback => utils.awaitEmptyQueue(adapterQueue, adminUserId, callback),
                kongConsumer: callback => utils.kongGet('consumers/' + consumer, callback),
                deleteSubs: callback => utils.deleteSubscription(appId, devUserId, keyAuthApi, callback),
                queue2: callback => utils.awaitEmptyQueue(adapterQueue, adminUserId, callback),
                noConsumer: callback => utils.kongGet('consumers/' + consumer, 404, callback)
            }, function (err, results) {
                assert.isNotOk(err, 'one of the steps failed.' + err);
                assert.isOk(results.kongConsumer, 'a Kong consumer was created for the subscription');
                assert.isOk(results.noConsumer, 'a valid response was returned after deleting subscrption');
                assert.equal(404, results.noConsumer.res.statusCode);
                done();
            });
        });

        it('should write client ID and secret correctly', function (done) {
            const consumer = kongConsumer(appId, oauth2Api);
            async.series({
                addSubs: callback => utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, callback),
                queue1: callback => utils.awaitEmptyQueue(adapterQueue, adminUserId, callback),
                getConsumer: callback => utils.kongGet('consumers/' + consumer, callback),
                getAcls: callback => utils.kongGet('consumers/' + consumer + '/acls', callback),
                getOAuth2: callback => utils.kongGet('consumers/' + consumer + '/oauth2', callback)
            }, function (err, results) {
                assert.isNotOk(err);
                const subsInfo = results.addSubs;
                assert.isOk(subsInfo);
                const kongConsumer = results.getConsumer.body;
                assert.isOk(kongConsumer);
                const kongAcls = results.getAcls.body;
                assert.isOk(kongAcls.total >= 1, 'consumer must have an ACL group');
                assert.equal(kongAcls.data[0].group, oauth2Api, 'consumer ACL must match API name');
                const kongOAuth2 = results.getOAuth2.body;
                assert.isOk(kongOAuth2.total >= 1, 'consumer must have oauth2 setting');
                assert.equal(kongOAuth2.data[0].client_id, subsInfo.clientId, 'client_id must match');
                assert.equal(kongOAuth2.data[0].client_secret, subsInfo.clientSecret, 'client_secret must match');
                done();
            });
        });

        it('should not trigger changes at resync for client id and secret either', function (done) {
            const consumer = kongConsumer(appId, oauth2Api);
            async.series({
                addSubs: callback => utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, callback),
                queue1: callback => utils.awaitEmptyQueue(adapterQueue, adminUserId, callback)
            }, function (err, results) {
                assert.isNotOk(err, 'Waiting for empty queue failed: ' + err);
                request.post({
                    url: adapterUrl + 'resync'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Resync status code not 200');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.actions, 'Strange - resync response has no actions property');
                    if (0 !== jsonBody.actions.length) {
                        console.log(JSON.stringify(jsonBody, 0, 2));
                    }
                    assert.equal(0, jsonBody.actions.length, 'There were API actions done at resync, must be empty');
                    done();
                });
            });
        });
    });
});