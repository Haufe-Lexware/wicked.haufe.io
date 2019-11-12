'use strict';

const path = require('path');
const fs = require('fs');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:systemhealth');
const request = require('request');
const async = require('async');
const uuid = require('node-uuid');

// This looks really weird, but apparently the "request" library does not
// consider "Let's Encrypt" SSL certificates as trusted (yet), and thus it
// rejects connections to such end points. As we intend to use Let's Encrypt
// as a default Certificate Provider, this would render the System Health
// "Unhealthy" for "portal" and "kong" if we don't explicitly allow untrusted
// connections for these two end points.
const https = require('https');
const agentOptions = { rejectUnauthorized: false };
const portalAgent = new https.Agent(agentOptions);

const utils = require('./utils');
const users = require('./users');
const webhooks = require('./webhooks');
const dao = require('../dao/dao');

const systemhealth = function () { };

systemhealth._health = [{
    name: 'api',
    message: 'Initializing',
    uptime: 0,
    healthy: 2,
    pingUrl: 'http://portal-api:3001/ping',
    version: utils.getVersion(),
    gitBranch: '(uninitialized)',
    gitLastCommit: '(uninitialized)',
    buildDate: '(uninitialized)'
}];

systemhealth._startupSeconds = utils.getUtc();
systemhealth.checkHealth = function (app) {
    debug('checkHealth()');
    const glob = utils.loadGlobals(app);

    // - Listeners
    // - Portal
    // - Kong
    // - Auth Server

    // Use a correlation ID when calling
    const correlationId = uuid.v4();

    const h = [];
    async.parallel({
        portalPing: function (callback) {
            const portalUri = glob.network.portalUrl + '/ping';
            const req = { url: portalUri, headers: { 'Correlation-Id': correlationId } };
            request.get(req, function (err, apiResult, apiBody) {
                callback(null, makeHealthEntry('portal', portalUri, err, apiResult, apiBody));
            });
        },
        kongPing: function (callback) {
            let kongUri = glob.network.schema + '://' + glob.network.apiHost + '/ping-portal';
            if (glob.network.kongProxyUrl && glob.network.kongProxyUrl !== '' && glob.network.kongProxyUrl !== '/') {
                // Ping via the internal proxy URL instead
                kongUri = utils.concatUrl(glob.network.kongProxyUrl, '/ping-portal');
            }
            const kongUrl = new URL(kongUri);
            const req = { url: kongUri, headers: { 'Correlation-Id': correlationId } };
            // We'll only inject the "insecure" agent if we really need it.
            if ("https:" == kongUrl.protocol) {
                req.agent = portalAgent;
            }
            request.get(req, function (err, apiResult, apiBody) {
                callback(null, makeHealthEntry('kong', kongUri, err, apiResult, apiBody));
            });
        },
        authPing: function (callback) {
            try {
                const authServer = utils.loadAuthServer('default');
                if (authServer.exists && authServer.data && authServer.data.config && authServer.data.config.api && authServer.data.config.api.upstream_url) {
                    const authUri = utils.concatUrl(authServer.data.config.api.upstream_url, 'ping');
                    const req = { url: authUri, headers: { 'Correlation-Id': correlationId } };
                    request.get(req, function (err, apiResult, apiBody) {
                        callback(null, makeHealthEntry('auth', authUri, err, apiResult, apiBody));
                    });
                } else {
                    error('Cannot query Auth Server for status - in default.json, config.api.upstream_url is not present.');
                    return callback(null, null);
                }
            } catch (err) {
                error(err);
                // Don't bother
                return callback(null, null);
            }
        }
    }, function (err, results) {
        if (err) {
            // Uuuh. This is bad.
            h.push({
                name: 'api',
                message: err.message,
                error: JSON.stringify(err, null, 2),
                uptime: (utils.getUtc() - systemhealth._startupSeconds),
                healthy: 0,
                pingUrl: 'http://portal-api:3001/ping',
                version: utils.getVersion(),
                gitLastCommit: utils.getGitLastCommit(),
                gitBranch: utils.getGitBranch(),
                buildDate: utils.getBuildDate()
            });

            systemhealth._health = h;
        } else {

            h.push(results.portalPing);
            h.push(results.kongPing);
            if (results.authPing) {
                h.push(results.authPing);
            }

            // Check our webhook listeners
            dao.webhooks.listeners.getAll((err, listeners) => {
                if (err) {
                    // UURGhrghgrl
                    error(err);
                    return;
                }
                async.map(listeners, function (listener, callback) {
                    debug('checkHealth() - pinging ' + listener.id);
                    request.get({
                        url: listener.url + 'ping',
                        headers: { 'Correlation-Id': correlationId }
                    }, function (apiErr, apiResult, apiBody) {
                        const listenerHealth = makeHealthEntry(listener.id, listener.url + 'ping', apiErr, apiResult, apiBody);
                        callback(null, listenerHealth);
                    });
                }, function (err, results) {
                    debug('checkHealth() - pings are done');

                    if (err) {
                        // Uuuh. This is bad.
                        h.push({
                            name: 'api',
                            message: err.message,
                            error: JSON.stringify(err, null, 2),
                            uptime: (utils.getUtc() - systemhealth._startupSeconds),
                            healthy: 0,
                            pingUrl: 'http://portal-api:3001/ping',
                            pendingEvents: -1,
                            version: utils.getVersion(),
                            gitLastCommit: utils.getGitLastCommit(),
                            gitBranch: utils.getGitBranch(),
                            buildDate: utils.getBuildDate()
                        });
                    } else {
                        // We think we are healthy
                        h.push({
                            name: 'api',
                            message: 'Up and running',
                            uptime: (utils.getUtc() - systemhealth._startupSeconds),
                            healthy: 1,
                            pingUrl: 'http://portal-api:3001/ping',
                            pendingEvents: -1,
                            version: utils.getVersion(),
                            gitLastCommit: utils.getGitLastCommit(),
                            gitBranch: utils.getGitBranch(),
                            buildDate: utils.getBuildDate()
                        });

                        async.map(results, (result, callback) => {
                            dao.webhooks.events.getByListener(result.name, (err, pendingEvents) => {
                                result.pendingEvents = pendingEvents;
                                h.push(result);
                                callback(null);
                            });
                        }, (err, results) => {
                            if (err) {
                                error(err);
                            }
                            systemhealth._health = h;
                            debug(h);
                        });
                    }

                });
            });
        }
    });
};

function makeHealthEntry(pingName, pingUrl, apiErr, apiResult, apiBody) {
    debug('makeHealthEntry()');
    if (apiErr) {
        return {
            name: pingName,
            message: apiErr.message,
            error: JSON.stringify(apiErr, null, 2),
            uptime: -1,
            healthy: false,
            pingUrl: pingUrl,
            pendingEvents: -1,
        };
    }
    if (200 != apiResult.statusCode) {
        let msg = 'Unexpected PING result: ' + apiResult.statusCode;
        let healthy = 0;
        let error;
        try {
            const jsonBody = utils.getJson(apiBody);
            if (jsonBody.hasOwnProperty('healthy')) {
                healthy = jsonBody.healthy;
            }
            if (jsonBody.hasOwnProperty('message')) {
                msg = jsonBody.message;
            }
            if (jsonBody.hasOwnProperty('error')) {
                error = jsonBody.error;
            }
        } catch (err) {
            debug('Couldn\'t parse JSON from body:');
            debug(apiBody);
            debug(err);
            // Deliberate
        }
        return {
            name: pingName,
            message: msg,
            error: error,
            uptime: -1,
            healthy: healthy,
            pingUrl: pingUrl,
            pendingEvents: -1,
        };
    }

    try {
        const pingResponse = utils.getJson(apiBody);
        pingResponse.name = pingName;
        pingResponse.pingUrl = pingUrl;
        pingResponse.pendingEvents = -1; // May be overwritten

        if (pingName === 'kong') {
            // These are from the portal, should not be returned
            if (pingResponse.version) {
                delete pingResponse.version;
            }
            if (pingResponse.gitBranch) {
                delete pingResponse.gitBranch;
            }
            if (pingResponse.gitLastCommit) {
                delete pingResponse.gitLastCommit;
            }
            if (pingResponse.buildDate) {
                delete pingResponse.buildDate;
            }
        }

        return pingResponse;
    } catch (err) {
        debug('pingResponse: Couldn\'t extract health info from body:');
        debug(apiBody);
        debug(err);
        // Deliberate

        return {
            name: pingName,
            message: 'Could not parse pingResponse: ' + err.message,
            error: err,
            uptime: -1,
            healthy: 0,
            pingUrl: pingUrl,
            pendingEvents: -1,
        };
    }
}

systemhealth.getSystemHealthInternal = function (app) {
    return systemhealth._health;
};

systemhealth.getSystemHealth = function (app, res, loggedInUserId) {
    debug('getSystemHealth()');
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getSystemHealth: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }
        return res.json(systemhealth._health);
    });
};

module.exports = systemhealth;
