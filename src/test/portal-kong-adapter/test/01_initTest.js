'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const request = require('request');
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

describe('After initialization,', function () {
    describe('portal-api', function () {
        it('should return an empty queue for kong-adapter', function (done) {
            request.get({
                url: apiUrl + 'webhooks/events/kong-adapter',
                headers: adminHeaders(WEBHOOKS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body); // Has to be array
                assert.equal(0, jsonBody.length);
                done();
            });
        });
    });

    describe('resync', function () {
        this.timeout(10000);
        this.slow(2000);
        it('should not trigger any changing actions to the Kong API', function (done) {
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

    describe('kong', function () {
        it('should have several services defined', function (done) {
            request.get({
                url: kongUrl + 'services'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                //console.log(JSON.stringify(jsonBody, null, 2));
                assert.isArray(jsonBody.data);
                assert.isOk(jsonBody.data.length > 0);
                done();
            });
        });

        it('should have several routes defined', function (done) {
            request.get({
                url: kongUrl + 'routes'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isArray(jsonBody.data);
                assert.isOk(jsonBody.data.length > 0);
                done();
            });
        });

        let brilliantId;
        it('should have a service called brilliant', function (done) {
            request.get({
                url: kongUrl + 'services/brilliant'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                brilliantId = jsonBody.id;
                done();
            });
        });

        it('should have a route attached to the service brilliant', function (done) {
            request.get({
                url: kongUrl + 'services/brilliant/routes'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const routeJson = utils.getJson(body);
                assert.isArray(routeJson.data);
                assert.isTrue(routeJson.data.length > 0);
                assert.equal(routeJson.data[0].service.id, brilliantId);
                done();
            });
        });

        let unrestrictedId;
        it('should have a service called unrestricted', function (done) {
            request.get({
                url: kongUrl + 'services/unrestricted'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                unrestrictedId = jsonBody.id;
                done();
            });
        });

        it('should have a route attached to the service unrestricted', function (done) {
            request.get({
                url: kongUrl + 'services/unrestricted/routes'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const routeJson = utils.getJson(body);
                assert.isArray(routeJson.data);
                assert.isTrue(routeJson.data.length > 0);
                assert.equal(routeJson.data[0].service.id, unrestrictedId);
                done();
            });
        });

        it('should have an API called sample-server-auth (the auth server)', function (done) {
            request.get({
                url: kongUrl + 'services/sample-server-auth'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should have three plugins for the brilliant API', function (done) {
            request.get({
                url: kongUrl + 'services/brilliant/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const plugins = utils.getJson(body);
                assert.isArray(plugins.data);
                assert.equal(3, plugins.data.length);
                done();
            });
        });

        it('should have a correct configuration of the brilliant plugins (rate-limiting, acl and key-auth)', function (done) {
            request.get({
                url: kongUrl + 'services/brilliant/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const plugins = utils.getJson(body);
                const rateLimiting = utils.findWithName(plugins.data, 'rate-limiting');
                assert.isOk(rateLimiting, 'rate-limiting is present');
                assert.isOk(rateLimiting.config.fault_tolerant, 'fault_tolerant is set'); // This is actually also a test of the update of the static config, see oct2016_updatePlugin
                const acl = utils.findWithName(plugins.data, 'acl');
                assert.isOk(acl, 'acl plugin is present');
                const keyAuth = utils.findWithName(plugins.data, 'key-auth');
                assert.isOk(keyAuth, 'key-auth is present');
                done();
            });
        });

        it('should have a correct oauth2 setting for the superduper API', function (done) {
            request.get({
                url: kongUrl + 'services/superduper/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'could not retrieve plugins');
                const plugins = utils.getJson(body);
                const oauth2 = utils.findWithName(plugins.data, 'oauth2');
                assert.isOk(oauth2, 'superduper did not have valid oauth2 plugin');
                assert.equal(1800, oauth2.config.token_expiration, 'token_expiration not set to 1800 (see config)');
                done();
            });
        });

        it('should have a correct oauth2 setting for the mobile API', function (done) {
            request.get({
                url: kongUrl + 'services/mobile/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'could not retrieve plugins');
                const plugins = utils.getJson(body);
                const oauth2 = utils.findWithName(plugins.data, 'oauth2');
                assert.isOk(oauth2, 'mobile did not have valid oauth2 plugin');
                assert.equal(3600, oauth2.config.token_expiration, 'token_expiration not set to 1800 (see config)');
                assert.isOk(oauth2.config.scopes, 'api does not have specified scopes');
                assert.equal(5002+3, oauth2.config.scopes.length, 'scope count does not match'); // Yes, we have 5002+3 scopes.
                assert.equal(false, oauth2.config.mandatory_scope, 'mandatory_scope does not match');
                done();
            });
        });

        it('should have a correct oauth2 setting for the partner API', function (done) {
            request.get({
                url: kongUrl + 'services/partner/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err, 'something went wrong when querying kong');
                assert.equal(200, res.statusCode, 'could not retrieve plugins');
                const plugins = utils.getJson(body);
                const oauth2 = utils.findWithName(plugins.data, 'oauth2');
                assert.isOk(oauth2, 'partner did not have valid oauth2 plugin');
                assert.isOk(oauth2.config.scopes, 'api does not have specified scopes');
                assert.equal(2+3, oauth2.config.scopes.length, 'scope count does not match'); // scopes + group scopes
                assert.equal(true, oauth2.config.mandatory_scope, 'mandatory_scope setting not correct');
                done();
            });
        });

        it('should have a correct uris parameter for the brilliant API (route)', function (done) {
            request.get({
                url: kongUrl + 'services/brilliant/routes'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const routeConfig = utils.getJson(body).data[0];
                assert.isOk(routeConfig.paths, 'Route did not have paths defined');
                assert.equal('/brilliant', routeConfig.paths[0], 'mismatched path');
                done();
            });
        });

        it('should have a correct strip_uri parameter for the mobile API', function (done) {
            request.get({
                url: kongUrl + 'services/mobile/routes'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const routeConfig = utils.getJson(body).data[0];
                assert.isOk(routeConfig.strip_path, 'API did not have strip_uri defined');
                assert.equal('/mobile', routeConfig.paths[0]);
                done();
            });
        });

        // These tests are obsolete - There are no consumers specifically
        // for the portal-api anymore, and the portal API is no longer exposed
        // via the "old" client credentials flow anymore, only over the generic
        // OAuth2 access.

        // describe('consumers', function () {
        //     it('should have been inserted (five)', function (done) { // see globals.json
        //         request.get({
        //             url: kongUrl + 'consumers'
        //         }, function (err, res, body) {
        //             assert.isNotOk(err);
        //             assert.equal(200, res.statusCode);
        //             const consumers = utils.getJson(body);
        //             assert.equal(5, consumers.total);
        //             done();
        //         });
        //     });

        //     it('should have an oauth2 plugin configured for the portal-api', function (done) {
        //         request.get({
        //             url: kongUrl + 'consumers/' + adminEmail + '/oauth2'
        //         }, function (err, res, body) {
        //             assert.isNotOk(err);
        //             assert.equal(200, res.statusCode);
        //             const consumerOAuth2 = utils.getJson(body);
        //             assert.equal(1, consumerOAuth2.total);
        //             assert.isOk(consumerOAuth2.data[0].client_id);
        //             assert.isOk(consumerOAuth2.data[0].client_secret);
        //             done();
        //         });
        //     });

        //     it('should have an entry to the ACL of the portal-api', function (done) {
        //         request.get({
        //             url: kongUrl + 'consumers/' + adminEmail + '/acls'
        //         }, function (err, res, body) {
        //             assert.isNotOk(err);
        //             assert.equal(200, res.statusCode);
        //             const acls = utils.getJson(body);
        //             assert.isOk(acls.data);
        //             assert.equal(1, acls.total, 'consumer has exactly one ACL entry');
        //             const portalGroup = acls.data.find(g => g.group === 'portal-api-internal');
        //             assert.isOk(portalGroup, 'consumer needs ACL group portal-api-internal');
        //             done();
        //         });
        //     });

        //     it('should still not trigger any changing actions to the Kong API', function (done) {
        //         request.post({
        //             url: adapterUrl + 'resync'
        //         }, function (err, res, body) {
        //             assert.isNotOk(err);
        //             assert.equal(200, res.statusCode, 'Resync status code not 200');
        //             const jsonBody = utils.getJson(body);
        //             assert.isOk(jsonBody.actions, 'Strange - resync response has no actions property');
        //             if (0 !== jsonBody.actions.length) {
        //                 console.log(JSON.stringify(jsonBody, 0, 2));
        //             }
        //             assert.equal(0, jsonBody.actions.length, 'There were API actions done at resync, must be empty');
        //             done();
        //         });
        //     });
        // });
    });
});
