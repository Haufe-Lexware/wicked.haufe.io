'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:utils');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');

class JsonUtils {

    constructor(dynamicBasePath) {
        // This may be empty, then the data is retrieved from app.get('dynamic_config')
        this.dynamicBasePath = dynamicBasePath;

        this.LISTENER_FILE = '_listeners.json';
    }

    // USEFUL THINGS
    pageArray(array, offset, limit) {
        debug(`pageArray(..., ${offset}, ${limit})`);
        if (offset === 0 && limit === 0) {
            return array;
        }
        return array.slice(offset, offset + limit);
    }

    /**
     * Filters, sorts and pages an array of objects. Returns an object containing two
     * properties: `list` and `filterCount`. The list is the filtered, sorted and paged
     * list (taking limit and offset into account), and filterCount is the total count
     * before the paging was applied.
     * 
     * @param {array} rows 
     * @param {object} filter object containing {"name": "value"} pairs to filter for
     * @param {*} orderBy "<field> ASC|DESC"
     * @param {*} offset 
     * @param {*} limit 
     */
    filterAndPage(rows, filter, orderBy, offset, limit) {
        debug(`filterAndPage()`);
        let filteredRows = rows;

        if (filter) {
            const tempList = [];
            for (let i = 0; i < rows.length; ++i) {
                const row = rows[i];
                let matches = true;
                for (let prop in filter) {
                    if (!filter[prop]) {
                        continue;
                    }
                    const filterValue = filter[prop].toLowerCase();
                    if (!filterValue) {
                        continue;
                    }
                    if (!row.hasOwnProperty(prop)) {
                        matches = false;
                        break;
                    }
                    if (!row[prop]) {
                        matches = false;
                        break;
                    }
                    const thisValue = row[prop].toLowerCase();
                    if (thisValue.indexOf(filterValue) < 0) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    tempList.push(row);
                }
            }
            filteredRows = tempList;
        }

        if (orderBy) {
            const o = orderBy.split(' ');
            const sortField = o[0];
            const dir = o[1];
            const firstOrder = dir === 'ASC' ? -1 : 1;
            const lastOrder = dir === 'ASC' ? 1 : -1;
            filteredRows.sort((a, b) => {
                if (!a.hasOwnProperty(sortField) && !b.hasOwnProperty(sortField)) {
                    return 0;
                }
                if (a.hasOwnProperty(sortField) && !b.hasOwnProperty(sortField)) {
                    return firstOrder;
                }
                if (!a.hasOwnProperty(sortField) && b.hasOwnProperty(sortField)) {
                    return firstOrder;
                }
                const aVal = a[sortField];
                const bVal = b[sortField];
                if (aVal < bVal) {
                    return firstOrder;
                }
                if (aVal > bVal) {
                    return lastOrder;
                }
                return 0;
            });
        }

        return {
            list: this.pageArray(filteredRows, offset, limit),
            filterCount: filteredRows.length
        };
    }

    checkCallback(callback) {
        if (!callback || typeof (callback) !== 'function') {
            error('Value of callback: ' + callback);
            throw new Error('Parameter "callback" is null or not a function');
        }
    }

    getDynamicDir() {
        if (this.dynamicBasePath) {
            return this.dynamicBasePath;
        }
        return utils.getApp().get('dynamic_config');
    }

    // LOCKING UTILITY FUNCTIONS

    withLockedUserList(userIdList, actionHook) {
        debug('withLockedUserList()');
        debug(userIdList);
        const lockedUsers = [];
        try {
            for (let i = 0; i < userIdList.length; ++i) {
                if (!this.lockUser(userIdList[i])) {
                    throw utils.makeError(423, 'User with id ' + userIdList[i] + ' is locked. Try again later.');
                }
                lockedUsers.push(userIdList[i]);
            }

            const retVal = actionHook();

            debug('withLockedUserList() finished');

            return retVal;
        } finally {
            for (let i = 0; i < lockedUsers.length; ++i) {
                try { this.unlockUser(lockedUsers[i]); } catch (err) { error(err); }
            }
            debug('withLockedUserList() cleaned up');
        }
    }

    withLockedUser(userId, actionHook) {
        debug('withLockedUser(): ' + userId);
        return this.withLockedUserList([userId], actionHook);
    }

    withLockedUserIndex(actionHook) {
        debug('withLockedUserIndex()');
        let lockedIndex = false;
        try {
            if (!this.lockUserIndex()) {
                throw utils.makeError(423, 'User index is currently locked. Try again later.');
            }
            lockedIndex = true;

            const retVal = actionHook();

            debug('withLockedUserIndex() finished');

            return retVal;
        } finally {
            if (lockedIndex) {
                try {
                    this.unlockUserIndex();
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedUserIndex() cleaned up');
        }
    }

    withLockedAppsIndex(actionHook) {
        debug('withLockedAppsIndex()');
        let lockedIndex = false;
        try {
            if (!this.lockAppsIndex()) {
                throw utils.makeError(423, 'Application index is currently locked. Try again later.');
            }
            lockedIndex = true;

            const retVal = actionHook();

            debug('withLockedAppsIndex() finished');

            return retVal;
        } finally {
            if (lockedIndex) {
                try {
                    this.unlockAppsIndex();
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedAppsIndex() cleaned up');
        }
    }

    withLockedApp(appId, actionHook) {
        debug('withLockedApp(): ' + appId);
        let lockedApp = false;
        try {
            if (!this.lockApplication(appId)) {
                throw utils.makeError(423, 'Application is locked. Please try again later.');
            }
            lockedApp = true;

            const retVal = actionHook();

            debug('withLockedApp(): ' + appId + ' finished');

            return retVal;
        } finally {
            if (lockedApp) {
                try {
                    this.unlockApplication(appId);
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedApp(): ' + appId + ' cleaned up');
        }
    }

    withLockedSubscriptions(appId, actionHook) {
        debug('withLockedSubscriptions(): ' + appId);
        let lockedSubscriptions = false;
        try {
            if (!this.lockSubscriptions(appId)) {
                throw utils.makeError(423, 'Application subscriptions are locked. Try again later.');
            }
            lockedSubscriptions = true;

            const retVal = actionHook();

            debug('withLockedSubscriptions(): ' + appId + ' finished');

            return retVal;
        } finally {
            if (lockedSubscriptions) {
                try {
                    this.unlockSubscriptions(appId);
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedSubscriptions(): ' + appId + ' cleaned up');
        }
    }

    withLockedApprovals(actionHook) {
        debug('withLockedApprovals()');
        let lockedApprovals = false;
        try {
            if (!this.lockApprovals()) {
                throw utils.makeError(423, 'Approvals index is locked. Try again later.');
            }
            lockedApprovals = true;

            const retVal = actionHook();

            debug('withLockedApprovals() finished');

            return retVal;
        } finally {
            if (lockedApprovals) {
                try {
                    this.unlockApprovals();
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedApprovals() cleaned up');
        }
    }

    withLockedEvents(listenerId, actionHook) {
        debug('withLockedEvents(): ' + listenerId);
        let lockedEvents = false;
        try {
            if (!this.lockEvents(listenerId)) {
                throw utils.makeError(423, 'Events for listener are locked. Try again later.');
            }
            lockedEvents = true;

            const retVal = actionHook();

            debug('withLockedEvents(): ' + listenerId + ' finished');

            return retVal;
        } finally {
            if (lockedEvents) {
                try {
                    this.unlockEvents(listenerId);
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedEvents(): ' + listenerId + ' cleaned up');
        }
    }

    withLockedListeners(listenerId, actionHook) {
        debug('withLockedListeners()');
        let lockedListeners = false;
        try {
            if (!this.lockListeners()) {
                throw utils.makeError(423, 'Listener index locked. Try again later.');
            }
            lockedListeners = true;

            const retVal = actionHook();

            debug('withLockedListeners() finished');

            return retVal;
        } finally {
            if (lockedListeners) {
                try {
                    this.unlockListeners();
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedListeners() cleaned up');
        }
    }

    withLockedVerifications(actionHook) {
        debug('withLockedVerifications()');
        let lockedVerifications = false;
        try {
            if (!this.lockVerifications()) {
                throw utils.makeError(423, 'Verification index locked. Try again later.');
            }
            lockedVerifications = true;

            const retVal = actionHook();

            debug('withLockedVerifications() finished');

            return retVal;
        } finally {
            if (lockedVerifications) {
                try {
                    this.unlockVerifications();
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedVerifications() cleaned up');
        }
    }

    withLockedMetadata(actionHook) {
        debug('withLockedMetadata()');
        let lockedMetadata = false;
        try {
            if (!this.lockMetadata()) {
                throw utils.makeError(423, 'Metadata locked. Try again later.');
            }
            lockedMetadata = true;

            const retVal = actionHook();

            debug('withLockedMetadata() finished');

            return retVal;
        } finally {
            if (lockedMetadata) {
                try {
                    this.unlockMetadata();
                } catch (err) {
                    error(err);
                }
            }
            debug('withLockedMetadata() cleaned up');
        }
    }

    globalLock() {
        const globalLockFileName = path.join(this.getDynamicDir(), 'global.lock');
        if (fs.existsSync(globalLockFileName)) {
            throw utils.makeError(423, "utils.globalLock - System already is globally locked!");
        }
        fs.writeFileSync(globalLockFileName, '');
        return true;
    }

    globalUnlock() {
        const globalLockFileName = path.join(this.getDynamicDir(), 'global.lock');
        if (!fs.existsSync(globalLockFileName)) {
            throw utils.makeError(423, "utils.globalUnlock - System isn't locked, cannot unlock!");
        }
        fs.unlinkSync(globalLockFileName);
        return true;
    }

    hasGlobalLock() {
        const globalLockFileName = path.join(this.getDynamicDir(), 'global.lock');
        return fs.existsSync(globalLockFileName);
    }

    lockFile(subDir, fileName) {
        debug(`lockFile(): ${subDir ? '/' + subDir : ''}${fileName}`);
        if (this.hasGlobalLock()) {
            return false;
        }
        const baseDir = subDir ? path.join(this.getDynamicDir(), subDir) : this.getDynamicDir();
        const fullFileName = path.join(baseDir, fileName);
        const lockFileName = fullFileName + '.lock';

        if (!fs.existsSync(fullFileName)) {
            throw utils.makeError(500, "utils.lockFile - File not found: " + fileName);
        }

        if (fs.existsSync(lockFileName)) {
            return false;
        }

        fs.writeFileSync(lockFileName, '');
        return true;
    }

    unlockFile(subDir, fileName) {
        debug(`lockFile(): ${subDir ? '/' + subDir : ''}${fileName}`);
        const baseDir = subDir ? path.join(this.getDynamicDir(), subDir) : this.getDynamicDir();
        const lockFileName = path.join(baseDir, fileName + '.lock');

        if (fs.existsSync(lockFileName)) {
            fs.unlinkSync(lockFileName);
        }
    }

    // SPECIFIC LOCKS

    // USERS

    lockUserIndex() {
        return this.lockFile('users', '_index.json');
    }

    unlockUserIndex() {
        this.unlockFile('users', '_index.json');
    }

    lockUser(userId) {
        return this.lockFile('users', userId + '.json');
    }

    unlockUser(userId) {
        this.unlockFile('users', userId + '.json');
    }

    // APPLICATIONS

    lockAppsIndex() {
        return this.lockFile('applications', '_index.json');
    }

    unlockAppsIndex() {
        this.unlockFile('applications', '_index.json');
    }

    lockApplication(appId) {
        return this.lockFile('applications', appId + '.json');
    }

    unlockApplication(appId) {
        this.unlockFile('applications', appId + '.json');
    }

    getAppsDir() {
        return path.join(this.getDynamicDir(), 'applications');
    }

    // SUBSCRIPTIONS

    lockSubscriptions(appId) {
        return this.lockFile('subscriptions', appId + '.subs.json');
    }

    unlockSubscriptions(appId) {
        this.unlockFile('subscriptions', appId + '.subs.json');
    }

    // APPROVALS

    lockApprovals() {
        return this.lockFile('approvals', '_index.json');
    }

    unlockApprovals() {
        return this.unlockFile('approvals', '_index.json');
    }

    // WEBHOOKS

    lockListeners() {
        return this.lockFile('webhooks', this.LISTENER_FILE);
    }

    unlockListeners() {
        return this.unlockFile('webhooks', this.LISTENER_FILE);
    }

    lockEvents(listenerId) {
        return this.lockFile('webhooks', listenerId + '.json');
    }

    unlockEvents(listenerId) {
        this.unlockFile('webhooks', listenerId + '.json');
    }

    // VERIFICATIONS

    lockVerifications() {
        return this.lockFile('verifications', '_index.json');
    }

    unlockVerifications() {
        return this.unlockFile('verifications', '_index.json');
    }

    // METADATA

    lockMetadata() {
        return this.lockFile(null, 'meta.json');
    }

    unlockMetadata() {
        return this.unlockFile(null, 'meta.json');
    }
}

module.exports = JsonUtils;
