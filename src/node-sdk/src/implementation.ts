'use strict';

import { WickedInitOptions, Callback, WickedGlobals, WickedGetOptions, WickedGetCollectionOptions, WickedAwaitOptions, WickedUserInfo, ErrorCallback, WickedSubscriptionInfo } from "./interfaces";
import { WickedError } from "./wicked-error";

import * as async from 'async';
import * as semver from 'semver';

/** @hidden */
const os = require('os');
/** @hidden */
const request = require('request');
/** @hidden */
const containerized = require('containerized');
/** @hidden */
const debug = require('debug')('wicked-sdk');
/** @hidden */
const qs = require('querystring');

/** @hidden */
const isLinux = (os.platform() === 'linux');
/** @hidden */
const isContainerized = isLinux && containerized();

const WICKED_TIMEOUT = 10000; // request timeout for wicked API operations
const TRYGET_TIMEOUT = 5000; // request timeout for single calls in awaitUrl

// ====== VARIABLES ======

/** @hidden */
const EMPTY_STORAGE = {
    initialized: false,
    kongAdapterInitialized: false,
    machineUserId: null,
    apiUrl: null,
    globals: null,
    configHash: null,
    userAgent: null,
    pendingExit: false,
    apiReachable: false,
    isPollingApi: false,
    // This field will not necessarily be filled.
    apiVersion: null,
    isV012OrHigher: false,
    isV100OrHigher: false,
    portalApiScope: null,
    apiMaxTries: 10,
    apiRetryDelay: 500
};

/**
 * Use this for local caching of things. Usually just the globals.
 * The apiUrl will - after initialization - contain the URL which
 * was used to access the portal API with. 
 * @hidden
 */
let wickedStorage = _clone(EMPTY_STORAGE);

/**
 * This is used for passing the correlation ID from the correlation handler.
 * @hidden
 */
export const requestRuntime = {
    correlationId: null
};

// ====================
// INTERNAL TYPES
// ====================

/** @hidden */
interface RequestBody {
    method: string,
    url: string,
    headers?: {
        [headerName: string]: string
    }
    timeout?: number,
    json?: boolean,
    body?: any
}

// ======= IMPLEMENTATION ======

/** @hidden */
export function _initialize(options: WickedInitOptions, callback?: Callback<WickedGlobals>) {
    debug('initialize()');
    if (!callback && (typeof (options) === 'function')) {
        callback = options;
        options = null;
    }

    const func = _initialize;
    if (!callback) {
        return new Promise(function (resolve, reject) {
            func(options, function (err, g) {
                err ? reject(err) : resolve(g);
            });
        });
    }

    // Reset the storage when (re-)initializing
    wickedStorage = _clone(EMPTY_STORAGE);

    if (options) {
        debug('options:');
        debug(options);

        if (options.apiMaxTries) {
            wickedStorage.apiMaxTries = options.apiMaxTries;
            wickedStorage.apiRetryDelay = options.apiRetryDelay;
        }
    }

    const validationError = validateOptions(options);
    if (validationError) {
        return callback(validationError);
    }

    // I know, this would look a lot nicer with async or Promises,
    // but I did not want to pull in additional dependencies.
    const apiUrl = resolveApiUrl();
    debug('Awaiting portal API at ' + apiUrl);
    _awaitUrl(apiUrl + 'ping', options, function (err, pingResult) {
        if (err) {
            debug('awaitUrl returned an error:');
            debug(err);
            return callback(err);
        }

        debug('Ping result:');
        debug(pingResult);
        const pingJson = getJson(pingResult);
        if (pingJson.version) {
            // The version field is not filled until wicked 0.12.0
            wickedStorage.apiVersion = pingJson.version;
            wickedStorage.isV012OrHigher = true;
            if (pingJson.version >= '1.0.0') {
                wickedStorage.isV100OrHigher = true;
            }
        }

        wickedStorage.apiUrl = apiUrl;
        if (options.userAgentName && options.userAgentVersion)
            wickedStorage.userAgent = options.userAgentName + '/' + options.userAgentVersion;
        request.get({
            url: apiUrl + 'confighash',
            timeout: WICKED_TIMEOUT
        }, function (err, res, body) {
            if (err) {
                debug('GET /confighash failed.');
                debug(err);
                return callback(err);
            }

            if (200 != res.statusCode) {
                debug('GET /confighash returned status code: ' + res.statusCode);
                debug('Body: ' + body);
                return callback(new Error('GET /confighash returned unexpected status code: ' + res.statusCode + ' (Body: ' + body + ')'));
            }

            wickedStorage.configHash = '' + body;

            request.get({
                url: apiUrl + 'globals',
                headers: {
                    'User-Agent': wickedStorage.userAgent,
                    'X-Config-Hash': wickedStorage.configHash
                },
                timeout: WICKED_TIMEOUT
            }, function (err, res, body) {
                if (err) {
                    debug('GET /globals failed');
                    debug(err);
                    return callback(err);
                }
                if (res.statusCode !== 200) {
                    debug('GET /globals returned status code ' + res.statusCode);
                    return callback(new Error('GET /globals return unexpected error code: ' + res.statusCode));
                }

                let globals = null;
                try {
                    globals = getJson(body);
                    wickedStorage.globals = globals;
                    wickedStorage.initialized = true;
                    wickedStorage.apiReachable = true;
                } catch (ex) {
                    return callback(new Error('Parsing globals failed: ' + ex.message));
                }

                // Success, set up config hash checker loop (if not switched off)
                if (!options.doNotPollConfigHash) {
                    wickedStorage.isPollingApi = true;
                    setInterval(checkConfigHash, 10000);
                }

                return callback(null, globals);
            });
        });
    });
}

/** @hidden */
function _clone(o) {
    return JSON.parse(JSON.stringify(o));
}

/** @hidden */
export function validateOptions(options) {
    if ((options.userAgentName && !options.userAgentVersion) ||
        (!options.userAgentName && options.userAgentVersion))
        return new Error('You need to specify both userAgentName and userAgentVersion');
    if (options.userAgentName &&
        !/^[a-zA-Z\ \-\_\.0-9]+$/.test(options.userAgentName))
        return new Error('The userAgentName must only contain characters a-z, A-Z, 0-9, -, _ and space.');
    if (options.userAgentVersion &&
        semver.valid(options.userAgentVersion) == null)
        return new Error(`The userAgentVersion ${options.userAgentVersion} is not a valid semver (see http://semver.org)`);
    return null;
}

/** @hidden */
export function validateGetOptions(options: WickedGetOptions): WickedGetOptions {
    const o = {} as WickedGetOptions;
    if (options) {
        if (options.offset)
            o.offset = options.offset;
        if (options.limit)
            o.limit = options.limit;
    }
    return o;
}

/** @hidden */
export function validateGetCollectionOptions(options: WickedGetCollectionOptions): WickedGetCollectionOptions {
    const o = {} as WickedGetCollectionOptions;
    if (options) {
        if (options.filter)
            o.filter = options.filter;
        if (options.offset)
            o.offset = options.offset;
        if (options.limit)
            o.limit = options.limit;
        if (options.order_by)
            o.order_by = options.order_by;
        if (options.no_cache)
            o.no_cache = options.no_cache;
    }
    return o;
}

/** @hidden */
export function checkConfigHash() {
    debug('checkConfigHash()');

    request.get({
        url: wickedStorage.apiUrl + 'confighash',
        timeout: WICKED_TIMEOUT
    }, function (err, res, body) {
        wickedStorage.apiReachable = false;
        if (err) {
            console.error('checkConfigHash(): An error occurred.');
            console.error(err);
            console.error(err.stack);
            return;
        }
        if (200 !== res.statusCode) {
            console.error('checkConfigHash(): Returned unexpected status code: ' + res.statusCode);
            return;
        }
        wickedStorage.apiReachable = true;
        const configHash = '' + body;

        if (configHash !== wickedStorage.configHash) {
            console.log('checkConfigHash() - Detected new configuration version, scheduling shutdown in 2 seconds.');
            wickedStorage.pendingExit = true;
            setTimeout(forceExit, 2000);
        }
    });
}

/** @hidden */
export function forceExit() {
    console.log('Exiting component due to outdated configuration (confighash mismatch).');
    process.exit(0);
}

/** @hidden */
export function _isApiReachable() {
    checkInitialized('isApiReachable');
    if (!wickedStorage.isPollingApi)
        throw new Error('isApiReachable() can only be used if wicked-sdk is polling the API continuously (option "doNotPollConfigHash").')
    return wickedStorage.apiReachable;
}

/** @hidden */
export function _isDevelopmentMode() {
    checkInitialized('isDevelopmentMode');

    if (wickedStorage.globals &&
        wickedStorage.globals.network &&
        wickedStorage.globals.network.schema &&
        wickedStorage.globals.network.schema === 'https')
        return false;
    return true;
}

const DEFAULT_AWAIT_OPTIONS = {
    statusCode: 200,
    maxTries: 100,
    retryDelay: 1000
};

/** @hidden */
export function _awaitUrl(url: string, options: WickedAwaitOptions, callback?: Callback<any>): void | Promise<any> {
    debug('awaitUrl(): ' + url);
    if (!callback && (typeof (options) === 'function')) {
        callback = options;
        options = null;
    }

    const func = _awaitUrl;
    if (!callback) {
        return new Promise(function (resolve, reject) {
            func(url, options, function (err, result) {
                err ? reject(err) : resolve(result);
            });
        });
    }

    // Copy the settings from the defaults; otherwise we'd change them haphazardly
    const awaitOptions: WickedAwaitOptions = {
        statusCode: DEFAULT_AWAIT_OPTIONS.statusCode,
        maxTries: DEFAULT_AWAIT_OPTIONS.maxTries,
        retryDelay: DEFAULT_AWAIT_OPTIONS.retryDelay
    };
    if (options) {
        if (options.statusCode)
            awaitOptions.statusCode = options.statusCode;
        if (options.maxTries)
            awaitOptions.maxTries = options.maxTries;
        if (options.retryDelay)
            awaitOptions.retryDelay = options.retryDelay;
    }

    debug('Invoking tryGet()');
    tryGet(url, awaitOptions.statusCode, awaitOptions.maxTries, 0, awaitOptions.retryDelay, function (err, body) {
        debug('tryGet() returned.');
        if (err) {
            debug('but tryGet() errored.');
            debug(err);
            return callback(err);
        }
        callback(null, body);
    });
}

/** @hidden */
export function _awaitKongAdapter(awaitOptions, callback?): void | Promise<any> {
    debug('awaitKongAdapter()');
    checkInitialized('awaitKongAdapter');
    if (!callback && (typeof (awaitOptions) === 'function')) {
        callback = awaitOptions;
        awaitOptions = null;
    }

    const func = _awaitKongAdapter;
    if (!callback) {
        return new Promise(function (resolve, reject) {
            func(awaitOptions, function (err, result) {
                err ? reject(err) : resolve(result);
            });
        });
    }

    if (awaitOptions) {
        debug('awaitOptions:');
        debug(awaitOptions);
    }

    const adapterPingUrl = _getInternalKongAdapterUrl() + 'ping';
    _awaitUrl(adapterPingUrl, awaitOptions, function (err, body) {
        if (err)
            return callback(err);
        wickedStorage.kongAdapterInitialized = true;
        return callback(null, body);
    });
}

/** @hidden */
export function _initMachineUser(serviceId: string, callback?: ErrorCallback): void | Promise<any> {
    debug('initMachineUser()');
    checkInitialized('initMachineUser');

    const func = _initMachineUser;
    if (!callback) {
        return new Promise(function (resolve, reject) {
            func(serviceId, function (err) {
                err ? reject(err) : resolve();
            });
        });
    }

    retrieveOrCreateMachineUser(serviceId, (err, _) => {
        if (err)
            return callback(err);
        // wickedStorage.machineUserId has been filled now;
        // now we want to retrieve the API scopes of portal-api.
        return initPortalApiScopes(callback);
    });
}

/** @hidden */
export function retrieveOrCreateMachineUser(serviceId: string, callback: Callback<WickedUserInfo>) {
    debug('retrieveOrCreateMachineUser()');
    if (!/^[a-zA-Z\-_0-9]+$/.test(serviceId))
        return callback(new Error('Invalid Service ID, must only contain a-z, A-Z, 0-9, - and _.'));

    const customId = makeMachineUserCustomId(serviceId);
    _apiGet('users?customId=' + qs.escape(customId), null, 'read_users', function (err, userInfo) {
        if (err && err.statusCode == 404) {
            // Not found
            return createMachineUser(serviceId, callback);
        } else if (err) {
            return callback(err);
        }
        if (!Array.isArray(userInfo))
            return callback(new Error('GET of user with customId ' + customId + ' did not return expected array.'));
        if (userInfo.length !== 1)
            return callback(new Error('GET of user with customId ' + customId + ' did not return array of length 1 (length == ' + userInfo.length + ').'));
        userInfo = userInfo[0]; // Pick the user from the list.
        storeMachineUser(userInfo);
        return callback(null, userInfo);
    });
}

/** @hidden */
export function storeMachineUser(userInfo) {
    debug('Machine user info:');
    debug(userInfo);
    debug('Setting machine user id: ' + userInfo.id);
    wickedStorage.machineUserId = userInfo.id;
}

/** @hidden */
function makeMachineUserCustomId(serviceId) {
    const customId = 'internal:' + serviceId;
    return customId;
}

/** @hidden */
export function createMachineUser(serviceId, callback) {
    const customId = makeMachineUserCustomId(serviceId);
    const userInfo = {
        customId: customId,
        firstName: 'Machine-User',
        lastName: serviceId,
        email: serviceId + '@wicked.haufe.io',
        validated: true,
        groups: ['admin']
    };
    _apiPost('users/machine', userInfo, null, function (err, userInfo) {
        if (err)
            return callback(err);
        storeMachineUser(userInfo);
        return callback(null, userInfo);
    });
}

/** @hidden */
function initPortalApiScopes(callback) {
    debug('initPortalApiScopes()');
    if (!wickedStorage.machineUserId)
        return callback(new Error('initPortalApiScopes: Machine user id not initialized.'));
    _apiGet('apis/portal-api', null, 'read_apis', (err, apiInfo) => {
        if (err)
            return callback(err);
        debug(apiInfo);
        if (!apiInfo.settings)
            return callback(new Error('initPortalApiScope: Property settings not found.'));
        if (!apiInfo.settings.scopes)
            return callback(new Error('initPortalApiScope: Property settings.scopes not found.'));
        const scopeList = [];
        for (let scope in apiInfo.settings.scopes) {
            scopeList.push(scope);
        }
        wickedStorage.portalApiScope = scopeList.join(' ');
        debug(`initPortalApiScopes: Full API Scope: "${wickedStorage.portalApiScope}"`);
        return callback(null);
    });
}

/** @hidden */
export function _getGlobals() {
    debug('getGlobals()');
    checkInitialized('getGlobals');

    return wickedStorage.globals;
}

/** @hidden */
export function _getConfigHash() {
    debug('getConfigHash()');
    checkInitialized('getConfigHash');

    return wickedStorage.configHash;
}

/** @hidden */
export function _getExternalPortalHost() {
    debug('getExternalPortalHost()');
    checkInitialized('getExternalPortalHost');

    return checkNoSlash(getPortalHost());
}

/** @hidden */
export function _getExternalPortalUrl() {
    debug('getExternalPortalUrl()');
    checkInitialized('getExternalPortalUrl');

    return checkSlash(_getSchema() + '://' + getPortalHost());
}

/** @hidden */
export function _getExternalGatewayHost() {
    debug('getExternalGatewayHost()');
    checkInitialized('getExternalGatewayHost()');

    return checkNoSlash(getApiHost());
}

/** @hidden */
export function _getExternalGatewayUrl() {
    debug('getExternalGatewayUrl()');
    checkInitialized('getExternalGatewayUrl');

    return checkSlash(_getSchema() + '://' + getApiHost());
}

/** @hidden */
export function _getInternalApiUrl() {
    debug('getInternalApiUrl()');
    checkInitialized('getInternalApiUrl');

    return checkSlash(wickedStorage.apiUrl);
}

/** @hidden */
export function _getPortalApiScope() {
    debug('getPortalApiScope()');
    checkInitialized('getPortalApiScope');

    if (wickedStorage.isV100OrHigher && wickedStorage.portalApiScope)
        return wickedStorage.portalApiScope;
    debug('WARNING: portalApiScope is not defined, or wicked API is <1.0.0');
    return '';
}

/** @hidden */
export function _getInternalPortalUrl() {
    debug('getInternalPortalUrl()');
    checkInitialized('getInternalPortalUrl');

    return _getInternalUrl('portalUrl', 'portal', 3000);
}

/** @hidden */
export function _getInternalKongAdminUrl() {
    debug('getInternalKongAdminUrl()');
    checkInitialized('getInternalKongAdminUrl');

    return _getInternalUrl('kongAdminUrl', 'kong', 8001);
}

/** @hidden */
export function _getInternalKongProxyUrl() {
    debug('getInternalKongProxyUrl()');
    checkInitialized('getInternalKongProxyUrl');

    // Check if it's there, but only if the property is present
    if (wickedStorage.globals.network &&
        wickedStorage.globals.network.kongProxyUrl) {
        try {
            const proxyUrl = _getInternalUrl('kongProxyUrl', 'kong', 8000);
            if (proxyUrl && proxyUrl !== '' && proxyUrl !== '/')
                return proxyUrl;
        } catch (ex) {
            debug(ex);
        }
    }
    debug(`globals.json: network.kongProxyUrl is not defined, falling back to admin URL.`)
    // Fallback: Deduce from Kong Admin URL
    const adminUrl = _getInternalKongAdminUrl();
    return adminUrl.replace(/8001/, '8000');
}

/** @hidden */
export function _getInternalMailerUrl() {
    debug('getInternalMailerUrl');
    checkInitialized('getInternalMailerUrl');

    return _getInternalUrl('mailerUrl', 'portal-mailer', 3003);
}

/** @hidden */
export function _getInternalChatbotUrl() {
    debug('getInternalChatbotUrl()');
    checkInitialized('getInternalChatbotUrl');

    return _getInternalUrl('chatbotUrl', 'portal-chatbot', 3004);
}

/** @hidden */
export function _getInternalKongAdapterUrl() {
    debug('getInternalKongAdapterUrl()');
    checkInitialized('getInternalKongAdapterUrl');

    return _getInternalUrl('kongAdapterUrl', 'portal-kong-adapter', 3002);
}

/** @hidden */
export function _getInternalKongOAuth2Url() {
    debug('getInternalKongOAuth2Url()');
    checkInitialized('getInternalKongOAuth2Url');

    return _getInternalUrl('kongOAuth2Url', 'portal-kong-oauth2', 3006);
}

/** @hidden */
export function _getInternalUrl(globalSettingsProperty: string, defaultHost: string, defaultPort: number) {
    debug('getInternalUrl("' + globalSettingsProperty + '")');
    checkInitialized('getInternalUrl');

    if (wickedStorage.globals.network &&
        wickedStorage.globals.network.hasOwnProperty(globalSettingsProperty)) {
        return checkSlash(wickedStorage.globals.network[globalSettingsProperty]);
    }
    if (defaultHost && defaultPort)
        return checkSlash(guessServiceUrl(defaultHost, defaultPort));
    throw new Error('Configuration property "' + globalSettingsProperty + '" not defined in globals.json: network.');
}

/** @hidden */
export function _getKongAdapterIgnoreList(): string[] {
    debug('getKongAdapterIgnoreList()');
    checkInitialized('getKongAdapterIgnoreList');

    const glob = wickedStorage.globals as WickedGlobals;
    if (glob.kongAdapter && glob.kongAdapter.useKongAdapter && glob.kongAdapter.ignoreList) {
        return glob.kongAdapter.ignoreList;
    }
    return [];
}

/** @hidden */
export function _getApiKeyHeader(): string {
    debug('getApiKeyHeader()');
    checkInitialized('getApiKeyHeader');

    const glob = wickedStorage.globals as WickedGlobals;
    if (glob.api && glob.api.headerName)
        return glob.api.headerName;
    return 'X-ApiKey';
}

/** @hidden */
export function _getPasswordStrategy(): string {
    debug('getPasswordStrategy()');
    checkInitialized('getPasswordStrategy()');
    const glob = wickedStorage.globals as WickedGlobals;
    if (glob.passwordStrategy)
        return glob.passwordStrategy;
    return 'PW_6_24';
}

// ======= UTILITY FUNCTIONS ======

/** @hidden */
function checkSlash(someUrl) {
    if (someUrl.endsWith('/'))
        return someUrl;
    return someUrl + '/';
}

/** @hidden */
function checkNoSlash(someUrl) {
    if (someUrl.endsWith('/'))
        return someUrl.substring(0, someUrl.length - 1);
    return someUrl;
}

/** @hidden */
export function _getSchema() {
    checkInitialized('getSchema');
    if (wickedStorage.globals.network &&
        wickedStorage.globals.network.schema)
        return wickedStorage.globals.network.schema;
    console.error('In globals.json, network.schema is not defined. Defaulting to https.');
    return 'https';
}

/** @hidden */
export function getPortalHost() {
    if (wickedStorage.globals.network &&
        wickedStorage.globals.network.portalHost)
        return wickedStorage.globals.network.portalHost;
    throw new Error('In globals.json, portalHost is not defined. Cannot return any default.');
}

/** @hidden */
export function getApiHost() {
    if (wickedStorage.globals.network &&
        wickedStorage.globals.network.apiHost)
        return wickedStorage.globals.network.apiHost;
    throw new Error('In globals.json, apiHost is not defined. Cannot return any default.');
}

/** @hidden */
export function checkInitialized(callingFunction) {
    if (!wickedStorage.initialized)
        throw new Error('Before calling ' + callingFunction + '(), initialize() must have been called and has to have returned successfully.');
}

/** @hidden */
export function checkKongAdapterInitialized(callingFunction) {
    if (!wickedStorage.kongAdapterInitialized)
        throw new Error('Before calling ' + callingFunction + '(), awaitKongAdapter() must have been called and has to have returned successfully.');
}

/** @hidden */
function guessServiceUrl(defaultHost, defaultPort) {
    debug('guessServiceUrl() - defaultHost: ' + defaultHost + ', defaultPort: ' + defaultPort);
    let url = 'http://' + defaultHost + ':' + defaultPort + '/';
    // Are we not running containerized? Then guess we're in local development mode.
    if (!isContainerized) {
        const defaultLocalIP = getDefaultLocalIP();
        url = 'http://' + defaultLocalIP + ':' + defaultPort + '/';
    }
    debug(url);
    return url;
}

/** @hidden */
function resolveApiUrl() {
    let apiUrl = process.env.PORTAL_API_URL;
    if (!apiUrl) {
        apiUrl = guessServiceUrl('portal-api', '3001');
        console.error('Environment variable PORTAL_API_URL is not set, defaulting to ' + apiUrl + '. If this is not correct, please set before starting this process.');
    }
    if (!apiUrl.endsWith('/')) // Add trailing slash
        apiUrl += '/';
    return apiUrl;
}

/** @hidden */
function getDefaultLocalIP() {
    const localIPs = getLocalIPs();
    if (localIPs.length > 0)
        return localIPs[0];
    return "localhost";
}

/** @hidden */
function getLocalIPs() {
    debug('getLocalIPs()');
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (let k in interfaces) {
        for (let k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    debug(addresses);
    return addresses;
}

/** @hidden */
function tryGet(url, statusCode, maxTries, tryCounter, timeout, callback) {
    debug('Try #' + tryCounter + ' to GET ' + url);
    request.get({ url: url, timeout: TRYGET_TIMEOUT }, function (err, res, body) {
        if (err || res.statusCode !== statusCode) {
            if (tryCounter < maxTries || maxTries < 0)
                return setTimeout(tryGet, timeout, url, statusCode, maxTries, tryCounter + 1, timeout, callback);
            debug('Giving up.');
            if (!err)
                err = new Error('Too many unsuccessful retries to GET ' + url + '. Gave up after ' + maxTries + ' tries.');
            return callback(err);
        }
        callback(null, body);
    });
}

/** @hidden */
function getJson(ob) {
    if (typeof ob === "string")
        return JSON.parse(ob);
    return ob;
}

/** @hidden */
function getText(ob) {
    if (ob instanceof String || typeof ob === "string")
        return ob;
    return JSON.stringify(ob, null, 2);
}

/** @hidden */
export function _apiGet(urlPath, userId, scope, callback) {
    debug('apiGet(): ' + urlPath);
    checkInitialized('apiGet');
    if (arguments.length !== 4 && arguments.length !== 3)
        throw new Error('apiGet was called with wrong number of arguments');

    return apiAction('GET', urlPath, null, userId, scope, callback);
}

/** @hidden */
export function _apiPost(urlPath, postBody, userId, callback) {
    debug('apiPost(): ' + urlPath);
    checkInitialized('apiPost');
    if (arguments.length !== 4 && arguments.length !== 3)
        throw new Error('apiPost was called with wrong number of arguments');

    return apiAction('POST', urlPath, postBody, userId, null, callback);
}

/** @hidden */
export function _apiPut(urlPath, putBody, userId, callback) {
    debug('apiPut(): ' + urlPath);
    checkInitialized('apiPut');
    if (arguments.length !== 4 && arguments.length !== 3)
        throw new Error('apiPut was called with wrong number of arguments');

    return apiAction('PUT', urlPath, putBody, userId, null, callback);
}

/** @hidden */
export function _apiPatch(urlPath, patchBody, userId, callback) {
    debug('apiPatch(): ' + urlPath);
    checkInitialized('apiPatch');
    if (arguments.length !== 4 && arguments.length !== 3)
        throw new Error('apiPatch was called with wrong number of arguments');

    return apiAction('PATCH', urlPath, patchBody, userId, null, callback);
}

/** @hidden */
export function _apiDelete(urlPath, userId, callback) {
    debug('apiDelete(): ' + urlPath);
    checkInitialized('apiDelete');
    if (arguments.length !== 3 && arguments.length !== 2)
        throw new Error('apiDelete was called with wrong number of arguments');

    return apiAction('DELETE', urlPath, null, userId, null, callback);
}

/** @hidden */
function apiAction(method, urlPath, actionBody, userId, scope, callback) {
    const func = apiAction;

    if (!callback) {
        debug(`apiAction(): Promisifying ${method} ${urlPath}`);
        return new Promise(function (resolve, reject) {
            func(method, urlPath, actionBody, userId, scope, function (err, result) {
                err ? reject(err) : resolve(result)
            });
        });
    }

    debug('apiAction(' + method + '): ' + urlPath);
    if (arguments.length !== 6)
        throw new Error('apiAction called with wrong number of arguments');
    if (typeof (callback) !== 'function')
        throw new Error('apiAction: callback is not a function');

    if (!wickedStorage.apiReachable)
        return callback(new Error('The wicked API is currently not reachable. Try again later.'));
    // This is not needed anymore: The API accepts the current and the previous config hash now.
    // if (wickedStorage.pendingExit)
    //     return callback(new Error('A shutdown due to changed configuration is pending.'));

    if (!scope) {
        if (wickedStorage.portalApiScope)
            scope = wickedStorage.portalApiScope;
        else
            scope = '';
    }
    debug(`apiAction: Using scope ${scope}`);

    if (actionBody)
        debug(actionBody);

    if (!userId && wickedStorage.machineUserId) {
        debug('Picking up machine user id: ' + wickedStorage.machineUserId);
        userId = wickedStorage.machineUserId;
    }

    if (urlPath.startsWith('/'))
        urlPath = urlPath.substring(1); // strip slash in beginning; it's in the API url

    const url = _getInternalApiUrl() + urlPath;
    debug(method + ' ' + url);
    const reqInfo: RequestBody = {
        method: method,
        url: url,
        timeout: WICKED_TIMEOUT
    };
    if (method != 'DELETE' &&
        method != 'GET') {
        // DELETE and GET ain't got no body.
        reqInfo.body = actionBody;
        reqInfo.json = true;
    }
    // This is the config hash we saw at init; send it to make sure we don't
    // run on an outdated configuration.
    reqInfo.headers = { 'X-Config-Hash': wickedStorage.configHash };
    if (userId) {
        if (wickedStorage.isV100OrHigher) {
            reqInfo.headers['X-Authenticated-UserId'] = `sub=${userId}`;
        } else if (wickedStorage.isV012OrHigher) {
            reqInfo.headers['X-Authenticated-UserId'] = userId;
        } else {
            reqInfo.headers['X-UserId'] = userId;
        }
    }
    if (wickedStorage.isV100OrHigher) {
        reqInfo.headers['X-Authenticated-Scope'] = scope;
    }
    if (requestRuntime.correlationId) {
        debug('Using correlation id: ' + requestRuntime.correlationId);
        reqInfo.headers['Correlation-Id'] = requestRuntime.correlationId;
    }
    if (wickedStorage.userAgent) {
        debug('Using User-Agent: ' + wickedStorage.userAgent);
        reqInfo.headers['User-Agent'] = wickedStorage.userAgent;
    }

    async.retry({
        tries: wickedStorage.apiMaxTries,
        interval: wickedStorage.apiRetryDelay,
        errorFilter: function (err) {
            // Errors which are not "hard" but have an error code are permanent if they have a non-5xx error code.
            if (err.statusCode) {
                // In that case, abort the retry flow
                if (err.statusCode < 500)
                    return false;
                // Retry on 5xx
                return true;
            }
            // In case of hard errors (such es E_CONN_xxx), continue retrying
            return true;
        }
    }, function (callback) {
        debug(`Attempting to ${reqInfo.method} ${reqInfo.url}`);
        request(reqInfo, function (err, res, body) {
            if (err)
                return callback(err);
            if (res.statusCode > 299) {
                // Looks bad
                const err = new WickedError(`api${nice(method)}() ${urlPath} returned non-OK status code: ${res.statusCode}, check err.statusCode and err.body for details`, res.statusCode, body);
                return callback(err);
            }
            if (res.statusCode !== 204) {
                const contentType = res.headers['content-type'];
                let returnValue = null;
                try {
                    if (contentType.startsWith('text'))
                        returnValue = getText(body);
                    else
                        returnValue = getJson(body);
                } catch (ex) {
                    return callback(new WickedError(`api${nice(method)}() ${urlPath} returned non-parseable JSON: ${ex.message}`, 500, body));
                }
                return callback(null, returnValue);
            } else {
                // Empty response
                return callback(null);
            }
        });
    }, callback);
}

/** @hidden */
function nice(methodName) {
    return methodName.substring(0, 1) + methodName.substring(1).toLowerCase();
}

/** @hidden */
export function buildUrl(base, queryParams) {
    let url = base;
    let first = true;
    for (let p in queryParams) {
        if (first) {
            url += '?';
            first = false;
        } else {
            url += '&';
        }
        const v = queryParams[p];
        if (typeof v === 'number')
            url += v;
        else if (typeof v === 'string')
            url += qs.escape(v);
        else if (typeof v === 'boolean')
            url += v ? 'true' : 'false';
        else // Object or array or whatever
            url += qs.escape(JSON.stringify(v));
    }
    return url;
}

/** @hidden */
export function _getSubscriptionByClientId(clientId: string, apiId: string, asUserId: string, callback?: Callback<WickedSubscriptionInfo>): void | Promise<WickedSubscriptionInfo> {
    debug('getSubscriptionByClientId()');
    checkInitialized('getSubscriptionByClientId');

    const func = _getSubscriptionByClientId;
    if (!callback) {
        return new Promise(function (resolve, reject) {
            func(clientId, apiId, asUserId, function (err, result) {
                err ? reject(err) : resolve(result)
            });
        });
    }

    // Validate format of clientId
    if (!/^[a-zA-Z0-9\-]+$/.test(clientId)) {
        return callback(new Error('Invalid client_id format.'));
    }

    // Check whether we know this client ID, otherwise we won't bother.
    _apiGet('subscriptions/' + qs.escape(clientId), asUserId, 'read_subscriptions', function (err, subsInfo) {
        if (err) {
            debug('GET of susbcription for client_id ' + clientId + ' failed.');
            debug(err);
            return callback(new Error('Could not identify application with given client_id.'));
        }
        debug('subscription info:');
        debug(subsInfo);
        if (!subsInfo.subscription)
            return callback(new Error('Could not successfully retrieve subscription information.'));
        if (subsInfo.subscription.api != apiId) {
            debug('subsInfo.api != apiId: ' + subsInfo.subscription.api + ' != ' + apiId);
            return callback(new Error('Bad request. The client_id does not match the API.'));
        }
        debug('Successfully identified application: ' + subsInfo.subscription.application);

        return callback(null, subsInfo);
    });
}
