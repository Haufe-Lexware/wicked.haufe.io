'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow, URL */

const assert = require('chai').assert;
const async = require('async');
const wicked = require('wicked-sdk');
const utils = require('./testUtils');

describe('Client Credentials', function () {

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

    it('should have a default setting of "none" as allowed scopes', function (done) {
        wicked.getSubscriptionByClientId(ids.confidential.echo_client_credentials.clientId, 'echo-client-credentials', function (err, apiSub) {
            // console.log(JSON.stringify(apiSub, null, 2));
            assert.isNotOk(err);
            assert.equal(apiSub.subscription.allowedScopesMode, 'none');
            assert.isArray(apiSub.subscription.allowedScopes);
            assert.equal(apiSub.subscription.allowedScopes.length, 0);
            done();
        });
    });

    it('should be possible to get a token via the client credentials', function (done) {
        utils.authPost('local/api/echo-client-credentials/token', {
            grant_type: 'client_credentials',
            client_id: ids.confidential.echo_client_credentials.clientId,
            client_secret: ids.confidential.echo_client_credentials.clientSecret
        }, null, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            assert.isObject(body);
            assert.isDefined(body.access_token);
            assert.isDefined(body.expires_in);
            done();
        });
    });

    it('should be possible to get a token with a scope via the client credentials, but with empty scope', function (done) {
        utils.authPost('local/api/echo-client-credentials/token', {
            grant_type: 'client_credentials',
            scope: 'get put',
            client_id: ids.confidential.echo_client_credentials.clientId,
            client_secret: ids.confidential.echo_client_credentials.clientSecret
        }, null, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            assert.isObject(body);
            assert.isDefined(body.access_token);
            assert.isDefined(body.expires_in);
            assert.isDefined(body.scope);
            assert.equal(body.scope, '');
            done();
        });
    });

    it('should be possible to restrict scopes for the client credentials', function (done) {
        async.series([
            callback => wicked.patchSubscription('portal-auth-test-confidential', 'echo-client-credentials', { allowedScopesMode: 'select', allowedScopes: ['get', 'put'] }, callback),
            callback => utils.awaitEmptyAdapterQueue(callback)
        ], function (err) {
            assert.isNotOk(err);
            utils.authPost('local/api/echo-client-credentials/token', {
                grant_type: 'client_credentials',
                scope: 'get put patch delete',
                client_id: ids.confidential.echo_client_credentials.clientId,
                client_secret: ids.confidential.echo_client_credentials.clientSecret
            }, null, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(body);
                assert.isDefined(body.access_token);
                assert.isDefined(body.expires_in);
                assert.isDefined(body.scope);
                assert.equal(body.scope, 'get put');
                done();
            });
        });
    });
});
