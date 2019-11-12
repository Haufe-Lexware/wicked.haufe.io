'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const consts = require('./testConsts');
const wicked = require('wicked-sdk');
const async = require('async');
const utils = require('./testUtils');

const initOptions = {
    userAgentName: 'Test Portal Auth',
    userAgentVersion: '0.0.0',
    doNotPollConfigHash: true
};

const appId = consts.APP_ID;

describe('Basic use cases', function () {
    this.slow(1000);

    let clientId;
    let clientSecret;

    after(function (done) {
        async.series([
            callback => utils.awaitEmptyAdapterQueue(callback),
            callback => wicked.deleteApplication(appId, callback),
            callback => utils.awaitEmptyAdapterQueue(callback)
        ], done);
    });

    describe('init wicked SDK', function () {
        it('should be possible to initialize the wicked SDK', function (done) {
            wicked.initialize(initOptions, function (err) {
                assert.isNotOk(err);
                console.log('Portal API: ' + wicked.getInternalApiUrl());
                console.log('Kong Adapter: ' + wicked.getInternalKongAdapterUrl());
                console.log('Kong Admin URL: ' + wicked.getInternalKongAdminUrl());
                done();
            });
        });

        it('should be possible to add a machine user', function (done) {
            wicked.initMachineUser('test-portal-auth', function (err) {
                assert.isNotOk(err);
                done();
            });
        });

        it('should be possible to create an application', function (done) {
            wicked.createApplication({
                id: appId, name: 'Portal Auth Test', confidential: true, redirectUri: 'http://localhost:3011'
            }, function (err) {
                assert.isNotOk(err);
                done();
            });
        });

        it('should be possible to create a subscription', function (done) {
            wicked.getApiPlans('portal-api', function (err, apiPlans) {
                assert.isNotOk(err);
                const planId = apiPlans[0].id;
                wicked.createSubscription(appId, {
                    application: appId,
                    api: 'portal-api',
                    plan: planId,
                    auth: 'oauth2'
                }, function (err, subs) {
                    assert.isNotOk(err);
                    clientId = subs.clientId;
                    clientSecret = subs.clientSecret;
                    assert.isOk(clientId);
                    assert.isOk(clientSecret);
                    done();
                });
            });
        });
    }); // init wicked SDK
});
