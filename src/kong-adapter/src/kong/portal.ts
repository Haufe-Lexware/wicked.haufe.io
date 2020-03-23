'use strict';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('kong-adapter:portal');
import * as utils from './utils';
import * as wicked from 'wicked-sdk';
import { Callback, WickedApplication, WickedAuthServer, WickedError, KongPluginRequestTransformer, KongPluginCors, WickedApiPlanCollection, WickedApiPlan, WickedApiCollection, WickedApi, KongApiConfig, KongPluginRateLimiting, WickedSessionStoreType, WickedApiSettings, KongPlugin } from 'wicked-sdk';
import { ConsumerInfo, ApplicationData, ApiDescriptionCollection, ApiDescription } from './types';

const MAX_PARALLEL_CALLS = 10;
const REFRESH_API_INTERVAL = 3 * 60 * 1000; // 3 minutes

// ======== INTERFACE FUNCTIONS =======

export const portal = {
    getPortalApis: function (callback: Callback<ApiDescriptionCollection>) {
        debug('getPortalApis()');
        async.parallel({
            getApis: callback => getActualApis(callback),
            getAuthServers: callback => getAuthServerApis(callback)
        }, function (err, results) {
            if (err)
                return callback(err);

            const apiList = utils.clone(results.getApis) as WickedApiCollection;
            const authServerList = utils.clone(results.getAuthServers) as WickedAuthServer[];

            let portalHost = wicked.getInternalPortalUrl();
            if (!portalHost) {
                debug('portalUrl is not set in globals.json, defaulting to http://portal:3000');
                portalHost = 'http://portal:3000'; // Default
            }
            // Add the Swagger UI "API" for tunneling
            const swaggerApi = require('../../resources/swagger-ui.json');
            swaggerApi.config.api.upstream_url = portalHost + 'swagger-ui';
            checkApiConfig(swaggerApi.config);
            apiList.apis.push(swaggerApi);

            // And a Ping end point for monitoring            
            const pingApi = require('../../resources/ping-api.json');
            pingApi.config.api.upstream_url = portalHost + 'ping';
            checkApiConfig(pingApi.config);
            apiList.apis.push(pingApi);

            // And the auth Servers please
            for (let i = 0; i < authServerList.length; ++i) {
                // TODO: This is not nice. The property "desc" is not present in authServerList, and thus
                // it cannot be directly used as an ApiDescription object. But on the other hand, it contains
                // everything else which we need (a KongApiConfig object)
                apiList.apis.push(authServerList[i] as any as ApiDescription);
            }

            debug('getPortalApis():');
            debug(apiList);

            try {
                injectAuthPlugins(apiList);
            } catch (injectErr) {
                return callback(injectErr);
            }

            return callback(null, apiList);
        });
    },

    /**
     * This is what we want from the portal:
     *
     * [
     *    {
     *        "consumer": {
     *            "username": "my-app$petstore",
     *            "custom_id": "3476ghow89e746goihw576iger5how4576"
     *        },
     *        "plugins": {
     *            "key-auth": [
     *                { "key": "flkdfjlkdjflkdjflkdfldf" }
     *            ],
     *            "acls": [
     *                { "group": "petstore" }
     *            ],
     *            "oauth2": [
     *                { 
     *                    "name": "My Application",
     *                    "client_id": "my-app-petstore",
     *                    "client_secret": "uwortiu4eot8g7he59t87je59thoerizuoh",
     *                    "redirect_uri": ["http://dummy.org"]
     *                }
     *            ]
     *        },
     *        "apiPlugins": [
     *            {
     *                "name": "rate-limiting",
     *                "config": {
     *                    "hour": 100,
     *                    "fault_tolerant": true
     *                }
     *            }
     *        ]
     *    }
     * ]
     * 
     * One app can have multiple consumers (one per subscription).
     */
    getAppConsumers: function (appId, callback: Callback<ConsumerInfo[]>) {
        debug('getPortalConsumersForApp() ' + appId);
        const applicationList = [{ id: appId, ownerList: [], name: appId }];
        let apiPlans: WickedApiPlanCollection = null;
        let apiList: ApiDescriptionCollection = null;
        async.series({
            plans: callback => utils.getPlans(function (err, apiPlans_: WickedApiPlanCollection) {
                if (err)
                    return callback(err);
                apiPlans = apiPlans_;
                return callback(null);
            }),
            apis: callback => getActualApis(function (err, apiList_: ApiDescriptionCollection) {
                if (err)
                    return callback(err);
                apiList = apiList_;
                return callback(null);
            }),
            appConsumers: callback => enrichApplications(applicationList, apiPlans, apiList, callback)
            // (apiPlans, callback) => enrichApplications(applicationList, apiPlans, callback)
        }, function (err, results) {
            if (err)
                return callback(err);
            callback(null, results.appConsumers);
        });
    },

    getAllPortalConsumers: function (callback: Callback<ConsumerInfo[]>) {
        debug('getAllPortalConsumers()');
        return getAllAppConsumers(callback);
    },

};

// INTERNAL FUNCTIONS/HELPERS

let _actualApis: ApiDescriptionCollection = null;
let _actualApisDate = 0;
function getActualApis(callback: Callback<ApiDescriptionCollection>) {
    debug('getActualApis()');
    const now = (new Date()).getTime();
    if (now - _actualApisDate < REFRESH_API_INTERVAL) {
        if (_actualApis)
            return callback(null, _actualApis);
    }
    wicked.getApis(function (err, apiList) {
        if (err)
            return callback(err);
        // Get the group list from wicked
        const groups = utils.getGroups().groups;
        // HACK_SCOPES: Make the scope lists Kong compatible (wicked has more info than Kong)
        for (let i = 0; i < apiList.apis.length; ++i) {
            // HACK_SCOPES: This cast is needed to allow changing the scopes to a simple string array (instead of the structure wicked uses).
            const api = apiList.apis[i] as any;
            if (api.auth === 'oauth2' && api.settings) {
                if (api.settings.scopes) {
                    const newScopes = [];
                    for (let scope in api.settings.scopes) {
                        // Take only the keys.
                        newScopes.push(scope);
                    }
                    api.settings.scopes = newScopes;
                } else {
                    api.settings.scopes = [];
                }
                // Now also add the groups as scopes.
                for (let g = 0; g < groups.length; ++g) {
                    api.settings.scopes.push(`wicked:${groups[g].id}`);
                }
                // HACK_PASSTHROUGH_REFRESH: For APIs with passthrough scopes and passthrough users,
                // refresh tokens are created via the "password" grant; this means we must allow it in Kong as well.
                {
                    const _api = api as WickedApi;
                    if (_api.passthroughUsers && _api.passthroughScopeUrl) {
                        _api.settings.enable_password_grant = true;
                    }
                }
            }
        }
        // Enrich apiList with the configuration.
        async.eachLimit(apiList.apis, MAX_PARALLEL_CALLS, function (apiDef: ApiDescription, callback) {
            wicked.getApiConfig(apiDef.id, function (err, apiConfig: KongApiConfig) {
                if (err)
                    return callback(err);
                apiDef.config = checkApiConfig(apiConfig);
                return callback(null);
            });
        }, function (err) {
            if (err)
                return callback(err);
            _actualApis = apiList;
            _actualApisDate = now;
            return callback(null, apiList);
        });
    });
}

function getAuthServerApis(callback: Callback<WickedAuthServer[]>) {
    debug('getAuthServerApis()');
    wicked.getAuthServerNames(function (err, authServerNames) {
        if (err)
            return callback(err);
        async.mapLimit(authServerNames, MAX_PARALLEL_CALLS, function (authServerName, callback) {
            wicked.getAuthServer(authServerName, callback);
        }, function (err, authServers: WickedAuthServer[]) {
            if (err)
                return callback(err);
            debug(JSON.stringify(authServers, null, 2));
            // Fix auth server and API auth server IDs; also adapt
            // the upstream_url (canonicalize it).
            for (let i = 0; i < authServers.length; ++i) {
                const as = authServers[i] as WickedAuthServer;
                const id = `${authServerNames[i]}-auth`;
                as.id = id;
                if (as.config.api.hasOwnProperty('id'))
                    delete as.config.api.id;
                as.config.api.name = id;

                try {
                    const url = new URL(as.config.api.upstream_url);
                    as.config.api.upstream_url = url.toString();
                } catch (err) {
                    const msg = `getAuthServerApis(): upstream_url for auth server ${authServerNames[i]} is not a valid URL: ${as.config.api.upstream_url}`;
                    return callback(new WickedError(msg, 500));
                }

                checkApiConfig(as.config);
            }
            callback(null, authServers);
        });
    });
}

function checkApiConfig(apiConfig: KongApiConfig): KongApiConfig {
    debug('checkApiConfig()');
    if (apiConfig.plugins) {
        checkApiPlugins(apiConfig, apiConfig.plugins);
        checkCorsAndRateLimitingPlugins(apiConfig.api.name, apiConfig.plugins);
    }
    return apiConfig;
}

// Checks plugins which can only be applied on API level
function checkApiPlugins(apiConfig: KongApiConfig, plugins: KongPlugin[]): void {
    for (let i = 0; i < plugins.length; ++i) {
        const plugin = plugins[i];
        switch (plugin.name.toLowerCase()) {
            case "request-transformer":
                checkRequestTransformerPlugin(apiConfig, plugin as KongPluginRequestTransformer);
                break;
        }
    }
}

// Checks plugins which can be applied both on API and Plan level
function checkCorsAndRateLimitingPlugins(apiName: string, plugins: KongPlugin[]): void {
    for (let i = 0; i < plugins.length; ++i) {
        const plugin = plugins[i];
        switch (plugin.name.toLowerCase()) {
            case "cors":
                checkCorsPlugin(plugin as KongPluginCors);
                break;
            case "rate-limiting":
            case "response-ratelimiting":
                checkRateLimitingPlugin(apiName, plugin as KongPluginRateLimiting);
                break;
        }
    }
}


function checkRequestTransformerPlugin(apiConfig: KongApiConfig, plugin: KongPluginRequestTransformer): void {
    debug('checkRequestTransformerPlugin()');
    if (plugin.config &&
        plugin.config.add &&
        plugin.config.add.headers) {

        for (let i = 0; i < plugin.config.add.headers.length; ++i) {
            if (plugin.config.add.headers[i] == '%%Forwarded') {
                const prefix = apiConfig.api.uris;
                const proto = wicked.getSchema();
                const rawHost = wicked.getExternalApiHost();
                let host;
                let port;
                if (rawHost.indexOf(':') > 0) {
                    const splitList = rawHost.split(':');
                    host = splitList[0];
                    port = splitList[1];
                } else {
                    host = rawHost;
                    port = (proto == 'https') ? 443 : 80;
                }

                plugin.config.add.headers[i] = 'Forwarded: host=' + host + ';port=' + port + ';proto=' + proto + ';prefix=' + prefix;
            }
        }
    }
}

function checkCorsPlugin(plugin: KongPluginCors): void {
    debug('checkCorsPlugin()');
    if (plugin.config &&
        plugin.config.origins) {
        if (typeof (plugin.config.origins) === 'string') {
            warn(`Detected faulty type of CORS config.origins property, converting to array.`);
            plugin.config.origins = [plugin.config.origins];
        }
        if (typeof (plugin.config.methods) === 'string') {
            debug(`checkCorsPlugin: Converting "methods" to string array`);
            plugin.config.methods = plugin.config.methods.split(',');
        }
    }
}

function checkRateLimitingPlugin(apiName: string, plugin: KongPluginRateLimiting): void {
    const glob = wicked.getGlobals();
    if (!glob.sessionStore)
        return;
    if (glob.sessionStore.type !== WickedSessionStoreType.Redis)
        return;
    // We have a redis, let's use that for storing rate limiting information
    if (!plugin.config) {
        warn(`checkRateLimitingPlugin: Empty configuration for rate-limiting for API ${apiName}`);
        return;
    }
    if (plugin.config.redis_database) {
        info(`checkRateLimitingPlugin: Configuration for rate-limiting for API ${apiName} already contains a redis_database, not using wicked redis.`);
        return;
    }
    if (plugin.config.policy && plugin.config.policy !== 'redis') {
        warn(`checkRateLimitingPlugin: Configuration for rate-limiting for API ${apiName} explicitly contains a config.policy "${plugin.config.policy}", not using redis.`);
        return;
    }

    if (glob.sessionStore.host) {
        info(`checkRateLimitingPlugin: Applying redis caching for rate-limiting for API ${apiName}`);
        plugin.config.policy = 'redis';
        plugin.config.redis_host = glob.sessionStore.host;
        if (glob.sessionStore.port)
            plugin.config.redis_port = Number(glob.sessionStore.port);
        if (glob.sessionStore.password)
            plugin.config.redis_password = glob.sessionStore.password;
        if (!plugin.config.redis_timeout)
            plugin.config.redis_timeout = 2000; // ms
    }
}

function getAllAppConsumers(callback: Callback<ConsumerInfo[]>): void {
    debug('getAllAppConsumers()');
    async.parallel({
        apiPlans: callback => utils.getPlans(callback),
        apiList: callback => getActualApis(callback),
        applicationList: callback => wicked.getApplications({}, callback)
    }, function (err, results) {
        if (err)
            return callback(err);

        const applicationList = results.applicationList.items as WickedApplication[];
        const apiPlans = results.apiPlans as WickedApiPlanCollection;
        const apiList = results.apiList as ApiDescriptionCollection;

        enrichApplications(applicationList, apiPlans, apiList, callback);
    });
}

// Returns
// {
//    application: { id: ,... }
//    subscriptions: [ ... ]
// }
function getApplicationData(appId: string, callback: Callback<ApplicationData>): void {
    debug('getApplicationData() ' + appId);
    async.parallel({
        subscriptions: callback => wicked.getSubscriptions(appId, function (err, subsList) {
            if (err && err.status == 404) {
                // Race condition; web hook processing was not finished until the application
                // was deleted again (can normally just happen when doing automatic testing).
                error('*** Get Subscriptions: Application with ID ' + appId + ' was not found.');
                return callback(null, []); // Treat as empty
            } else if (err) {
                return callback(err);
            }
            return callback(null, subsList);
        }),
        application: callback => wicked.getApplication(appId, function (err, appInfo) {
            if (err && err.status == 404) {
                // See above.
                error('*** Get Application: Application with ID ' + appId + ' was not found.');
                return callback(null, null);
            } else if (err) {
                return callback(err);
            }
            return callback(null, appInfo);

        })
    }, function (err, results) {
        if (err)
            return callback(err);
        callback(null, results);
    });
}

function enrichApplications(applicationList: WickedApplication[], apiPlans: WickedApiPlanCollection, apiList: ApiDescriptionCollection, callback: Callback<ConsumerInfo[]>) {
    debug('enrichApplications(), applicationList = ' + utils.getText(applicationList));
    async.mapLimit(applicationList, MAX_PARALLEL_CALLS, function (appInfo, callback) {
        getApplicationData(appInfo.id, callback);
    }, function (err, results) {
        if (err)
            return callback(err);

        const consumerList = [];
        for (let resultIndex = 0; resultIndex < results.length; ++resultIndex) {
            const appInfo = results[resultIndex].application;
            const appSubsInfo = results[resultIndex].subscriptions;
            for (let subsIndex = 0; subsIndex < appSubsInfo.length; ++subsIndex) {
                const appSubs = appSubsInfo[subsIndex];
                // Only propagate approved subscriptions
                if (!appSubs.approved)
                    continue;

                let groupName = appSubs.api;
                // Check if this API is part of a bundle
                const apiDesc = apiList.apis.find(a => a.id === appSubs.api);
                if (apiDesc) {
                    // API_BUNDLE: Use bundle as group name; this will mean that access tokens/API Keys for this API
                    // will also work for any other API which is part of this bundle.
                    if (apiDesc.bundle)
                        groupName = apiDesc.bundle;
                } else {
                    warn(`enrichApplications: Could not find API configuration for API ${appSubs.api}`);
                }

                debug(utils.getText(appSubs));
                const consumerInfo: ConsumerInfo = {
                    consumer: {
                        username: utils.makeUserName(appSubs.application, appSubs.api),
                        custom_id: appSubs.id
                    },
                    plugins: {
                        acls: [{
                            group: groupName
                        }]
                    }
                };
                if ("oauth2" == appSubs.auth) {
                    let redirectUris = appInfo.redirectUris;
                    if (!redirectUris || redirectUris.length == 0)
                        redirectUris = ['https://dummy.org'];
                    consumerInfo.plugins.oauth2 = [{
                        name: appSubs.application,
                        client_id: appSubs.clientId,
                        client_secret: appSubs.clientSecret,
                        redirect_uris: redirectUris
                    }];
                } else if (!appSubs.auth || "key-auth" == appSubs.auth) {
                    consumerInfo.plugins["key-auth"] = [{
                        key: appSubs.apikey
                    }];
                } else {
                    let err2 = new Error('Unknown auth strategy: ' + appSubs.auth + ', for application "' + appSubs.application + '", API "' + appSubs.api + '".');
                    return callback(err2);
                }

                // Now the API level plugins from the Plan
                const apiPlan = getPlanById(apiPlans, appSubs.plan);
                if (!apiPlan) {
                    const err = new Error('Unknown API plan strategy: ' + appSubs.plan + ', for application "' + appSubs.application + '", API "' + appSubs.api + '".');
                    return callback(err);
                }

                if (apiPlan.config && apiPlan.config.plugins) {
                    consumerInfo.apiPlugins = utils.clone(apiPlan.config.plugins);
                }
                else {
                    consumerInfo.apiPlugins = [];
                }
                // Fix #148: Apply Redis also for ratelimiting from Plans
                checkCorsAndRateLimitingPlugins(apiDesc.name, consumerInfo.apiPlugins);

                consumerList.push(consumerInfo);
            }
        }

        debug(utils.getText(consumerList));

        return callback(null, consumerList);
    });
}

function getPlanById(apiPlans: WickedApiPlanCollection, planId: string): WickedApiPlan {
    debug('getPlanById(' + planId + ')');
    return apiPlans.plans.find(function (plan) { return (plan.id == planId); });
}

// ======== INTERNAL FUNCTIONS =======

function injectAuthPlugins(apiList: ApiDescriptionCollection) {
    debug('injectAuthPlugins()');
    for (let i = 0; i < apiList.apis.length; ++i) {
        const thisApi = apiList.apis[i];
        if (!thisApi.auth ||
            "none" == thisApi.auth)
            continue;
        if ("key-auth" == thisApi.auth)
            injectKeyAuth(thisApi);
        else if ("oauth2" == thisApi.auth)
            injectOAuth2Auth(thisApi);
        else
            throw new Error("Unknown 'auth' setting: " + thisApi.auth);
    }
}

function injectKeyAuth(api: ApiDescription): ApiDescription {
    debug('injectKeyAuth()');
    if (!api.config.plugins)
        api.config.plugins = [];
    const plugins = api.config.plugins;
    const keyAuthPlugin = plugins.find(function (plugin) { return plugin.name == "key-auth"; });
    if (keyAuthPlugin)
        throw new Error("If you use 'key-auth' in the apis.json, you must not provide a 'key-auth' plugin yourself. Remove it and retry.");
    const aclPlugin = plugins.find(function (plugin) { return plugin.name == 'acl'; });
    if (aclPlugin)
        throw new Error("If you use 'key-auth' in the apis.json, you must not provide a 'acl' plugin yourself. Remove it and retry.");

    let hide_credentials = false;
    if (api.config.api.hide_credentials)
        hide_credentials = api.config.api.hide_credentials;

    plugins.push({
        name: 'key-auth',
        enabled: true,
        config: {
            hide_credentials: hide_credentials,
            key_names: [wicked.getApiKeyHeader()]
        }
    });
    // API_BUNDLE: Is this API part of a bundle? If so, use the bundle name as the group name
    let groupName = api.bundle ? api.bundle : api.id;
    debug(`injectKeyAuth: Using ACL group name ${groupName}`);
    plugins.push({
        name: 'acl',
        enabled: true,
        config: {
            whitelist: [groupName]
        }
    });
    return api;
}

function injectOAuth2Auth(api: ApiDescription): void {
    debug('injectOAuth2Auth()');
    if (!api.config.plugins)
        api.config.plugins = [];
    const plugins = api.config.plugins;
    //console.log(JSON.stringify(plugins, null, 2));
    const oauth2Plugin = plugins.find(function (plugin) { return plugin.name == "oauth2"; });
    if (oauth2Plugin)
        throw new Error("If you use 'oauth2' in the apis.json, you must not provide a 'oauth2' plugin yourself. Remove it and retry.");
    const aclPlugin = plugins.find(function (plugin) { return plugin.name == 'acl'; });
    if (aclPlugin)
        throw new Error("If you use 'oauth2' in the apis.json, you must not provide a 'acl' plugin yourself. Remove it and retry.");

    let scopes = [];
    let mandatory_scope = false;
    let token_expiration = 3600;
    let enable_client_credentials = false;
    let enable_implicit_grant = false;
    let enable_authorization_code = false;
    let enable_password_grant = false;
    let hide_credentials = false;
    if (api.settings) {
        // Check overridden defaults
        if (api.settings.scopes)
            scopes = api.settings.scopes as any; // This is correct; this is a hack further above. Search for "HACK_SCOPES"
        if (api.settings.mandatory_scope)
            mandatory_scope = api.settings.mandatory_scope;
        if (api.settings.token_expiration)
            token_expiration = Number(api.settings.token_expiration);
        if (api.settings.enable_client_credentials)
            enable_client_credentials = api.settings.enable_client_credentials;
        if (api.settings.enable_implicit_grant)
            enable_implicit_grant = api.settings.enable_implicit_grant;
        if (api.settings.enable_authorization_code)
            enable_authorization_code = api.settings.enable_authorization_code;
        if (api.settings.enable_password_grant)
            enable_password_grant = api.settings.enable_password_grant;
        if (api.config.api.hide_credentials)
            hide_credentials = api.config.api.hide_credentials;
    }

    // API_BUNDLE: In case the API is part of a bundle, specify that it's using global credentials.
    // This is a semi-nice hack for now; it means all APIs which are part of a bundle (any bundle!)
    // will also share the token.
    let globalCredentials = false;
    if (api.bundle)
        globalCredentials = true;

    const pluginConfig: any = {
        scopes: scopes,
        mandatory_scope: mandatory_scope,
        token_expiration: token_expiration,
        enable_authorization_code: enable_authorization_code,
        enable_client_credentials: enable_client_credentials,
        enable_implicit_grant: enable_implicit_grant,
        enable_password_grant: enable_password_grant,
        hide_credentials: hide_credentials,
        accept_http_if_already_terminated: true,
        global_credentials: globalCredentials
    }

    // Don't specify if not set; defaults to 2 weeks
    if (api.settings.refresh_token_ttl)
        pluginConfig.refresh_token_ttl = api.settings.refresh_token_ttl;

    plugins.push({
        name: 'oauth2',
        enabled: true,
        config: pluginConfig
    });    // API_BUNDLE: Is this API part of a bundle? If so, use the bundle name as the group name
    let groupName = api.bundle ? api.bundle : api.id;
    debug(`injectOAuth2Auth: Using ACL group name ${groupName}`);
    plugins.push({
        name: 'acl',
        enabled: true,
        config: {
            whitelist: [groupName]
        }
    });
}
