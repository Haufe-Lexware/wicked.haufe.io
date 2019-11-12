#!/usr/bin/env node

'use strict';

import { app } from './app';
const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:server');
const http = require('http');
const passport = require('passport');
import * as wicked from 'wicked-sdk';
import { utils } from './common/utils.js';
import { WickedAuthServer } from 'wicked-sdk';

let authServerId = 'default';
if (process.env.AUTH_SERVER_NAME) {
    authServerId = process.env.AUTH_SERVER_NAME;
}
app.set('server_name', authServerId);
let authServerPath = '/auth';
if (process.env.AUTH_SERVER_BASEPATH) {
    authServerPath = process.env.AUTH_SERVER_BASEPATH;
}
app.set('base_path', authServerPath);

info('Auth Server ID used: ' + authServerId + ', override with AUTH_SERVER_NAME.');
info('Auth Server base path: ' + authServerPath + ', override with AUTH_SERVER_BASEPATH');

utils.init(app);

var port = normalizePort(process.env.PORT || '3010');
app.set('port', port);

/**
 * Create HTTP server.
 */

let server = null;

const wickedOptions = {
    userAgentName: 'wicked.portal-auth',
    userAgentVersion: utils.getVersion()
};

async.series({
    init: callback => wicked.initialize(wickedOptions, callback),
    // waitForKong: callback => wicked.awaitKongOAuth2(callback),
    initMachineUser: callback => wicked.initMachineUser(authServerId, callback),
    authServerConfig: callback => wicked.getAuthServer(authServerId, callback) //wicked.apiGet('auth-servers/' + authServerId, null, callback),
}, function (err, results) {
    if (err) {
        error(err);
        throw err;
    }

    const authServerConfig = results.authServerConfig as WickedAuthServer;
    // Initialize the externally visible URL as an app parameter
    if (!authServerConfig.config ||
        !authServerConfig.config.api ||
        !authServerConfig.config.api.uris ||
        !Array.isArray(authServerConfig.config.api.uris) ||
        (authServerConfig.config.api.uris.length <= 0)) {
        throw new Error('The auth server configuration does not contain a property config.api.uris[0]');
    }
    const apiPath = authServerConfig.config.api.uris[0];
    let externalApiUrl = wicked.getExternalApiUrl();
    if (externalApiUrl.endsWith('/'))
        externalApiUrl = externalApiUrl.substring(0, externalApiUrl.length - 1);
    if (authServerPath !== apiPath)
        throw new Error(`The configured base path does not match the Kong API URI: ${authServerPath} != ${apiPath}. They must match.`);
    const authServerUrl = `${externalApiUrl}${apiPath}`;
    info(`External auth server URL: ${authServerUrl}`);
    app.set('external_url', authServerUrl);

    app.initApp(authServerConfig, function (err) {
        if (err) {
            error(err);
            throw err;
        }

        app.glob = wicked.getGlobals();

        // Simplest kind of serialization and deserialization
        passport.serializeUser(function (user, done) {
            done(null, user);
        });

        passport.deserializeUser(function (user, done) {
            done(null, user);
        });

        // Now create the server
        server = http.createServer(app);

        // Listen on provided port, on all network interfaces.
        server.listen(port);
        server.on('error', onError);
        server.on('listening', onListening);
    });
});

// Normalize a port into a number, string, or false.
function normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

// Event listener for HTTP server "error" event.
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

// Event listener for HTTP server "listening" event.
function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    info('========== INITIALIZATION DONE ==========');
    info('Listening on ' + bind);
}
