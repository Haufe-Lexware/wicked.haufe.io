'use strict';

import * as request from 'request';
import { StatusError, makeError } from '../common/utils-fail';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:kong-utils');
import * as wicked from 'wicked-sdk';

import { utils } from '../common/utils';

import { Callback, WickedApi, KongPlugin, KongCollection, KongRoute, KongService, KongPluginOAuth2, KongConsumer } from 'wicked-sdk';

function kongAction(method, url, body, expectedStatusCode, callback) {
    //console.log('$$$$$$ kongAction: ' + method + ' ' + url);
    //console.log(body);
    debug('kongAction(), ' + method + ', ' + url);

    // If for some reason, we think Kong is not available, tell the upstream
    // if (!utils._kongAvailable) {
    //     const err = new Error('kong admin end point not available: ' + utils._kongMessage);
    //     err.status = 500;
    //     return callback(err);
    // }

    // Now do our thing
    var kongUrl = wicked.getInternalKongAdminUrl();
    var methodBody = {
        method: method,
        url: kongUrl + url,
        json: null,
        body: null
    };
    if (method != 'DELETE' &&
        method != 'GET') {
        methodBody.json = true;
        methodBody.body = body;
        if (process.env.KONG_CURL)
            console.error('curl -X ' + method + ' -d \'' + JSON.stringify(body) + '\' -H \'Content-Type: application/json\' ' + methodBody.url);
    } else {
        if (process.env.KONG_CURL)
            console.error('curl -X ' + method + ' ' + methodBody.url);
    }

    request(methodBody, function (err, apiResponse, apiBody) {
        if (err)
            return callback(err);
        if (expectedStatusCode != apiResponse.statusCode) {
            const err = new StatusError(apiResponse.statusCode, 'kongAction ' + method + ' on ' + url + ' did not return the expected status code (got: ' + apiResponse.statusCode + ', expected: ' + expectedStatusCode + ').');
            debug(method + ' /' + url);
            debug(methodBody);
            debug(apiBody);
            //console.error(apiBody);
            return callback(err);
        }
        if (apiResponse.statusCode === 204) {
            // Don't try to convert "No content" to JSON; that won't work.
            return callback(null, {});
        }
        try {
            const jsonBody = utils.getJson(apiBody);
            return callback(null, jsonBody);
        } catch (err) {
            error(err);
            error(apiBody);
            return callback(err);
        }
    });
}

export const kongUtils = {

    kongGet: function (url, callback) {
        kongAction('GET', url, null, 200, callback);
    },

    // kongPost: function (url, body, callback) {
    //     kongAction('POST', url, body, 201, callback);
    // },

    kongDelete: function (url, callback) {
        kongAction('DELETE', url, null, 204, callback);
    },

    // kongPatch: function (url, body, callback) {
    //     kongAction('PATCH', url, body, 200, callback);
    // },

    kongGetApi: function (apiId, callback) {
        kongGetService(apiId, function (err, service) {
            if (err)
                return callback(err);
            kongGetRouteForService(apiId, function (err, route) {
                if (err)
                    return callback(err);
                return callback(null, wicked.kongServiceRouteToApi(service, route));
            });
        });
    },

    kongGetApiOAuth2Plugins: function (apiId, callback: Callback<KongCollection<KongPlugin>>) {
        kongUtils.kongGet('services/' + apiId + '/plugins', function (err, result) {
            if (err)
                return callback(err);
            if (!result.data)
                return callback(new Error(`kongGetApiOAuth2Plugins did not retrieve plugins for API ${apiId}`));
            const oauth2Plugins = result.data.filter(p => p.name === 'oauth2');
            if (oauth2Plugins.length <= 0)
                return callback(new Error(`kongGetApiOAuth2Plugins did not find oauth2 plugin for API ${apiId}`));
            return callback(null, {
                data: oauth2Plugins,
                next: null
            });
        });
    },

    lookupApiAndApplicationFromKongCredentialAsync: async function (kongCredentialId: string): Promise<{ apiId: string, applicationId: string }> {
        return new Promise<{ apiId: string, applicationId: string }>(function (resolve, reject) {
            kongUtils.lookupApiAndApplicationFromKongCredential(kongCredentialId, function (err, data) {
                err ? reject(err) : resolve(data);
            });
        })
    },

    lookupApiAndApplicationFromKongCredential(kongCredentialId: string, callback: Callback<{ apiId: string, applicationId: string }>): void {
        debug(`lookupApiAndApplicationFromKongCredential(${kongCredentialId})`);
        kongUtils.kongGet(`oauth2?id=${kongCredentialId}`, function (err, kongCredentials: KongCollection<KongPluginOAuth2>) {
            if (err)
                return callback(err);
            if (kongCredentials.data.length !== 1)
                return callback(makeError('Could not retrieve credential object for credential ID from Kong.', 500));
            const kongCredential = kongCredentials.data[0];
            const consumerId = kongCredential.consumer && kongCredential.consumer.id;
            if (!consumerId)
                return callback(makeError('Could not retrieve consumer by credential from Kong.', 500));
            kongUtils.kongGet(`consumers/${consumerId}`, function (err, kongConsumer: KongConsumer) {
                if (err)
                    return callback(err);
                if (!kongConsumer)
                    return callback(makeError(`Could not retrieve consumer with ID ${consumerId}`, 500));
                const consumerName = kongConsumer.username;
                if (!consumerName)
                    return callback(makeError(`Kong consumer with ID ${consumerId} does not have a valid username property`, 500));
                const dollarPos = consumerName.indexOf('$');
                if (dollarPos < 0)
                    return callback(makeError(`Kong consumer with ID ${consumerId} has an invalid username property "${consumerName}".`, 500))
                // "<application id>$<api id>"
                const apiId = consumerName.substring(dollarPos + 1);
                const applicationId = consumerName.substring(0, dollarPos);
                return callback(null, {
                    apiId,
                    applicationId
                });
            });
        });
    },

    lookupApiFromKongCredentialAsync: async function (kongCredentialId: string): Promise<WickedApi> {
        return new Promise<WickedApi>(function (resolve, reject) {
            kongUtils.lookupApiFromKongCredential(kongCredentialId, function (err, data) {
                err ? reject(err) : resolve(data);
            });
        })
    },

    lookupApiFromKongCredential(kongCredentialId: string, callback: Callback<WickedApi>): void {
        debug(`lookupApiFromKongCredential(${kongCredentialId})`);
        kongUtils.lookupApiAndApplicationFromKongCredential(kongCredentialId, function (err, { apiId, applicationId }) {
            if (err)
                return callback(err);
            return utils.getApiInfo(apiId, callback);
        });
    }
};

function kongGetService(serviceId, callback: Callback<KongService>): void {
    kongUtils.kongGet(`services/${serviceId}`, callback);
}

function kongGetRouteForService(serviceId: string, callback: Callback<KongRoute>): void {
    kongUtils.kongGet(`services/${serviceId}/routes`, function (err, routes: KongCollection<KongRoute>) {
        if (err)
            return callback(err);
        if (routes.data.length === 0)
            return callback(null, null);
        if (routes.data.length === 1)
            return callback(null, routes.data[0]);
        warn(`kongGetRouteForService(${serviceId}): Multiple routes found, returning the first one.`);
        return callback(null, routes.data[0]);
    });
}
