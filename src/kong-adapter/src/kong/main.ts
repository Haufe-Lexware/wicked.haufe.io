'use strict';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('kong-adapter:main');

import * as wicked from 'wicked-sdk';
import * as utils from './utils';
import { sync } from './sync';
import { WickedEvent, WickedWebhookListener, WickedGlobals, Callback } from 'wicked-sdk';

const MAX_ASYNC_CALLS = 10;

// ====== PUBLIC INTERFACE ======

export const kongMain = {

    init: function (options, done) {
        debug('init()');
        async.series({
            initGlobals: function (callback) {
                if (options.initGlobals) {
                    debug('Calling initGlobals()');
                    registerWebhookListener(callback);
                } else {
                    callback(null);
                }
            },
            flushEvents: function (callback) {
                wicked.flushWebhookEvents('kong-adapter', callback);
            },
            syncApis: function (callback) {
                if (options.syncApis) {
                    debug('Calling sync.syncApis()');
                    sync.syncApis(callback);
                } else {
                    callback(null);
                }
            },
            syncConsumers: function (callback) {
                if (options.syncConsumers) {
                    debug('Calling sync.syncAllConsumers()');
                    sync.syncAllConsumers(callback);
                } else {
                    callback(null);
                }
            },
            addPrometheusPlugin: function (callback) {
                sync.addPrometheusPlugin(callback);
            },
            processPendingEvents: function (callback) {
                if (options.syncConsumers) {
                    processPendingWebhooks(callback);
                } else {
                    callback(null);
                }
            },
        }, function (err) {
            if (err) {
                return done(err);
            }
            info('INITIALIZATION DONE');
            done(null);
        });
    },

    resync: function (done) {
        const initOptions = {
            syncApis: true,
            syncConsumers: true
        };
        kongMain.init(initOptions, done);
    },

    resyncApis: function () {
        info('Resyncing all APIs (to check for updated scopes)');
        const initOptions = {
            syncApis: true,
            syncConsumers: false
        };
        kongMain.init(initOptions, function (err) {
            if (err) {
                error('Resyncing all APIs: An error occurred!');
                error(err);
            }
        });
    },

    processWebhooks: function (callback) {
        debug('processWebhooks()');
        info(`Processing events.`);
        const onlyDelete = false;

        //async.eachSeries(webhookList, (webhookData, callback) => dispatchWebhookAction(webhookData, onlyDelete, callback), done);
        info('Starting processing pending webhooks.');
        processPendingWebhooks(function (err, foundEvents) {
            if (err) {
                error('ERROR - Could not process all webhooks! This is bad!');
                error(err);
                return callback(err);
            }
            if (foundEvents) {
                info('Finished processing events, checking for more events.');
                return kongMain.processWebhooks(callback);
            }

            info('Finished processing events, currently there are no more events.');
            return callback(null, false);
        });
    },

    deinit: function (done) {
        // Don't do this; this can result in glitches in the database; let
        // the wicked API store our events until we return.
        //utils.apiDelete('webhooks/listeners/kong-adapter', done);
        setTimeout(done, 0);
    }
};

function processPendingWebhooks(callback: Callback<boolean>) {
    debug('processPendingWebhooks()');
    const now = new Date().getTime();
    wicked.getWebhookEvents('kong-adapter', function (err, pendingEvents) {
        if (err) {
            error('COULD NOT RETRIEVE WEBHOOKS')
            return callback(err);
        }
        const duration = (new Date().getTime() - now);
        debug(`processPendingWebhooks: Retrieved ${pendingEvents.length} events in ${duration}ms`);
        const onlyDelete = false;
        if (pendingEvents.length === 0)
            return callback(null, false);

        async.eachSeries(pendingEvents, (webhookData: WickedEvent, callback) => {
            const now = new Date().getTime();
            dispatchWebhookAction(webhookData, onlyDelete, function (err) {
                const duration = (new Date().getTime() - now);
                debug(`processPendingWebhooks: Processed ${webhookData.action} ${webhookData.entity} event in ${duration}ms`);
                if (err)
                    return callback(err);
                return callback(null);
            });
        }, function (err) {
            if (err) {
                error('An error occurred during dispatching events.');
                error(err);
                return callback(err);
            }
            return callback(null, true);
        });
    });
}

function containsImportEvent(eventList) {
    if (!eventList)
        return false;
    const importEvent = eventList.find(e => e.entity === 'import');
    return !!importEvent;
}

function dispatchWebhookAction(webhookData, onlyDelete, callback) {
    debug('dispatchWebhookAction()');
    const action = webhookData.action;
    const entity = webhookData.entity;
    info(`Process action ${action} for entity ${entity}`);
    let syncAction = null;
    if (entity === 'application' && (action === 'add' || action === 'update') && !onlyDelete)
        syncAction = callback => syncAppConsumers(webhookData.data.applicationId, callback);
    else if (entity === 'application' && action === 'delete')
        syncAction = callback => deleteAppConsumers(webhookData.data.applicationId, webhookData.data.subscriptions, callback);
    else if (entity === 'subscription' && (action === 'add' || action === 'update') && !onlyDelete)
        syncAction = callback => syncAppConsumers(webhookData.data.applicationId, callback);
    else if (entity === 'subscription' && action === 'delete')
        syncAction = callback => deleteAppSubscriptionConsumer(webhookData.data, callback);
    else
        debug(`Discarding event ${action} ${entity}.`)

    async.series([
        callback => {
            if (syncAction)
                return syncAction(callback);
            return callback(null);
        },
        callback => acknowledgeEvent(webhookData.id, callback)
    ], function (err) {
        if (err) {
            error('SYNC ACTION FAILED!');
            error(err);
            return callback(err);
        }
        debug(`dispatchWebhookAction successfully returned for action ${action} ${entity}`);
        callback(null);
    });
}

function syncAppConsumers(appId, callback) {
    info(`Syncing consumers for wicked application ${appId}`);
    // Relay to sync
    sync.syncAppConsumers(appId, callback);
}

function deleteAppConsumers(appId, subscriptionList, callback) {
    info(`Deleting all consumers associated with wicked application ${appId}`);
    // Just relay
    sync.deleteAppConsumers(appId, subscriptionList, callback);
}

function deleteAppSubscriptionConsumer(webhookSubsInfo, callback) {
    // The subsInfo in the webhook is a little different from the persisted ones.
    // We need to translate them.
    const subsInfo = {
        id: webhookSubsInfo.subscriptionId,
        application: webhookSubsInfo.applicationId,
        api: webhookSubsInfo.apiId,
        userId: webhookSubsInfo.userId,
        auth: webhookSubsInfo.auth
    };
    info(`Deleting cosumers associated with a subscription: ${subsInfo.application} subscribed to API ${subsInfo.api}`);

    sync.deleteAppSubscriptionConsumer(subsInfo, callback);
}

function acknowledgeEvent(eventId, callback) {
    debug(`acknowledgeEvent(${eventId})`);
    wicked.deleteWebhookEvent('kong-adapter', eventId, function (err) {
        debug('deleteWebhookEvent returned');
        callback(null);
    });
}

// ====== INTERNALS =======

function registerWebhookListener(done) {
    debug('registerWebhookListener()');
    const myUrl = utils.getMyUrl();

    const putPayload: WickedWebhookListener = {
        id: 'kong-adapter',
        url: myUrl
    };
    wicked.upsertWebhookListener('kong-adapter', putPayload, done);
}
