'use strict';

const fs = require('fs');
const path = require('path');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:auth-servers');
const utils = require('./utils');
const users = require('./users');

const authServers = require('express').Router();

// ===== SCOPES =====

const READ = 'read_auth_servers';

const verifyScope = utils.verifyScope(READ);

// ===== ENDPOINTS =====

authServers.get('/', verifyScope, function (req, res, next) {
    authServers.getAuthServers(req.app, res);
});

authServers.get('/:serverId', verifyScope, function (req, res, next) {
    authServers.getAuthServer(req.app, res, req.apiUserId, req.params.serverId);
});

// ===== IMPLEMENTATION =====

authServers.getAuthServers = function (app, res) {
    debug('getAuthServers()');
    try {
        const authServerNames = utils.loadAuthServerNames();
        return res.json(authServerNames);
    } catch (err) {
        error('loadAuthServerNames threw an exception:');
        error(err);
        return res.status(500).json({ message: err.message });
    }
};

authServers.getAuthServer = function (app, res, loggedInUserId, serverId) {
    debug(`getAuthServer(${serverId})`);

    let authServerData = null;
    try {
        authServerData = utils.loadAuthServer(serverId);
    } catch (err) {
        error('getAuthServer(): utils.loadAuthServer() returned an error');
        error(err);
        return res.status(500).json({ message: err.message });
    }

    // Let's clone it, as we want to change data in the object; doing that in
    // what's returned changes the cached auth server data, and that's not
    // what we want.
    const authServer = utils.clone(authServerData);

    if (!authServer.exists) {
        return utils.fail(res, 404, 'Not found.');
    }

    debug(`getAuthServer(${serverId}), logged in User: ${loggedInUserId}`);
    users.isUserIdAdmin(app, loggedInUserId, (err, isAdmin) => {
        if (!isAdmin) {
            debug(`getAuthServer(${serverId}), logged in User is not ADMIN`);
            // Restrict what we return in case it's a non-admin user (or no user),
            // only return the request path (uris), not the backend URL or any other
            // type of information (like used plugins).
            const tempConfig = authServer.data.config;
            if (tempConfig && tempConfig.api && tempConfig.api.uris) {
                authServer.data.config = {
                    api: {
                        uris: tempConfig.api.uris
                    }
                };
            } else {
                authServer.data.config = {};
            }
        } else {
            debug(`getAuthServer(${serverId}), logged in User is ADMIN, returning all data`);
        }

        return res.json(authServer.data);
    });
};

module.exports = authServers;