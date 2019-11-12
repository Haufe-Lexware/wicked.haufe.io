'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:applications');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');
const ownerRoles = require('../../../routes/ownerRoles');
const APP_MAX_LENGTH_DESCRIPTION = 1024;

class JsonApplications {

    constructor(jsonUtils, jsonUsers, jsonSubscriptions, jsonApprovals) {
        this.jsonUtils = jsonUtils;
        this.jsonUsers = jsonUsers;
        this.jsonSubscriptions = jsonSubscriptions;
        this.jsonApprovals = jsonApprovals;
    }

    // =================================================
    // DAO contract
    // =================================================

    getById(appId, callback) {
        debug('getById()');
        this.jsonUtils.checkCallback(callback);
        let appInfo;
        try {
            appInfo = this.loadApplication(appId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, appInfo);
    }

    create(appCreateInfo, creatingUserId, callback) {
        debug('create()');
        this.jsonUtils.checkCallback(callback);
        let newApp;
        try {
            newApp = this.createSync(appCreateInfo, creatingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, newApp);
    }

    save(appInfo, savingUserId, callback) {
        debug('save()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.saveApplication(appInfo, savingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, appInfo);
    }

    delete(appId, deletingUserId, callback) {
        debug('delete()');
        this.jsonUtils.checkCallback(callback);
        let deletedAppInfo;
        try {
            deletedAppInfo = this.deleteSync(appId, deletingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, deletedAppInfo);
    }

    getAll(filter, orderBy, offset, limit, noCountCache, callback) {
        debug('getAll()');
        // noCountCache not used here, it doesn't have any impact
        this.jsonUtils.checkCallback(callback);
        let allApps;
        try {
            allApps = this.getAllSync(filter, orderBy, offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, allApps.rows, { count: allApps.count, cached: false });
    }

    getIndex(offset, limit, callback) {
        debug('getIndex()');
        this.jsonUtils.checkCallback(callback);
        let appsIndex;
        try {
            appsIndex = this.getIndexSync(offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, appsIndex.rows, { count: appsIndex.count, cached: false });
    }

    getCount(callback) {
        debug('getCount()');
        this.jsonUtils.checkCallback(callback);
        let appCount;
        try {
            appCount = this.getCountSync();
        } catch (err) {
            return callback(err);
        }
        return callback(null, appCount);
    }

    getOwners(appId, callback) {
        debug('getOwners()');
        this.jsonUtils.checkCallback(callback);
        let ownerList;
        try {
            ownerList = this.getOwnersSync(appId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, ownerList);
    }

    addOwner(appId, addUserId, role, addingUserId, callback) {
        debug('addOwner()');
        this.jsonUtils.checkCallback(callback);
        let updatedAppInfo;
        try {
            updatedAppInfo = this.addOwnerSync(appId, addUserId, role, addingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, updatedAppInfo);
    }

    deleteOwner(appId, deleteUserId, deletingUserId, callback) {
        debug('deleteOwner()');
        this.jsonUtils.checkCallback(callback);
        let updatedAppInfo;
        try {
            updatedAppInfo = this.deleteOwnerSync(appId, deleteUserId, deletingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, updatedAppInfo);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    static findOwner(appInfo) {
        if (!appInfo.owners || appInfo.owners.length === 0) {
            return null;
        }

        for (let i = 0; i < appInfo.owners.length; ++i) {
            const owner = appInfo.owners[i];
            if (owner.role === 'owner') {
                return owner;
            }
        }

        warn(`Application ${appInfo.id} does not have an owner with role 'owner'.`);
        return appInfo.owners[0];
    }

    getAllSync(filter, orderBy, offset, limit) {
        debug('getAllSync()');
        // Meh. This is super expensive, but you shouldn't use the JSON
        // backend for production anyway. Plus, this is only for admins.
        // So it's not that bad.
        const appsIndex = this.loadAppsIndex();
        const appInfoList = [];
        for (let i = 0; i < appsIndex.length; ++i) {
            const appId = appsIndex[i].id;
            const appInfo = this.loadApplication(appId);
            if (!appInfo) {
                warn(`getAllSync: Could not load application with id ${appId}`);
                continue;
            }
            const owner = JsonApplications.findOwner(appInfo);
            if (owner) {
                appInfo.ownerUserId = owner.userId;
                appInfo.ownerEmail = owner.email;
            }
            delete appInfo.owners;
            appInfoList.push(appInfo);
        }

        if (!orderBy) {
            orderBy = 'id ASC';
        }

        const filterResult = this.jsonUtils.filterAndPage(appInfoList, filter, orderBy, offset, limit);

        return {
            rows: filterResult.list,
            count: filterResult.filterCount
        };
    }

    getIndexSync(offset, limit) {
        debug('getIndexSync()');
        const appsIndex = this.loadAppsIndex();
        return {
            rows: this.jsonUtils.pageArray(appsIndex, offset, limit),
            count: appsIndex.length
        };
    }

    getCountSync() {
        debug('getCountSync()');
        const appsIndex = this.loadAppsIndex();
        return appsIndex.length;
    }

    createSync(appCreateInfo, creatingUserId) {
        debug('createSync()');
        const appId = appCreateInfo.id.trim();
        const instance = this;
        return instance.jsonUtils.withLockedAppsIndex(function () {
            const appsIndex = instance.loadAppsIndex();
            // Check for dupes
            for (let i = 0; i < appsIndex.length; ++i) {
                const appInfo = appsIndex[i];
                if (appInfo.id === appId) {
                    throw utils.makeError(409, 'Application ID "' + appId + '" already exists.');
                }
            }

            // In special cases, we may want to create an application without owners (migration)
            const ownerList = [];
            let userInfo;
            if (creatingUserId) {
                userInfo = instance.jsonUsers.loadUser(creatingUserId);
                if (!userInfo) {
                    throw utils.makeError(500, `createSync(): User with id ${creatingUserId} was not found.`);
                }
            }
            if (userInfo) {
                ownerList.push({
                    userId: userInfo.id,
                    email: userInfo.email,
                    role: ownerRoles.OWNER,
                    _links: {
                        user: { href: '/users/' + userInfo.id }
                    }
                });
            }

            // Now we can add the application
            const newApp = {
                id: appId,
                name: appCreateInfo.name.substring(0, 128),
                redirectUri: appCreateInfo.redirectUri,
                redirectUris: appCreateInfo.redirectUris,
                confidential: !!appCreateInfo.confidential,
                clientType: appCreateInfo.clientType,
                mainUrl: appCreateInfo.mainUrl,
                owners: ownerList,
                _links: {
                    self: { href: '/applications/' + appId }
                }
            };

            if (appCreateInfo.description) {
                newApp.description = appCreateInfo.description.substring(0, APP_MAX_LENGTH_DESCRIPTION);
            }
            daoUtils.migrateApplicationData(newApp);

            if (userInfo) {
                // Push new application to user
                userInfo.applications.push({
                    id: appId,
                    _links: {
                        application: { href: '/applications/' + appId }
                    }
                });
            }

            // Push to index
            appsIndex.push({ id: appId });
            // Persist application
            instance.saveApplication(newApp, userInfo ? userInfo.id : null);
            // Persist application subscriptions (empty)
            instance.jsonSubscriptions.saveSubscriptions(appId, []);
            // Persist index
            instance.saveAppsIndex(appsIndex);

            if (userInfo) {
                // Persist user
                delete userInfo.name;
                instance.jsonUsers.saveUser(userInfo, userInfo.id);
            }

            return newApp;
        });
    }

    deleteSync(appId, deletingUserId) {
        debug('deleteSync()');

        const appInfo = this.loadApplication(appId);
        // This shouldn't happen, as it's checked in the generic code as well
        if (!appInfo) {
            throw utils.makeError(404, `Application ${appId} not found.`);
        }
        const ownerIdList = [];
        for (let i = 0; i < appInfo.owners.length; ++i) {
            ownerIdList.push(appInfo.owners[i].userId);
        }

        const instance = this;
        // Ohhh, this is really bad, but deleting an application triggers
        // a whole lot of things, like removing the application from its
        // owners, removing subscriptions, and such things. On Postgres, this
        // is a lot easier, as the DELETE just cascades to tables having foreign
        // keys on the applications entity, but here we have to do it by hand...
        return instance.jsonUtils.withLockedAppsIndex(function () {
            return instance.jsonUtils.withLockedApp(appId, function () {
                return instance.jsonUtils.withLockedUserList(ownerIdList, function () {
                    return instance.jsonUtils.withLockedApprovals(function () {
                        const appsIndex = instance.loadAppsIndex();
                        let index = -1;
                        for (let i = 0; i < appsIndex.length; ++i) {
                            if (appId == appsIndex[i].id) {
                                index = i;
                                break;
                            }
                        }

                        if (index < 0) {
                            throw "Application with id " + appId + " was not found in index.";
                        }
                        appsIndex.splice(index, 1);

                        for (let i = 0; i < ownerIdList.length; ++i) {
                            const ownerInfo = instance.jsonUsers.loadUser(ownerIdList[i]);
                            if (!ownerInfo) {
                                throw utils.makeError(500, "In DELETE applications: Could not find owner " + ownerIdList[i]);
                            }
                            // Remove application from applications list
                            let found = true;
                            while (found) {
                                let index = -1;
                                for (let j = 0; j < ownerInfo.applications.length; ++j) {
                                    if (ownerInfo.applications[j].id == appId) {
                                        index = j;
                                        break;
                                    }
                                }
                                if (index >= 0) {
                                    ownerInfo.applications.splice(index, 1);
                                } else {
                                    found = false;
                                }
                            }
                            try {
                                delete ownerInfo.name;
                                instance.jsonUsers.saveUser(ownerInfo, deletingUserId);
                            } catch (err) {
                                error('Caught exception saving user ' + ownerInfo.id);
                                error(err);
                            }
                        }

                        // Now persist the index
                        instance.saveAppsIndex(appsIndex);

                        // And delete the application
                        const appsDir = instance.jsonUtils.getAppsDir();
                        const appsFileName = path.join(appsDir, appId + '.json');

                        if (fs.existsSync(appsFileName)) {
                            fs.unlinkSync(appsFileName);
                        }

                        // And its subcriptions
                        // Delete all subscriptions from the subscription indexes (if applicable)
                        const appSubs = instance.jsonSubscriptions.loadSubscriptions(appId);
                        for (let i = 0; i < appSubs.length; ++i) {
                            const appSub = appSubs[i];
                            if (appSub.clientId) {
                                instance.jsonSubscriptions.deleteSubscriptionIndexEntry(appSub.clientId);
                            }
                            instance.jsonSubscriptions.deleteSubscriptionApiIndexEntry(appSub);
                        }
                        // And now delete the subscription file
                        const subsFileName = path.join(appsDir, appId + '.subs.json');
                        if (fs.existsSync(subsFileName)) {
                            fs.unlinkSync(subsFileName);
                        }

                        // Now we'll try to clean up the approvals, if needed
                        instance.jsonApprovals.deleteByAppSync(appId);

                        //////////////////////////////

                        return appInfo;
                    });
                });
            });
        });
    }

    getOwnersSync(appId) {
        debug('getOwnersSync()');
        const appInfo = this.loadApplication(appId);
        if (!appInfo) {
            throw utils.makeError(404, 'Unknown application, cannot return owners.');
        }
        return appInfo.owners;
    }

    addOwnerSync(appId, addUserId, role, addingUserId) {
        debug('addOwnerSync()');
        const instance = this;
        return instance.jsonUtils.withLockedApp(appId, function () {
            return instance.jsonUtils.withLockedUser(addUserId, function () {
                const userInfo = instance.jsonUsers.loadUser(addUserId);
                if (!userInfo) {
                    throw utils.makeError(500, `addOwnerSync(): Could not load user with id ${addUserId}`);
                }
                userInfo.applications.push({
                    id: appId,
                    _links: {
                        application: { href: '/applications/' + appId }
                    }
                });

                const appInfo = instance.loadApplication(appId);

                appInfo.owners.push({
                    userId: userInfo.id,
                    email: userInfo.email,
                    role: role,
                    _links: {
                        user: { href: '/users/' + userInfo.id }
                    }
                });

                // Persist application
                instance.saveApplication(appInfo, addingUserId);

                // Persist user
                instance.jsonUsers.saveUser(userInfo, addingUserId);

                return appInfo;
            });
        });
    }

    deleteOwnerSync(appId, deleteUserId, deletingUserId) {
        debug('deleteOwnerSync()');
        // Do da locking
        const instance = this;
        return instance.jsonUtils.withLockedApp(appId, function () {
            return instance.jsonUtils.withLockedUser(deleteUserId, function () {
                const userToDelete = instance.jsonUsers.loadUser(deleteUserId);
                const appInfo = instance.loadApplication(appId);

                let found = true;
                while (found) {
                    let index = -1;
                    for (let i = 0; i < appInfo.owners.length; ++i) {
                        if (appInfo.owners[i].userId == userToDelete.id) {
                            index = i;
                            break;
                        }
                    }
                    if (index >= 0) {
                        appInfo.owners.splice(index, 1);
                    } else {
                        found = false;
                    }
                }
                found = true;
                while (found) {
                    let index = -1;
                    for (let i = 0; i < userToDelete.applications.length; ++i) {
                        if (userToDelete.applications[i].id == appId) {
                            index = i;
                            break;
                        }
                    }
                    if (index >= 0) {
                        userToDelete.applications.splice(index, 1);
                    } else {
                        found = false;
                    }
                }

                // Persist user
                instance.jsonUsers.saveUser(userToDelete, deletingUserId);
                // Persist application
                instance.saveApplication(appInfo, deletingUserId);

                // return the updated application info object
                return appInfo;
            });
        });
    }

    loadAppsIndex() {
        debug('loadAppsIndex()');
        const appsDir = this.jsonUtils.getAppsDir();
        const appIndexFileName = path.join(appsDir, '_index.json');
        return JSON.parse(fs.readFileSync(appIndexFileName, 'utf8'));
    }

    saveAppsIndex(appsIndex) {
        debug('saveAppsIndex()');
        const appsDir = this.jsonUtils.getAppsDir();
        const appIndexFileName = path.join(appsDir, '_index.json');
        fs.writeFileSync(appIndexFileName, JSON.stringify(appsIndex, null, 2), 'utf8');
    }

    loadApplication(appId) {
        debug('loadApplication(): ' + appId);
        const appsDir = this.jsonUtils.getAppsDir();
        const appsFileName = path.join(appsDir, appId + '.json');
        if (!fs.existsSync(appsFileName)) {
            return null;
        }
        //throw "applications.loadApplication - Application not found: " + appId;
        const appInfo = JSON.parse(fs.readFileSync(appsFileName, 'utf8'));
        daoUtils.migrateApplicationData(appInfo);
        return appInfo;
    }

    saveApplication(appInfo, userId) {
        debug('saveApplication()');
        debug(appInfo);
        const appsDir = this.jsonUtils.getAppsDir();
        const appsFileName = path.join(appsDir, appInfo.id + '.json');
        if (userId) {
            appInfo.changedBy = userId;
        } else if (appInfo.changedBy) {
            delete appInfo.changedBy;
        }
        appInfo.changedDate = utils.getUtc();
        daoUtils.migrateApplicationData(appInfo);
        fs.writeFileSync(appsFileName, JSON.stringify(appInfo, null, 2), 'utf8');
    }
}

module.exports = JsonApplications;
