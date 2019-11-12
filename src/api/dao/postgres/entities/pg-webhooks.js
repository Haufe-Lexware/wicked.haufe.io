'use strict';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:webhooks');

const utils = require('../../../routes/utils');

class PgWebhooks {
    constructor(pgUtils) {
        this._listeners = new PgWebhooksListeners(pgUtils);
        this._events = new PgWebhooksEvents(pgUtils, this._listeners);
    }

    get listeners() { return this._listeners; }
    get events() { return this._events; }
}

class PgWebhooksListeners {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getAll(callback) {
        debug('getAll()');
        this.pgUtils.checkCallback(callback);
        return this.getAllListenersImpl(callback);
    }

    getById(listenerId, callback) {
        debug(`getById(${listenerId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.getById('webhook_listeners', listenerId, callback);
    }

    upsert(listenerInfo, callback) {
        debug('upsert()');
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.upsert('webhook_listeners', listenerInfo, null, callback);
    }

    delete(listenerId, callback) {
        debug(`delete(${listenerId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteById('webhook_listeners', listenerId, callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getAllListenersImpl(callback) {
        debug('getAllListenersImpl()');
        return this.pgUtils.getBy('webhook_listeners', [], [], {}, callback);
    }
}

class PgWebhooksEvents {
    constructor(pgUtils, pgWebhooksListeners) {
        this.pgUtils = pgUtils;
        this.pgWebhooksListeners = pgWebhooksListeners;

        this._eventsPending = false;
        this._lastDispatch = 0;
    }

    // =================================================
    // DAO contract
    // =================================================

    hookListeners(dispatchEvents, callback) {
        debug('hookListeners()');
        return this.hookListenersImpl(dispatchEvents, callback);
    }

    getByListener(listenerId, callback) {
        debug(`getByListener(${listenerId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.getBy('webhook_events', 'webhook_listeners_id', listenerId, { orderBy: 'id ASC' }, callback);
    }

    flush(listenerId, callback) {
        debug(`flush(${listenerId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteBy('webhook_events', 'webhook_listeners_id', listenerId, callback);
    }

    create(eventData, callback) {
        debug(`create()`);
        this.pgUtils.checkCallback(callback);
        return this.createImpl(eventData, callback);
    }

    delete(listenerId, eventId, callback) {
        debug(`delete(${listenerId}, ${eventId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteById('webhook_events', eventId, callback);
    }


    // =================================================
    // DAO implementation/internal methods
    // =================================================

    createImpl(eventData, callback) {
        debug('createImpl()');
        const instance = this;
        instance.pgWebhooksListeners.getAllListenersImpl((err, listenerList) => {
            if (err) {
                return callback(err);
            }
            async.forEach(listenerList, (listenerInfo, callback) => {
                const tmpEvent = Object.assign({}, eventData);
                // Each record needs its own ID, not like in the JSON implementation where
                // the ID is reused across the listeners.
                tmpEvent.id = utils.createRandomId();
                tmpEvent.listenerId = listenerInfo.id;
                instance.pgUtils.upsert('webhook_events', tmpEvent, null, callback);
            }, (err) => {
                if (err) {
                    return callback(err);
                }
                debug('Successfully upserted events for all listeners.');
                return callback(null);
            });
        });
    }

    hookListenersImpl(dispatchEvents, callback) {
        debug('hookListenersImpl()');
        const instance = this;
        this.pgUtils.listenToChannel('webhook_insert', (data) => {
            info('Received a pending event, queueing...');
            instance._eventsPending = true;
        });
        setInterval(() => {
            let safetyDispatch = false;
            if (Date.now() - instance._lastDispatch > 10000) {
                debug('safety dispatch of webhook events');
                // Safety check, every ten seconds dispatch anyway.
                safetyDispatch = true;
            }
            if (instance._eventsPending || safetyDispatch) {
                if (instance._eventsPending) {
                    info('Detected pending webhook events, firing dispatcher');
                }
                instance._lastDispatch = Date.now();
                instance._eventsPending = false;
                dispatchEvents((err) => {
                    if (err) {
                        error('ERROR dispatching webhook events');
                        error(err);
                        return;
                    }
                });
            }
        }, 250);
        if (callback) {
            return callback(null);
        }
    }
}


module.exports = PgWebhooks;
