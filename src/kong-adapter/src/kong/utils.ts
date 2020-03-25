'use strict';

const request = require('request');
const { debug, info, warn, error } = require('portal-env').Logger('kong-adapter:utils');
const crypto = require('crypto');
import * as wicked from 'wicked-sdk';

const fs = require('fs');
const path = require('path');
const qs = require('querystring');
const async = require('async');

import { SyncStatistics, ConsumerPlugin } from "./types";
import { WickedGroupCollection, Callback, WickedApiPlanCollection, WickedApiPlan, KongApi, KongService, KongRoute, KongPlugin, ErrorCallback, ProtocolType, KongCollection, KongConsumer, KongGlobals, KongStatus } from "wicked-sdk";

type KongServiceRoutes = { service: KongService, routes: KongRoute[] }

const KONG_TIMEOUT = 5000;
const KONG_RETRY_DELAY = 2000;
const KONG_MAX_ATTEMPTS = 10;

export function getUtc(): number {
    return Math.floor((new Date()).getTime() / 1000);
}

export function createRandomId(): string {
    return crypto.randomBytes(20).toString('hex');
}

let _kongUrl: string = null;
export function setKongUrl(url: string): void {
    _kongUrl = url;
}

export function getKongUrl(): string {
    if (!_kongUrl)
        throw new Error('utils.setKongUrl was never called, kong URL is yet unknown');
    return _kongUrl;
}

let _myUrl: string = null;
export function setMyUrl(url: string): void {
    _myUrl = url;
}

export function getMyUrl(): string {
    return _myUrl;
}

export function getJson(ob): object {
    if (typeof ob === "string") {
        if (ob === "")
            return null;
        return JSON.parse(ob);
    }
    return ob;
}

export function getText(ob): string {
    if (typeof ob === "string")
        return ob;
    return JSON.stringify(ob, null, 2);
};

export function clone(ob): any {
    return JSON.parse(JSON.stringify(ob));
};

export function getIndexBy(anArray, predicate): number {
    for (let i = 0; i < anArray.length; ++i) {
        if (predicate(anArray[i]))
            return i;
    }
    return -1;
};

/**
 * Check for left side inclusion in right side, NOT vice versa
 */
export function matchObjects(apiObject, kongObject) {
    debug('matchObjects()');

    const returnValue = matchObjectsInternal(apiObject, kongObject);
    if (!returnValue) {
        debug(' - objects do not match.');
        debug('apiObject: ' + JSON.stringify(apiObject, null, 2));
        debug('kongObject: ' + JSON.stringify(kongObject, null, 2));
        if (_keepChangingActions) {
            // Store mismatching matches; this is a debugging mechanism for the
            // integration tests mostly. Find out which objects do not match and
            // and enable checking on them.
            _statistics.failedComparisons.push({
                apiObject: apiObject,
                kongObject: kongObject
            });
        }
    }
    return returnValue;
};

function matchObjectsInternal(apiObject, kongObject) {
    for (let prop in apiObject) {
        if (!kongObject.hasOwnProperty(prop)) {
            //console.log('Kong object does not have property "' + prop + '".');
            return false;
        }

        if ((typeof apiObject[prop]) != (typeof kongObject[prop])) {
            return false;
        }

        //missing property
        if (apiObject[prop] && (typeof kongObject[prop] === 'undefined' || kongObject[prop] === null)) {
            return false;
        }

        //for array, fail fast
        if (Array.isArray(apiObject[prop]) && Array.isArray(kongObject[prop]) && kongObject[prop].length !== apiObject[prop].length) {
            return false;
        }

        // Special case for routes array; these are not always ordered the same...
        if (Array.isArray(apiObject[prop]) && prop === 'routes') {
            const apiArr = apiObject[prop];
            const kongArr = kongObject[prop];

            for (let i = 0; i < apiArr.length; ++i) {
                const apiRoute = apiArr[i];
                // Let's find it in the Kong array
                const kongRoute = kongArr.find(kr => matchObjectsInternal(apiRoute, kr));
                if (!kongRoute)
                    return false;
            }
            // And the other way around as well...
            for (let i = 0; i < kongArr.length; ++i) {
                const kongRoute = kongArr[i];
                const apiRoute = apiArr.find(ar => matchObjectsInternal(ar, kongRoute));
                if (!apiRoute)
                    return false;
            }
            return true;
        }

        if (typeof apiObject[prop] == "object") { // Recurse please
            if (!matchObjectsInternal(apiObject[prop], kongObject[prop]))
                return false;
        } else { // other types
            if (apiObject[prop] != kongObject[prop]) {
                //console.log('Property "' + prop + '" does not match ("' + apiObject[prop] + '" vs "' + kongObject[prop] + '").');
                return false;
            }
        }
    }
    return true;
}

let _kongAvailable = true; // Otherwise the first call will not succeed
let _kongMessage = null;
let _kongClusterStatus = null;
export function markKongAvailable(kongAvailable, kongMessage, clusterStatus) {
    _kongAvailable = kongAvailable;
    _kongMessage = kongMessage;
    _kongClusterStatus = clusterStatus;
}

export function setKongClusterStatus(clusterStatus) {
    _kongClusterStatus = clusterStatus;
};

export function getKongClusterStatus() {
    return _kongClusterStatus;
}

export function isKongAvailable() {
    return _kongAvailable;
}

function defaultStatistics(): SyncStatistics {
    return {
        actions: [],
        failedComparisons: []
    };
}
let _statistics = defaultStatistics();
let _keepChangingActions = false;

/**
 * Resets the counters of actions taken against the Kong API; useful when debugging
 * why changes are redone over and over again, and used specifically in the integration
 * test suite to make sure the models created from the portal API configuration and the
 * ones present in the Kong database match.
 *
 * See also kongMain.resync() (the /resync end point).
*/
export function resetStatistics(keepChangingActions): void {
    _statistics = defaultStatistics();
    if (keepChangingActions)
        _keepChangingActions = true;
    else
        _keepChangingActions = false;
};

/**
 * Retrieves a list of usage statistics, including a list of "changing" API calls
 * to Kong, in case the flag "keep changing settings" was activated when the statistics
 * were reset. This is used in conjunction with the /resync end point to check
 * whether a resync is a complete NOP after the sync queue has already been worked off.
 *
 * Part of the statistics is also a list of objects which did not match when comparing,
 * see "matchObjects" for more information.
 */
export function getStatistics(): SyncStatistics {
    _keepChangingActions = false;
    return _statistics;
};

/**
 * Helper method to record Kong API action statistics, and possible also to record
 * a list of changing API calls for debugging purposes (integration tests).
 */
function kongActionStat(method, url, body): void {
    if (!_statistics[method])
        _statistics[method] = 0;
    _statistics[method]++;
    if (_keepChangingActions &&
        method != 'GET') {
        _statistics.actions.push({
            method: method,
            url: url,
            body: body
        });
    }
}

function kongAction(method, inputUrl, body, expectedStatusCode, callback: Callback<any>): void {
    let url = inputUrl;
    if (url.startsWith('/'))
        url = inputUrl.substring(1);
    debug(`kongAction(): ${method} "${url}"`);
    kongActionStat(method, url, body);

    // If for some reason, we think Kong is not available, tell the upstream
    if (!_kongAvailable) {
        const err: any = new Error('kong admin end point not available: ' + _kongMessage);
        err.status = 500;
        return callback(err);
    }

    // Now do our thing
    const kongUrl = getKongUrl();
    const methodBody: any = {
        method: method,
        url: kongUrl + url,
        timeout: KONG_TIMEOUT
    };
    if (method != 'DELETE' &&
        method != 'GET') {
        methodBody.json = true;
        methodBody.body = body;
        if (process.env.KONG_CURL)
            error('curl -X ' + method + ' -d \'' + JSON.stringify(body) + '\' -H \'Content-Type: application/json\' ' + methodBody.url);
    } else {
        if (process.env.KONG_CURL)
            error('curl -X ' + method + ' ' + methodBody.url);
    }

    function tryRequest(attempt: number) {
        request(methodBody, function (err, apiResponse, apiBody) {
            if (err) {
                if (attempt > KONG_MAX_ATTEMPTS) {
                    error(`kongAction: Giving up after ${KONG_MAX_ATTEMPTS} attempts to send a request to Kong.`);
                    // Still open up calls to Kong again now. Otherwise we would get stuck
                    // in a deadlock loop.
                    _kongAvailable = true;
                    return callback(err);
                }
                warn(`kongAction: Failed to send a request to Kong; retrying in ${KONG_RETRY_DELAY} ms (#${attempt + 1}). Preventing other calls in the mean time.`);
                _kongAvailable = false;

                setTimeout(tryRequest, KONG_RETRY_DELAY, attempt + 1);
                return;
            }
            _kongAvailable = true;
            if (expectedStatusCode != apiResponse.statusCode) {
                const err: any = new Error('kongAction ' + method + ' on ' + url + ' did not return the expected status code (got: ' + apiResponse.statusCode + ', expected: ' + expectedStatusCode + ').');
                err.status = apiResponse.statusCode;
                debug(method + ' /' + url);
                debug(methodBody);
                debug(apiBody);
                //console.error(apiBody);
                return callback(err);
            }
            callback(null, getJson(apiBody));
        });
    }

    tryRequest(0);
}

function kongGet(url: string, callback: Callback<any>) {
    kongAction('GET', url, null, 200, callback);
};

function kongPagingGet(url: string, callback: Callback<any>) {
    let pagingUrl;
    const size = 1000;
    if (url.indexOf('?') > 0)
        pagingUrl = `${url}&size=${size}`;
    else
        pagingUrl = `${url}?size=${size}`;
    console.log(pagingUrl);
    const dataArray = [];
    let finished = false;
    async.until(function () {
        return finished;
    }, function (callback) {
        kongGet(pagingUrl, function (err, result) {
            if (err)
                return callback(err);
            if (!result.data)
                return callback(new Error(`kongGet(${pagingUrl}) did not receive "data" property`));
            for (let d of result.data)
                dataArray.push(d);
            // console.log(result.data);
            if (result.next) {
                pagingUrl = `${result.next}&size=${size}`;
            } else {
                finished = true;
            }
            return callback(null);
        })
    }, function (err) {
        if (err)
            return callback(err);
        return callback(null, {
            data: dataArray,
            next: null
        });
    });
}

function kongPost(url, body, callback) {
    kongAction('POST', url, body, 201, callback);
};

function kongDelete(url, callback) {
    kongAction('DELETE', url, null, 204, callback);
};

function kongPatch(url, body, callback) {
    kongAction('PATCH', url, body, 200, callback);
};

function kongPut(url, body, callback) {
    kongAction('PUT', url, body, 200, callback);
};

export function getPlan(planId: string, callback: Callback<WickedApiPlan>) {
    debug('getPlan() - ' + planId);
    getPlans(function (err, plans) {
        if (err)
            return callback(err);
        internalGetPlan(plans, planId, callback);
    });
};

let _plans: WickedApiPlanCollection = null;
export function getPlans(callback: Callback<WickedApiPlanCollection>): void {
    debug('getPlans()');
    if (!_plans) {
        wicked.getPlans(function (err, results) {
            if (err)
                return callback(err);
            _plans = results;
            return callback(null, _plans);
        });
    } else {
        return callback(null, _plans);
    }
};

function internalGetPlan(plans: WickedApiPlanCollection, planId, callback: Callback<WickedApiPlan>): void {
    const plan = plans.plans.find(p => p.id === planId);
    if (!plan)
        return callback(new Error('Unknown plan ID: ' + planId));
    return callback(null, plan);
}

let _groups: WickedGroupCollection = null;
export function getGroups(): WickedGroupCollection {
    debug(`getGroups()`);
    if (!_groups)
        throw new Error('utils: _groups is not initialized; before calling getGroups(), initGroups() must have been called.');
    return _groups;
};

/**
 * Initialize the cache for the wicked user groups so that getGroups() can be
 * implemented synchronuously.
 *
 * @param callback
 */
export function initGroups(callback: Callback<WickedGroupCollection>): void {
    debug(`initGroups()`);
    wicked.getGroups((err, groups) => {
        if (err)
            return callback(err);
        _groups = groups;
        return callback(null, groups);
    });
};

export function findWithName(someArray: any[], name: string): any {
    for (let i = 0; i < someArray.length; ++i) {
        if (someArray[i].name === name)
            return someArray[i];
    }
    return null;
};

export function makeUserName(appId, apiId) {
    return appId + '$' + apiId;
};

let _packageFile = null;
export function getPackageJson() {
    if (!_packageFile) {
        // Deliberately do not do any error handling here! package.json MUST exist.
        const packageFile = path.join(__dirname, '..', '..', 'package.json');
        _packageFile = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    }
    return _packageFile;
};

let _packageVersion = null;
export function getVersion() {
    if (!_packageVersion) {
        const packageInfo = getPackageJson();
        if (packageInfo.version)
            _packageVersion = packageInfo.version;
    }
    if (!_packageVersion) // something went wrong
        _packageVersion = "0.0.0";
    return _packageVersion;
};

let _expectedKongVersion = null;
export function getExpectedKongVersion() {
    if (!_expectedKongVersion) {
        const packageInfo = getPackageJson();
        if (packageInfo.config && packageInfo.config.kongversion)
            _expectedKongVersion = packageInfo.config.kongversion;
    }
    if (!_expectedKongVersion)
        throw new Error('package.json does not contain config.kongversion!');
    return _expectedKongVersion;
};

let _gitLastCommit = null;
export function getGitLastCommit() {
    if (!_gitLastCommit) {
        const lastCommitFile = path.join(__dirname, '..', '..', 'git_last_commit');
        if (fs.existsSync(lastCommitFile))
            _gitLastCommit = fs.readFileSync(lastCommitFile, 'utf8');
        else
            _gitLastCommit = '(no last git commit found - running locally?)';
    }
    return _gitLastCommit;
};

let _gitBranch = null;
export function getGitBranch() {
    if (!_gitBranch) {
        const gitBranchFile = path.join(__dirname, '..', '..', 'git_branch');
        if (fs.existsSync(gitBranchFile))
            _gitBranch = fs.readFileSync(gitBranchFile, 'utf8');
        else
            _gitBranch = '(unknown)';
    }
    return _gitBranch;
};

let _buildDate = null;
export function getBuildDate() {
    if (!_buildDate) {
        const buildDateFile = path.join(__dirname, '..', '..', 'build_date');
        if (fs.existsSync(buildDateFile))
            _buildDate = fs.readFileSync(buildDateFile, 'utf8');
        else
            _buildDate = '(unknown build date)';
    }
    return _buildDate;
};

// KONG Convenience functions (typed)

// Don't use this if you don't have to, it's for super special cases.
// Usually, please create a named wrapper function for the Kong API call.
export function kongGetRaw(url: string, callback: Callback<object>): void {
    kongGet(url, callback);
}

// Service functions
function kongGetAllServices(callback: Callback<KongCollection<KongService>>): void {
    kongPagingGet('services', callback);
}

function kongPostService(service: KongService, callback: Callback<KongService>): void {
    kongPost('services', service, callback);
}

function kongPatchService(serviceId: string, service: KongService, callback: Callback<KongService>): void {
    kongPatch(`services/${serviceId}`, service, callback);
}

function kongDeleteService(serviceId: string, callback: ErrorCallback): void {
    kongDelete(`services/${serviceId}`, callback);
}

// Route functions
function kongGetAllRoutes(callback: Callback<KongCollection<KongRoute>>): void {
    kongPagingGet('routes', callback);
}

function kongPostRoute(route: KongRoute, callback: Callback<KongRoute>): void {
    kongPost('routes', route, callback);
}

function kongPatchRoute(routeId: string, route: KongRoute, callback: Callback<KongRoute>): void {
    kongPatch(`routes/${routeId}`, route, callback);
}

function kongPutRoute(routeId: string, route: KongRoute, callback: Callback<KongRoute>): void {
    kongPut(`routes/${routeId}`, route, callback);
}

function kongDeleteRoute(routeId: string, callback: ErrorCallback) {
    kongDelete(`routes/${routeId}`, callback);
}

function kongGetRouteForService(serviceId: string, callback: Callback<KongRoute[]>): void {
    kongGet(`services/${serviceId}/routes`, function (err, routes: KongCollection<KongRoute>) {
        if (err)
            return callback(err);
        if (routes.data.length === 0)
            return callback(null, null);

        return callback(null, routes.data);
    })
}

// API functions
export function kongGetAllApis(callback: Callback<KongCollection<KongApi>>): void {
    debug('kongGetAllApis()');
    async.parallel({
        services: callback => kongGetAllServices(callback),
        routes: callback => kongGetAllRoutes(callback)
    }, function (err, results) {
        if (err)
            return callback(err);

        const services = results.services as KongCollection<KongService>;
        const routes = results.routes as KongCollection<KongRoute>;

        // Step 1: Build a service id to service/routes map
        const serviceIdMap = new Map<string, KongServiceRoutes>();
        for (let i = 0; i < services.data.length; ++i) {
            const s = services.data[i];

            serviceIdMap.set(s.id, {
                service: s,
                routes: []
            });
        }

        // Step 2: Match the routes to the services
        for (let i = 0; i < routes.data.length; ++i) {
            const r = routes.data[i];
            const item: KongServiceRoutes = serviceIdMap.get(r.service.id);

            if (!item) {
                warn(`kongGetAllApis: Route ${r.id} with paths ${r.paths} has an unknown service id ${r.service.id}`);
                continue;
            }

            item.routes.push(r);
        }

        //Step 3: assemble APIs
        const kongApis: KongApi[] = [];
        for (let entry of serviceIdMap.entries()) {
            kongApis.push(wicked.kongServiceAndRoutesToApi(entry[1].service, entry[1].routes));
        }

        return callback(null, {
            data: kongApis
        });
    });
}

export function kongGetApiPlugins(apiId: string, callback: Callback<KongCollection<KongPlugin>>): void {
    debug(`kongGetApiPlugins(${apiId})`);
    kongPagingGet(`services/${apiId}/plugins`, function (err, apiPlugins) {
        if (err)
            return callback(err);
        // Filter out plugins which are pointing to a consumer; these are not for consideration
        // here, they are handled with the consumer API plugins instead. This is a little unfortunate,
        // but that's how it is currently.
        return callback(null, {
            data: apiPlugins.data.filter(plugin => !plugin.consumer)
        })
    });
}

export function kongPostApi(apiConfig: KongApi, callback: Callback<KongApi>): void {
    debug('kongPostApi()');
    const { service, routes } = wicked.kongApiToServiceAndRoutes(apiConfig);
    let persistedService: KongService = null;
    let persistedRoute: KongRoute[] = [];

    let flow: ((...args: any[]) => void)[] = [];

    flow.push(
        function (callback) {
            kongPostService(service, callback)
        },
        function (service: KongService, callback) {
            persistedService = service;

            for (let i = 0; i < routes.length; i += 1) {
                routes[i].service = { id: service.id };
            }

            callback(null, 0, routes);
        }
    );

    for (let i = 0; i < routes.length; i += 1) {
        flow.push(
            function (index: number, routes: KongRoute[], callback) {
                kongPostRoute(routes[index], function (err, data: KongRoute) {
                    persistedRoute.push(data);

                    if (index + 1 >= routes.length) {
                        return callback(null);
                    } else {
                        callback(null, index + 1, routes);
                    }
                });
            }
        );
    }

    async.waterfall(flow, (err) => {
        if (err)
            return callback(err);

        return callback(null, wicked.kongServiceAndRoutesToApi(persistedService, persistedRoute));
    })
    //kongPost('apis', apiConfig, callback);
}

export function kongPatchApi(apiId: string, apiConfig: KongApi, callback: Callback<KongApi>): void {
    debug(`kongPatchApi(${apiId})`);
    debug('apiConfig: ' + JSON.stringify(apiConfig, null, 2));

    const { service, routes } = wicked.kongApiToServiceAndRoutes(apiConfig);
    let persistedService: KongService = null;
    let persistedRoute: KongRoute[] = [];

    service.id = apiId;

    kongGetRouteForService(apiId, function (err, existingRoutes: KongRoute[]) {
        if (err)
            return err;

        if (!existingRoutes) {
            warn(`kongGetRouteForService: Service ${apiId}, no routes returned`);
        }

        debug('Existing Routes: ' + JSON.stringify(existingRoutes, null, 2));

        let flow: ((...args: any[]) => void)[] = [];

        flow.push(
            function (callback) {
                kongPatchService(apiId, service, callback)
            },
            function (service: KongService, callback) {
                persistedService = service;

                // update service id
                // there is no way to correctly identify route(s) unless we allocate route id in static config ( not there yet )
                // so we completly replace content of the route(s) and delete whatever else left
                for (let i = 0; i < routes.length; i += 1) {
                    routes[i].service = { id: service.id };
                    routes[i].id = existingRoutes && existingRoutes.length > i ? existingRoutes[i].id : null;
                }

                callback(null, 0, routes);
            }
        );

        // update/replace routes
        for (let i = 0; i < routes.length; i += 1) {
            flow.push(
                function (index: number, callRoutes: KongRoute[], callback) {
                    if (callRoutes[index].id) {
                        debug(`update route: ${index} : ${callRoutes[index].id}`);

                        kongPutRoute(callRoutes[index].id, callRoutes[index], function (err, data: KongRoute) {
                            if (err) {
                                return callback(err);
                            }

                            persistedRoute.push(data);

                            if (index + 1 >= callRoutes.length) {
                                return callback(null, routes.length, existingRoutes);
                            }
                            else {
                                callback(null, index + 1, callRoutes);
                            }
                        });
                    }
                    else {
                        debug(`create route: ${index} : ${callRoutes[index].id}`);

                        kongPostRoute(callRoutes[index], function (err, data: KongRoute) {
                            if (err) {
                                return callback(err);
                            }

                            persistedRoute.push(data);

                            if (index + 1 >= callRoutes.length) {
                                return callback(null, routes.length, existingRoutes);
                            }
                            else {
                                callback(null, index + 1, callRoutes);
                            }
                        });
                    }
                }
            );
        };

        // delete whatever left
        for (let i = routes.length; existingRoutes && i < existingRoutes.length; i += 1) {
            flow.push(
                function (index: number, callRoutes: KongRoute[], callback) {
                    debug(`delete route: ${index} : ${callRoutes[index].id}`);

                    kongDeleteRoute(callRoutes[index].id, function (err) {
                        if (err) {
                            return callback(err);
                        }

                        if (index + 1 >= callRoutes.length) {
                            return callback(null);
                        }
                        else {
                            callback(null, index + 1, callRoutes);
                        }
                    });
                }
            );
        }

        async.waterfall(flow, (err) => {
            if (err)
                return callback(err);

            return callback(null, wicked.kongServiceAndRoutesToApi(persistedService, persistedRoute));
        });
    });
    //kongPatch(`apis/${apiId}`, apiConfig, callback);
}

export function kongDeleteApi(apiId: string, callback: ErrorCallback): void {
    debug(`kongDeleteApi(${apiId})`);
    kongGetRouteForService(apiId, function (err, routes: KongRoute[]) {
        if (err)
            return callback(err);

        if (!routes)
            return callback(new Error(`Could not retrieve route for service ${apiId}`));

        let flow: ((...args: any[]) => void)[] = [];

        flow.push(
            function (callback) {
                callback(null, 0, routes);
            }
        );

        for (let i = 0; i < routes.length; i += 1) {
            flow.push(
                function (index: number, routes: KongRoute[], callback) {
                    kongDeleteRoute(routes[index].id, function (err) {
                        if (err)
                            return callback(err);

                        if (index + 1 >= routes.length) {
                            return callback(null);
                        } else {
                            callback(null, index + 1, routes);
                        }
                    });
                }
            );
        }

        flow.push(
            //this corresponds to last no argument call, so only callback is here
            function (callback) {
                kongDeleteService(apiId, callback);
            }
        );

        async.waterfall(flow, (err) => {
            if (err)
                return callback(err);

            return callback(null);
        });
    });
    //kongDelete(`apis/${apiId}`, callback);
}

export function kongPostApiPlugin(apiId: string, plugin: KongPlugin, callback: Callback<KongPlugin>): void {
    debug(`kongPostApiPlugin(${apiId}, ${plugin.name})`);
    kongPost(`services/${apiId}/plugins`, plugin, callback);
}

export function kongPatchApiPlugin(apiId: string, pluginId: string, plugin: KongPlugin, callback: Callback<KongPlugin>): void {
    debug(`kongPatchApiPlugin(${apiId}, ${plugin.name})`);
    plugin.service = { id: apiId };
    plugin.id = pluginId;
    kongPatch(`plugins/${pluginId}`, plugin, callback);
}

// Consumer functions
export function kongGetAllConsumers(callback: Callback<KongCollection<KongConsumer>>): void {
    kongPagingGet('consumers', callback);
}

export function kongGetConsumersByCustomId(customId: string, callback: Callback<KongCollection<KongConsumer>>): void {
    kongGet('consumers?custom_id=' + qs.escape(customId), callback);
}

export function kongGetConsumerByName(username: string, callback: Callback<KongConsumer>): void {
    kongGet(`consumers/${username}`, callback);
}

export function kongGetConsumerPluginData(consumerId: string, pluginName: string, callback: Callback<KongCollection<object>>): void {
    kongGet(`consumers/${consumerId}/${pluginName}`, callback);
}

const _serviceIdCache = {};
export function kongGetServiceId(serviceId: string, callback: Callback<string>): void {
    if (_serviceIdCache[serviceId])
        return callback(null, _serviceIdCache[serviceId]);
    kongGet(`services/${serviceId}`, function (err, serviceInfo: KongService) {
        if (err)
            return callback(err);
        _serviceIdCache[serviceId] = serviceInfo.id;
        return callback(null, serviceInfo.id);
    });
}

export function kongGetApiPluginsByConsumer(apiId: string, consumerId: string, callback: Callback<KongCollection<KongPlugin>>): void {
    debug(`kongGetApiPluginsByConsumer(${apiId}, ${consumerId})`);
    // The apiId here is NOT an actual ID, but an alias name; the filtering for this as the
    // service.id will NOT work, as that contains the Kong internal ID. Meh.
    kongGetServiceId(apiId, function (err, serviceId) {
        if (err)
            return callback(err);
        kongGet(`consumers/${qs.escape(consumerId)}/plugins`, function (err, plugins: KongCollection<KongPlugin>) {
            if (err)
                return callback(err);
            if (!plugins.data)
                return callback(new Error(`Retrieving plugins for consumer ${consumerId} and service ${apiId} did not return data.`));
            console.log(plugins.data);
            const filteredPlugins = plugins.data.filter(p => p.service && p.service.id === serviceId);
            return callback(null, { data: filteredPlugins, next: null });
        });
    });
}

export function kongPostConsumer(consumer: KongConsumer, callback: Callback<KongConsumer>): void {
    kongPost('consumers', consumer, callback);
}

export function kongPostConsumerPlugin(consumerId: string, pluginName: string, plugin: ConsumerPlugin, callback: Callback<KongPlugin>): void {
    kongPost(`consumers/${consumerId}/${pluginName}`, plugin, callback);
}

export function kongDeleteConsumerPlugin(consumerId: string, pluginName: string, pluginId: string, callback: ErrorCallback): void {
    kongDelete(`consumers/${consumerId}/${pluginName}/${pluginId}`, callback);
}

export function kongPatchConsumer(consumerId: string, consumer: KongConsumer, callback: Callback<KongConsumer>): void {
    kongPatch(`consumers/${consumerId}`, consumer, callback);
}

export function kongDeleteConsumer(consumerId: string, callback: ErrorCallback): void {
    kongDelete(`consumers/${consumerId}`, callback);
}

// OTHER FUNCTIONS

export function kongGetGlobals(callback: Callback<KongGlobals>): void {
    kongGet('', callback);
}

export function kongGetStatus(callback: Callback<KongStatus>): void {
    kongGet('status', callback);
}

// Global Plugin functions

export function kongGetPluginsByName(pluginName: string, callback: Callback<KongCollection<KongPlugin>>): void {
    kongPagingGet(`plugins`, function (err, plugins) {
        if (err)
            return callback(err);
        const filteredPlugins = plugins.data.filter(p => p.name === pluginName);
        return callback(null, {
            data: filteredPlugins,
            next: null
        });
    });
}

export function kongPostGlobalPlugin(plugin: KongPlugin, callback: Callback<KongPlugin>): void {
    kongPost('plugins', plugin, callback);
}

export function kongDeletePlugin(pluginId: string, callback: ErrorCallback): void {
    kongDelete(`plugins/${pluginId}`, callback);
}
