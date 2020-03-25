'use strict';

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

        beforeEach(async function () {
            await utils.createApplicationAsync(appId, appName, devUserId);
        });

        afterEach(async function () {
            await utils.deleteApplicationAsync(appId, devUserId);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
        });

        it('should write API keys correctly', async function () {
            const consumer = kongConsumer(appId, keyAuthApi);
            const subsInfo = await utils.addSubscriptionAsync(appId, devUserId, keyAuthApi, 'basic', null);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            const kongConsumerInfo = (await utils.kongGetAsync('consumers/' + consumer)).body;
            assert.isOk(kongConsumerInfo);
            const kongAcls = (await utils.kongGetAsync('consumers/' + consumer + '/acls')).body;
            assert.isArray(kongAcls.data);
            assert.isOk(kongAcls.data.length >= 1, 'consumer must have an ACL group');
            assert.equal(kongAcls.data[0].group, keyAuthApi, 'consumer ACL must match API name');
            const kongKeyAuth = (await utils.kongGetAsync('consumers/' + consumer + '/key-auth')).body;
            assert.isArray(kongKeyAuth.data);
            assert.isOk(kongKeyAuth.data.length >= 1, 'consumer must have key-auth setting');
            assert.equal(kongKeyAuth.data[0].key, subsInfo.apikey, 'API keys must match');
        });

        it('resync with subscription should not change anything', async function () {
            const consumer = kongConsumer(appId, keyAuthApi);
            await utils.addSubscriptionAsync(appId, devUserId, keyAuthApi, 'basic', null);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            // console.log('================== GET /consumers');
            // console.log(JSON.stringify((await utils.kongGetAsync(`consumers`, 200)).body, null, 2));
            // console.log(`================== GET /services/${keyAuthApi}/plugins`);
            // console.log(JSON.stringify((await utils.kongGetAsync(`services/${keyAuthApi}/plugins`, 200)).body, null, 2));
            const jsonBody = await utils.resyncAsync();
            assert.isOk(jsonBody.actions, 'Strange - resync response has no actions property');
            if (0 !== jsonBody.actions.length) {
                console.log(JSON.stringify(jsonBody, 0, 2));
            }
            assert.equal(0, jsonBody.actions.length, 'There were API actions done at resync, must be empty');
        });

        // After each, the application is deleted and re-added; should remove subscriptions
        it('should clean up keys after deleting an application', async function () {
            const consumer = kongConsumer(appId, keyAuthApi);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            const apiRes = await utils.kongGetAsync('consumers/' + consumer, 404);
            assert.equal(apiRes.res.statusCode, 404);
        });

        it('should clean up keys after deleting a subscription', async function () {
            const consumer = kongConsumer(appId, keyAuthApi);
            await utils.addSubscriptionAsync(appId, devUserId, keyAuthApi, 'basic', null);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            const kongConsumerInfo = await utils.kongGetAsync('consumers/' + consumer);
            await utils.deleteSubscriptionAsync(appId, devUserId, keyAuthApi);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            const noConsumer = await utils.kongGetAsync('consumers/' + consumer, 404);
            assert.isOk(kongConsumerInfo, 'a Kong consumer was created for the subscription');
            assert.isOk(noConsumer, 'a valid response was returned after deleting subscription');
            assert.equal(404, noConsumer.res.statusCode);
        });

        it('should write client ID and secret correctly', async function () {
            const consumer = kongConsumer(appId, oauth2Api);
            const subsInfo = await utils.addSubscriptionAsync(appId, devUserId, oauth2Api, 'basic', null);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            assert.isOk(subsInfo);
            const kongConsumerInfo = (await utils.kongGetAsync('consumers/' + consumer)).body;
            assert.isOk(kongConsumerInfo);
            const kongAcls = (await utils.kongGetAsync('consumers/' + consumer + '/acls')).body;
            assert.isArray(kongAcls.data);
            assert.isNull(kongAcls.next);
            assert.isOk(kongAcls.data.length >= 1, 'consumer must have an ACL group');
            assert.equal(kongAcls.data[0].group, oauth2Api, 'consumer ACL must match API name');
            const kongOAuth2 = (await utils.kongGetAsync('consumers/' + consumer + '/oauth2')).body;
            assert.isArray(kongOAuth2.data);
            assert.isOk(kongOAuth2.data.length >= 1, 'consumer must have oauth2 setting');
            assert.equal(kongOAuth2.data[0].client_id, subsInfo.clientId, 'client_id must match');
            assert.equal(kongOAuth2.data[0].client_secret, subsInfo.clientSecret, 'client_secret must match');
        });

        it('should not trigger changes at resync for client id and secret either (async version)', async function () {
            const consumer = kongConsumer(appId, oauth2Api);
            await utils.addSubscriptionAsync(appId, devUserId, oauth2Api, 'basic', null);
            await utils.awaitEmptyQueueAsync(adapterQueue, adminUserId);
            // console.log(`======== GET consumers/${consumer}`);
            // console.log(JSON.stringify((await utils.kongGetAsync(`consumers/${consumer}`, 200)).body, null, 2));
            // console.log(`======== GET consumers/${consumer} DONE`);
            // console.log(`======== GET services/${oauth2Api}/plugins`);
            // console.log(JSON.stringify((await utils.kongGetAsync(`services/${oauth2Api}/plugins`, 200)).body, null, 2));
            // console.log(`======== GET services/${oauth2Api}/plugins DONE`);
            const jsonBody = await utils.resyncAsync();
            assert.isOk(jsonBody.actions, 'Strange - resync response has no actions property');
            if (0 !== jsonBody.actions.length) {
                console.log(JSON.stringify(jsonBody, 0, 2));
            }
            assert.equal(0, jsonBody.actions.length, 'There were API actions done at resync, must be empty');
        });
    });
});