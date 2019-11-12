'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:webhooks');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');

class JsonWebhooks {
    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    get listeners() {
        if (!this._listenersProxy) {
            this._listenersProxy = {
                getAll: (callback) => this.listeners_getAll(callback),
                getById: (listenerId, callback) => this.listeners_getById(listenerId, callback),
                upsert: (listenerInfo, callback) => this.listeners_upsert(listenerInfo, callback),
                delete: (listenerId, callback) => this.listeners_delete(listenerId, callback)
            };
        }
        return this._listenersProxy;
    }

    listeners_getAll(callback) {
        debug('getAll()');
        this.jsonUtils.checkCallback(callback);
        let listeners;
        try {
            listeners = this.loadListeners();
        } catch (err) {
            return callback(err);
        }
        return callback(null, listeners);
    }

    listeners_getById(listenerId, callback) {
        debug(`getById(${listenerId}`);
        this.jsonUtils.checkCallback(callback);
        let listener;
        try {
            listener = this.getListener(listenerId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, listener);
    }

    listeners_upsert(listenerInfo, callback) {
        debug('upsert()');
        this.jsonUtils.checkCallback(callback);
        let upsertedInfo;
        try {
            upsertedInfo = this.upsertListenerSync(listenerInfo);
        } catch (err) {
            return callback(err);
        }
        return callback(null, upsertedInfo);
    }

    listeners_delete(listenerId, callback) {
        debug(`delete(${listenerId})`);
        this.jsonUtils.checkCallback(callback);
        let deletedListenerInfo;
        try {
            deletedListenerInfo = this.deleteListenerSync(listenerId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, deletedListenerInfo);
    }

    get events() {
        if (!this._eventsProxy) {
            this._eventsProxy = {
                hookListeners: (dispatchEvents, callback) => this.events_hookListeners(dispatchEvents, callback),
                getByListener: (listenerId, callback) => this.events_getByListener(listenerId, callback),
                flush: (listenerId, callback) => this.events_flush(listenerId, callback),
                create: (eventData, callback) => this.events_create(eventData, callback),
                delete: (listenerId, eventId, callback) => this.events_delete(listenerId, eventId, callback)
            };
        }
        return this._eventsProxy;
    }

    events_hookListeners(dispatchEvents, callback) {
        // Check if we need to fire hooks from times to times (every 10 seconds)
        const hookInterval = process.env.PORTAL_API_HOOK_INTERVAL || '10000';
        debug('Setting webhook interval to ' + hookInterval);
        setInterval(() => {
            dispatchEvents(() => { });
        }, hookInterval);
    }

    events_getByListener(listenerId, callback) {
        debug(`getByListener(${listenerId})`);
        this.jsonUtils.checkCallback(callback);
        let events;
        try {
            events = this.getEventsByListenerSync(listenerId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, events);
    }

    events_flush(listenerId, callback) {
        debug(`flush(${listenerId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.flushEventsSync(listenerId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    events_create(eventData, callback) {
        debug('create()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.createLogSync(eventData);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    events_delete(listenerId, eventId, callback) {
        debug(`delete(${listenerId}, ${eventId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteEventSync(listenerId, eventId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    static getIndex(infos, id) {
        let index = -1;
        for (let i = 0; i < infos.length; ++i) {
            if (id == infos[i].id) {
                index = i;
                break;
            }
        }
        return index;
    }

    loadListeners() {
        debug('loadListeners()');
        if (!this._listeners) {
            const webhooksDir = path.join(this.jsonUtils.getDynamicDir(), 'webhooks');
            const listenersFile = path.join(webhooksDir, this.jsonUtils.LISTENER_FILE);
            if (!fs.existsSync(listenersFile)) {
                this._listeners = [];
            } else {
                this._listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf8'));
            }
        }
        return this._listeners;
    }

    getListener(listenerId) {
        debug(`getListener(${listenerId})`);
        const listenerInfos = this.loadListeners();
        const index = JsonWebhooks.getIndex(listenerInfos, listenerId);
        if (index < 0) {
            return null;
        }
        return listenerInfos[index];
    }

    saveListeners(listenerInfos) {
        debug('saveListeners()');
        debug(listenerInfos);
        const webhooksDir = path.join(this.jsonUtils.getDynamicDir(), 'webhooks');
        const listenersFile = path.join(webhooksDir, this.jsonUtils.LISTENER_FILE);
        fs.writeFileSync(listenersFile, JSON.stringify(listenerInfos, null, 2), 'utf8');
        // Invalidate listeners.
        this._listeners = null;
    }

    loadEvents(listenerId) {
        debug('loadEvents(): ' + listenerId);
        const webhooksDir = path.join(this.jsonUtils.getDynamicDir(), 'webhooks');
        const eventsFile = path.join(webhooksDir, listenerId + '.json');
        if (!fs.existsSync(eventsFile)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
    }

    saveEvents(listenerId, eventList) {
        debug('saveEvents(): ' + listenerId);
        const webhooksDir = path.join(this.jsonUtils.getDynamicDir(), 'webhooks');
        const eventsFile = path.join(webhooksDir, listenerId + '.json');
        fs.writeFileSync(eventsFile, JSON.stringify(eventList, null, 2), 'utf8');
    }

    // ===== UTILITIES =====

    // // Currently not used
    // jsonWebhooks.pendingEventsCount = function () {
    //     var listeners = jsonWebhooks.loadListeners();
    //     var eventCount = 0;
    //     for (var i = 0; i < listeners.length; ++i) {
    //         var events = jsonWebhooks.loadEvents(listeners[i].id);
    //         eventCount = eventCount + events.length;
    //     }
    //     debug('pendingEventsCount() == ' + eventCount);
    //     return eventCount;
    // };

    lockAll() {
        debug('lockAll()');

        if (this.jsonUtils.hasGlobalLock()) {
            debug('global lock already set!');
            return false;
        }
        const lockList = [];
        const listenerList = this.loadListeners();
        let success = true;
        let internalError = null;
        try {
            for (let i = 0; i < listenerList.length; ++i) {
                let listenerId = listenerList[i].id;
                if (!this.jsonUtils.lockEvents(listenerId)) {
                    success = false;
                    break;
                }
                lockList.push(listenerId);
            }
        } catch (err) {
            internalError = err;
            success = false;
        }
        if (!success) {
            for (let i = 0; i < lockList.length; ++i) {
                try { this.jsonUtils.unlockEvents(lockList[i]); } catch (err2) { debug(err2); error(err2); }
            }
        }
        if (internalError) {
            throw internalError;
        }

        return success;
    }

    unlockAll() {
        debug('unlockAll()');
        const listenerList = this.loadListeners();
        for (let i = 0; i < listenerList.length; ++i) {
            try { this.jsonUtils.unlockEvents(listenerList[i].id); } catch (err) { debug(err); error('webhooks.unlockAll: ' + err); }
        }
    }

    upsertListenerSync(listenerInfo) {
        debug('upsertListenerSync()');
        const listenerId = listenerInfo.id;

        const instance = this;
        return this.jsonUtils.withLockedListeners(listenerId, function () {
            const listenerInfos = instance.loadListeners();

            const index = JsonWebhooks.getIndex(listenerInfos, listenerId);
            if (index < 0) {
                listenerInfos.push(listenerInfo);
                // Initialize to empty list
                instance.saveEvents(listenerId, []);
            } else {
                listenerInfos[index] = listenerInfo;
            }

            instance.saveListeners(listenerInfos);

            return listenerInfo;
        });
    }

    deleteListenerSync(listenerId) {
        debug('deleteListenerSync()');
        const instance = this;
        return this.jsonUtils.withLockedListeners(listenerId, function () {
            const listenerInfos = instance.loadListeners();
            const index = JsonWebhooks.getIndex(listenerInfos, listenerId);
            if (index < 0) {
                throw utils.makeError(404, 'Listener not found: ' + listenerId);
            }
            const deletedListenerInfo = listenerInfos[index];
            listenerInfos.splice(index, 1);

            instance.saveListeners(listenerInfos);
            return deletedListenerInfo;
        });
    }

    getEventsByListenerSync(listenerId) {
        debug('getEventsByListenerSync()');
        const listener = this.getListener(listenerId);
        if (!listener) {
            throw utils.makeError(404, 'Listener not found: ' + listenerId);
        }
        const events = this.loadEvents(listenerId);
        return events;
    }

    flushEventsSync(listenerId) {
        debug('flushEventsSync()');
        const listener = this.getListener(listenerId);
        if (!listener) {
            throw utils.makeError(404, 'Listener not found: ' + listenerId);
        }

        const instance = this;
        return this.jsonUtils.withLockedEvents(listenerId, function () {
            // Write empty event list
            instance.saveEvents(listenerId, []);
        });
    }

    deleteEventSync(listenerId, eventId) {
        debug('deleteEventSync()');
        const listener = this.getListener(listenerId);
        if (!listener) {
            throw utils.makeError(404, 'Listener not found: ' + listenerId);
        }

        const instance = this;
        return this.jsonUtils.withLockedEvents(listenerId, function () {
            const events = instance.loadEvents(listenerId);
            const index = JsonWebhooks.getIndex(events, eventId);
            if (index < 0) {
                throw utils.makeError(404, 'Event not found: ' + eventId);
            }

            events.splice(index, 1);

            instance.saveEvents(listenerId, events);
        });
    }

    createLogSync(eventData) {
        debug('createLogSync()');
        const listenerList = this.loadListeners();
        if (listenerList.length === 0) {
            return;
        } // Nothing to do

        let lockedAll = false;
        let err = null;
        try {
            if (!this.lockAll()) {
                throw utils.makeError(423, 'webhooks.retryLog - lockAll failed.');
            }

            lockedAll = true;

            for (let i = 0; i < listenerList.length; ++i) {
                try {
                    const listenerId = listenerList[i].id;
                    const events = this.loadEvents(listenerId);
                    events.push(eventData);
                    this.saveEvents(listenerId, events);
                } catch (internalErr) {
                    debug(internalErr);
                    error('webhooks.logEvent: ' + internalErr);
                    err = internalErr;
                }
            }
        } finally {
            if (lockedAll) {
                this.unlockAll();
            }
        }
        if (err) {
            throw err;
        }
    }
}

module.exports = JsonWebhooks;
