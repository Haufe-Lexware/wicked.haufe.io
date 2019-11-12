'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:subscriptions');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class JsonSubscriptions {

    constructor(jsonUtils, jsonApprovals) {
        this.jsonUtils = jsonUtils;
        this.jsonApprovals = jsonApprovals;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByAppId(appId, callback) {
        debug('getById()');
        this.jsonUtils.checkCallback(callback);
        let subs;
        try {
            subs = this.loadSubscriptions(appId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, subs);
    }

    getByClientId(clientId, callback) {
        debug('getByClientId()');
        this.jsonUtils.checkCallback(callback);
        let subsInfo;
        try {
            subsInfo = this.getByClientIdSync(clientId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, subsInfo);
    }

    getByAppAndApi(appId, apiId, callback) {
        debug('getByAppAndApi()');
        this.jsonUtils.checkCallback(callback);
        let subsInfo;
        try {
            subsInfo = this.getByAppAndApiSync(appId, apiId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, subsInfo);
    }

    getByApi(apiId, offset, limit, callback) {
        debug('getByApi()');
        this.jsonUtils.checkCallback(callback);
        let apiSubs;
        try {
            apiSubs = this.getByApiSync(apiId, offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, apiSubs.rows, { count: apiSubs.count, cached: false });
    }

    getAll(filter, orderBy, offset, limit, noCountCache, callback) {
        debug('getAll()');
        // // noCountCache not used here, it doesn't have any impact
        // this.jsonUtils.checkCallback(callback);
        // let allSubs;
        // try {
        //     allSubs = this.getAllSync(filter, orderBy, offset, limit);
        // } catch (err) {
        //     return callback(err);
        // }
        // return callback(null, allApps.rows, { count: allSubs.count, cached: false });

        // THIS IS NOT IMPLEMENTED FOR JSON:
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    getIndex(offset, limit, callback) {
        debug('getIndex()');
        this.jsonUtils.checkCallback(callback);
        let subsIndex;
        try {
            subsIndex = this.getIndexSync(offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, subsIndex.rows, { count: subsIndex.count, cached: false });
    }

    getCount(callback) {
        debug('getCount()');
        this.jsonUtils.checkCallback(callback);
        let subsCount;
        try {
            subsCount = this.getCountSync();
        } catch (err) {
            return callback(err);
        }
        return callback(null, subsCount);
    }

    create(newSubscription, creatingUserId, callback) {
        debug('create()');
        this.jsonUtils.checkCallback(callback);
        let subsInfo;
        try {
            subsInfo = this.createSync(newSubscription, creatingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, subsInfo);
    }

    delete(appId, apiId, subscriptionId, callback) {
        debug('delete()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteSync(appId, apiId, subscriptionId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    patch(appId, subsInfo, patchingUserId, callback) {
        debug('patch()');
        this.jsonUtils.checkCallback(callback);
        let updatedSubs;
        try {
            updatedSubs = this.patchSync(appId, subsInfo, patchingUserId);
        } catch (err) {
            return callback(null);
        }
        return callback(null, updatedSubs);
    }

    // Legacy functionality which is used in the initializer; it's not possible
    // to take this out, but this does not have to be re-implemented for future
    // DAOs (actually, MUST not)

    legacyWriteSubsIndex(app, subs) {
        const subsIndexDir = this.getSubsIndexDir();
        for (let i = 0; i < subs.length; ++i) {
            const thisSub = subs[i];
            // Write subs index by client ID
            if (!thisSub.clientId) {
                continue;
            }
            const clientId = thisSub.clientId;
            const fileName = path.join(subsIndexDir, clientId + '.json');
            fs.writeFileSync(fileName, JSON.stringify({
                application: thisSub.application,
                api: thisSub.api
            }, null, 2), 'utf8');
        }
    }

    legacySaveSubscriptionApiIndex(apiId, subs) {
        this.saveSubscriptionApiIndex(apiId, subs);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getSubsDir() {
        return path.join(this.jsonUtils.getDynamicDir(), 'subscriptions');
    }

    getSubsIndexDir() {
        return path.join(this.jsonUtils.getDynamicDir(), 'subscription_index');
    }

    getSubsApiIndexDir() {
        return path.join(this.jsonUtils.getDynamicDir(), 'subscription_api_index');
    }

    loadSubscriptions(appId) {
        debug('loadSubscriptions(): ' + appId);
        const subsDir = this.getSubsDir();
        const subsFileName = path.join(subsDir, appId + '.subs.json');
        const subs = JSON.parse(fs.readFileSync(subsFileName, 'utf8'));
        daoUtils.decryptApiCredentials(subs);
        return subs;
    }

    saveSubscriptions(appId, subsList) {
        debug('saveSubscriptions(): ' + appId);
        debug(subsList);

        const subsDir = this.getSubsDir();
        const subsFileName = path.join(subsDir, appId + '.subs.json');
        daoUtils.encryptApiCredentials(subsList);
        fs.writeFileSync(subsFileName, JSON.stringify(subsList, null, 2), 'utf8');
    }

    loadSubscriptionIndexEntry(clientId) {
        debug('loadSubscriptionIndexEntry()');
        const indexDir = this.getSubsIndexDir();
        const fileName = path.join(indexDir, clientId + '.json');
        debug('Trying to load ' + fileName);
        if (!fs.existsSync(fileName)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(fileName, 'utf8'));
    }

    saveSubscriptionIndexEntry(clientId, subsInfo) {
        debug('saveSubscriptionIndexEntry()');
        const indexDir = this.getSubsIndexDir();
        const fileName = path.join(indexDir, clientId + '.json');
        const data = {
            application: subsInfo.application,
            api: subsInfo.api
        };
        debug('Writing to ' + fileName);
        debug(data);
        fs.writeFileSync(fileName, JSON.stringify(data, null, 2), 'utf8');
    }

    deleteSubscriptionIndexEntry(clientId) {
        debug('loadSubscriptionIndexEntry()');
        const indexDir = this.getSubsIndexDir();
        const fileName = path.join(indexDir, clientId + '.json');
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
    }

    loadSubscriptionApiIndex(apiId) {
        debug('loadSubscriptionApiIndex(): ' + apiId);
        const indexDir = this.getSubsApiIndexDir();
        const fileName = path.join(indexDir, apiId + '.json');
        if (!fs.existsSync(fileName)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(fileName, 'utf8'));
    }

    saveSubscriptionApiIndex(apiId, apiIndex) {
        debug('saveSubscriptionApiIndex(): ' + apiId);
        const indexDir = this.getSubsApiIndexDir();
        const fileName = path.join(indexDir, apiId + '.json');
        return fs.writeFileSync(fileName, JSON.stringify(apiIndex, null, 2), 'utf8');
    }

    addSubscriptionApiIndexEntry(subsInfo) {
        debug('addSubscriptionApiIndexEntry(): ' + subsInfo.application + ', plan: ' + subsInfo.plan);
        const appId = subsInfo.application;
        const planId = subsInfo.plan;
        const apiId = subsInfo.api;
        let apiIndex = this.loadSubscriptionApiIndex(apiId);
        if (!apiIndex) {
            warn(`addSubscriptionApiIndexEntry: Could not find index for API ${apiId}; (re-)creating.`);
            apiIndex = [];
        }

        const indexEntry = apiIndex.find(ie => ie.application === appId);
        if (indexEntry) {
            warn('addSubscriptionApiIndexEntry() was called with an application which already has a subscription.');
            // This is strange, and shouldn't happen.
            indexEntry.plan = planId;
        } else {
            apiIndex.push({
                application: appId,
                plan: planId
            });
        }
        this.saveSubscriptionApiIndex(apiId, apiIndex);
    }

    deleteSubscriptionApiIndexEntry(subsInfo) {
        debug('deleteSubscriptionApiIndexEntry(): ' + subsInfo.api + ', application: ' + subsInfo.application);
        const apiId = subsInfo.api;
        const appId = subsInfo.application;

        let apiIndex = this.loadSubscriptionApiIndex(apiId);
        if (!apiIndex) {
            warn(`deleteSubscriptionApiIndexEntry: Could not find index for API ${apiId}; (re-)creating.`);
            apiIndex = [];
        }
        let indexOfApp = -1;
        for (let i = 0; i < apiIndex.length; ++i) {
            const entry = apiIndex[i];
            if (entry.application == appId) {
                indexOfApp = i;
                break;
            }
        }
        if (indexOfApp >= 0) {
            // remove from index
            // debug(apiIndex);
            apiIndex.splice(indexOfApp, 1);
            // debug(apiIndex);
            this.saveSubscriptionApiIndex(apiId, apiIndex);
        } else {
            warn(`deleteSubscriptionApiIndexEntry called to remove entry for ${appId} which is not present for API ${apiId}`);
        }
    }

    createSync(newSubscription) {
        debug('createSync()');

        const appId = newSubscription.application;
        const instance = this;
        return this.jsonUtils.withLockedSubscriptions(appId, function () {
            const appSubs = instance.loadSubscriptions(appId);

            // Push new subscription
            appSubs.push(newSubscription);

            // Remember the client ID for writing the index
            const newClientId = newSubscription.clientId;
            // Persist subscriptions; this will encrypt clientId and clientSecret
            instance.saveSubscriptions(appId, appSubs);

            // Add to subscription index, if it has a clientId
            if (newSubscription.clientId) {
                instance.saveSubscriptionIndexEntry(newClientId, newSubscription);
            }
            // Add API index for subscription
            instance.addSubscriptionApiIndexEntry(newSubscription);

            return newSubscription;
        });
    }

    deleteSync(appId, apiId, subscriptionId) {
        debug('deleteSync()');

        const instance = this;
        return this.jsonUtils.withLockedSubscriptions(appId, function () {
            const appSubs = instance.loadSubscriptions(appId);
            const subsIndex = appSubs.findIndex(s => s.id === subscriptionId);
            if (subsIndex < 0) {
                throw utils.makeError(404, 'Not found. Subscription to API "' + apiId + '" does not exist: ' + appId);
            }
            const subscriptionData = appSubs[subsIndex];
            // We need to remove the subscription from the index, if necessary
            const clientId = subscriptionData.clientId;

            instance.jsonApprovals.deleteByAppAndApiSync(appId, apiId);
            appSubs.splice(subsIndex, 1);

            // Persist again
            instance.saveSubscriptions(appId, appSubs);

            // Now check the clientId
            if (clientId) {
                instance.deleteSubscriptionIndexEntry(clientId);
            }
            // Delete the subscription from the API index
            instance.deleteSubscriptionApiIndexEntry(subscriptionData);
        });
    }

    // static findSubsIndex(appSubs, apiId) {
    //     let subsIndex = -1;
    //     for (let i = 0; i < appSubs.length; ++i) {
    //         if (appSubs[i].api == apiId) {
    //             subsIndex = i;
    //             break;
    //         }
    //     }
    //     return subsIndex;
    // }

    patchSync(appId, subsInfo, patchingUserId) {
        debug('patchSync()');
        const instance = this;
        return this.jsonUtils.withLockedSubscriptions(appId, function () {
            const appSubs = instance.loadSubscriptions(appId);
            const subsIndex = appSubs.findIndex(s => s.id == subsInfo.id);
            if (subsIndex < 0) {
                return utils.makeError(404, 'Not found. Subscription does not exist');
            }

            appSubs[subsIndex] = subsInfo;
            const tempClientId = subsInfo.clientId;

            instance.saveSubscriptions(appId, appSubs);

            // In case we have a client ID, update the susbcription index
            if (tempClientId) {
                instance.saveSubscriptionIndexEntry(tempClientId, subsInfo);
            }
            return subsInfo;
        });
    }

    loadAndFindSubscription(appId, apiId, callback) {
        debug(`loadAndFindSubscription(${appId}, ${apiId})`);

        const appSubs = this.loadSubscriptions(appId);
        let subsIndex = -1;
        for (let i = 0; i < appSubs.length; ++i) {
            if (appSubs[i].api == apiId) {
                subsIndex = i;
                break;
            }
        }
        if (subsIndex < 0) {
            return null;
        }
        return appSubs[subsIndex];
    }

    getByAppAndApiSync(appId, apiId) {
        debug(`getByAppAndApi(${appId}, ${apiId})`);
        const subsInfo = this.loadAndFindSubscription(appId, apiId);
        return subsInfo;
    }

    getByClientIdSync(clientId) {
        debug(`getByClientIdSync(${clientId})`);
        const indexEntry = this.loadSubscriptionIndexEntry(clientId);
        if (!indexEntry) {
            return null;
        } // Not found

        const appSub = this.loadAndFindSubscription(indexEntry.application, indexEntry.api);
        if (!appSub) {
            const errorMessage = 'Inconsistent state. Please notify operator: Subscription for app ' + indexEntry.application + ' to API ' + indexEntry.api + ' not found.';
            error("getSubscriptionByClientId(): " + errorMessage);
            throw utils.makeError(500, errorMessage);
        }
        return appSub;
    }

    getByApiSync(apiId, offset, limit) {
        debug(`getByApi(${apiId})`);
        const apiSubs = this.loadSubscriptionApiIndex(apiId);
        return { rows: apiSubs, count: apiSubs.length };
    }
}

module.exports = JsonSubscriptions;
