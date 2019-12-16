'use strict';

const fs = require('fs');
const path = require('path');
const request = require('request');
const utils = require('./utils');
const auditlog = require('./auditlog');
const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:webhooks');

const dao = require('../dao/dao');
const principal = require('./principal');

const webhooks = require('express').Router();
webhooks.setup = function (users) {
    webhooks._usersModule = users;
};

// ===== SCOPES =====

const WEBHOOKS_SCOPE = 'webhooks';

const verifyScope = utils.verifyScope(WEBHOOKS_SCOPE);

// ===== ENDPOINTS =====

webhooks.put('/listeners/:listenerId', verifyScope, function (req, res, next) {
    webhooks.putListener(req.app, res, webhooks._usersModule, req.apiUserId, req.params.listenerId, req.body);
});

webhooks.delete('/listeners/:listenerId', verifyScope, function (req, res, next) {
    webhooks.deleteListener(req.app, res, webhooks._usersModule, req.apiUserId, req.params.listenerId);
});

webhooks.get('/listeners', verifyScope, function (req, res, next) {
    webhooks.getListeners(req.app, res, webhooks._usersModule, req.apiUserId);
});

webhooks.get('/events/:listenerId', verifyScope, function (req, res, next) {
    webhooks.getEvents(req.app, res, webhooks._usersModule, req.apiUserId, req.params.listenerId);
});

webhooks.delete('/events/:listenerId', verifyScope, function (req, res, next) {
    webhooks.flushEvents(req.app, res, webhooks._usersModule, req.apiUserId, req.params.listenerId);
});

webhooks.delete('/events/:listenerId/:eventId', verifyScope, function (req, res, next) {
    webhooks.deleteEvent(req.app, res, webhooks._usersModule, req.apiUserId, req.params.listenerId, req.params.eventId);
});

// ===== CONSTANTS =====

webhooks.ACTION_ADD = 'add';
webhooks.ACTION_UPDATE = 'update';
webhooks.ACTION_DELETE = 'delete';
webhooks.ACTION_PASSWORD = 'password';
webhooks.ACTION_VALIDATED = 'validated';
webhooks.ACTION_LOGIN = 'login';
// used for import and export
webhooks.ACTION_FAILED = 'failed';
webhooks.ACTION_DONE = 'done';

webhooks.ENTITY_APPLICATION = 'application';
webhooks.ENTITY_USER = 'user';
webhooks.ENTITY_SUBSCRIPTION = 'subscription';
webhooks.ENTITY_APPROVAL = 'approval';
webhooks.ENTITY_OWNER = 'owner';
webhooks.ENTITY_VERIFICATION = 'verification';
webhooks.ENTITY_VERIFICATION_LOSTPASSWORD = 'verification_lostpassword';
webhooks.ENTITY_VERIFICATION_EMAIL = 'verification_email';
// for deploy.js
webhooks.ENTITY_EXPORT = 'export';
webhooks.ENTITY_IMPORT = 'import';

// ===== IMPLEMENTATION =====

// ===== INTERNAL =====

function retryLog(app, triesLeft, eventData, callback) {
    debug('retryLog(), triesLeft: ' + triesLeft);
    debug(eventData);

    dao.webhooks.events.create(eventData, (err) => {
        if (err) {
            // Retries left?
            if (triesLeft > 0) {
                // Call ourselves again in around 100 milliseconds. Note the currying
                // of the arguments of setTimeout, which are passed into retryLog.
                setTimeout(retryLog, 100, app, triesLeft - 1, eventData, callback);
            } else {
                callback(err);
            }
        } else {
            // Woo hoo.
            callback(null);
        }
    });
}

webhooks.logEvent = function (app, eventData, callback) {
    debug('logEvent()');
    debug(eventData);
    if (!eventData.action) {
        throw new Error("Webhook event data must contain 'action'.");
    }
    if (!eventData.entity) {
        throw new Error("Webhook event data must contain 'entity'.");
    }

    eventData.id = utils.createRandomId();
    eventData.utc = utils.getUtc();

    // This will immediately return
    // The arguments after the "0" will be passed as arguments to
    // webhooks.retryLog. You have to know this from the documentation
    // of setTimeout.
    auditlog.logEvent(app,eventData, callback);
    setTimeout(retryLog, 0, app, 5, eventData, function (err) {
        debug('retryLog() called back');
        // We have no results, we just want to check for errors
        if (err) {
            debug(err);
            error(err);
        }

        if (callback) {
            return callback(err);
        }
    });
};

// ===== OPERATIONS =====

webhooks.putListener = function (app, res, users, loggedInUserId, listenerId, body) {
    debug('putListener(): ' + listenerId);
    debug(body);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'putListener: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }
        // Validate listenerId
        const regex = /^[a-zA-Z0-9\-_]+$/;

        if (!regex.test(listenerId)) {
            return utils.fail(res, 400, 'Invalid webhook listener ID, allowed chars are: a-z, A-Z, -, _');
        }
        if (listenerId.length < 4 || listenerId.length > 20) {
            return utils.fail(res, 400, 'Invalid webhook listener ID, must have at least 4, max 20 characters.');
        }

        if (body.id != listenerId) {
            return utils.fail(res, 400, 'Listener ID in path must be the same as id in body.');
        }
        if (!body.url) {
            return utils.fail(res, 400, 'Mandatory body property "url" is missing.');
        }

        const upsertListener = {
            id: listenerId,
            url: body.url
        };
        dao.webhooks.listeners.upsert(upsertListener, (err) => {
            if (err) {
                return utils.fail(res, 500, 'putListener: DAO upsert listener failed', err);
            }

            res.json(upsertListener);
        });
    });
};

webhooks.deleteListener = function (app, res, users, loggedInUserId, listenerId) {
    debug('deleteListener(): ' + listenerId);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'deleteListener: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }

        dao.webhooks.listeners.delete(listenerId, (err, deletedListenerInfo) => {
            if (err) {
                return utils.fail(res, 500, 'deleteListener: DAO delete listener failed', err);
            }
            res.status(204).json(deletedListenerInfo);
        });
    });
};

webhooks.getListeners = function (app, res, users, loggedInUserId) {
    debug('getListeners()');
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getListener: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }
        dao.webhooks.listeners.getAll((err, listenerInfos) => {
            if (err) {
                return utils.fail(res, 500, 'getListeners: DAO get listeners failed', err);
            }
            res.json(listenerInfos);
        });
    });
};

webhooks.getEvents = function (app, res, users, loggedInUserId, listenerId) {
    debug('getEvents(): ' + listenerId);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getEvents: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }
        dao.webhooks.events.getByListener(listenerId, (err, events) => {
            if (err) {
                return utils.fail(res, 500, 'getEvents: DAO get events failed', err);
            }
            res.json(events);
        });
    });
};

webhooks.flushEvents = function (app, res, users, loggedInUserId, listenerId) {
    debug('flushEvents(): ' + listenerId);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'flushEvents: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }

        dao.webhooks.events.flush(listenerId, (err) => {
            if (err) {
                return utils.fail(res, 500, 'flushEvents: DAO flush failed', err);
            }

            res.status(204).send('');
        });
    });
};

webhooks.deleteEvent = function (app, res, users, loggedInUserId, listenerId, eventId) {
    debug('deleteEvent(): ' + listenerId + ', eventId: ' + eventId);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'deleteEvent: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }

        dao.webhooks.events.delete(listenerId, eventId, (err) => {
            if (err) {
                return utils.fail(res, 500, 'deleteEvent: DAO delete failed');
            }
            res.status(204).send('');
        });
    });
};

// FIRING WEB HOOKS

webhooks.setupHooks = function () {
    // Delegate to the DAO, this depends on the DAO implementation how this is done
    // in detail.
    dao.webhooks.events.hookListeners(webhooks.checkAndFireHooks, (err) => {
        if (err) {
            // TODO: This should possibly break things if it fails.
            debug('hookListeners() failed: ' + err);
            debug(err);
        }
    });
};

webhooks.checkAndFireHooks = function (callback) {
    if (!callback) {
        throw new Error('checkAndFireHooks: callback is null');
    }
    debug('checkAndFireHooks()');
    if (!principal.isInstancePrincipal()) {
        debug(`checkAndFireHooks(): Current instance is not the principal instance, not firing webhooks`);
        return callback(null);
    }
    info('checkAndFireHooks: Checking and firing web hook events.');

    dao.webhooks.listeners.getAll((err, listenerInfos) => {
        if (err) {
            error('*** COULD NOT GET WEBHOOKS');
            return callback(err);
        }
        debug('checkAndFireHooks: Retrieved listeners.');

        async.map(listenerInfos, (listener, callback) => {
            const listenerId = listener.id;
            const listenerUrl = listener.url;

            dao.webhooks.events.getByListener(listenerId, (err, listenerEvents) => {
                if (err){
                    return callback(err);}

                if (listenerEvents.length > 0) {
                    debug(`checkAndFireHooks: Posting ${listenerEvents.length} events to ${listenerId}`);
                    request.post({
                        url: listenerUrl,
                        json: true,
                        body: listenerEvents,
                    }, function (err, apiResponse, apiBody) {
                        if (err) {
                            return callback(err);
                        }
                        if (200 != apiResponse.statusCode) {
                            const err2 = new Error('Calling the web hook "' + listenerId + '" failed.');
                            err2.status = apiResponse.statusCode;
                            return callback(err);
                        }
                        debug(`checkAndFireWebhooks: Succeeded posting ${listenerEvents.length} events to ${listenerId}`);
                        callback(null, apiBody);
                    });
                }
            });
        }, function (err, results) {
            if (err) {
                debug(err);
                error(err);
                return callback(err);
            }
            debug('checkAndFireHooks successfully finished.');
            return callback(null);
        });
    });
};

module.exports = webhooks;