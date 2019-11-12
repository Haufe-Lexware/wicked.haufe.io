'use strict';

/**
 * Module dependencies.
 */

import app from '../app';
const { debug, info, warn, error } = require('portal-env').Logger('kong-adapter:kong-adapter');
const http = require('http');
const async = require('async');

import * as wicked from 'wicked-sdk';

import { kongMain } from '../kong/main';
import * as utils from '../kong/utils';
import { kongMonitor } from '../kong/monitor';

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3002');
app.set('port', port);

// Create HTTP server.
const server = http.createServer(app);

// Listen on provided port, on all network interfaces.
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

info('Waiting for API to be available.');

app.apiAvailable = false;
app.kongAvailable = false;

const wickedOptions = {
    userAgentName: 'wicked.portal-kong-adapter',
    userAgentVersion: utils.getVersion()
};

async.series([
    callback => wicked.initialize(wickedOptions, callback),
    callback => wicked.initMachineUser('kong-adapter', callback),
    callback => wicked.awaitUrl(wicked.getInternalKongAdminUrl(), null, callback),
    callback => utils.initGroups(callback),
    callback => kongMonitor.init(callback)
], function (err) {
    debug('Kong and API await finished.');
    if (err) {
        error('Failed waiting for API and/or Kong.');
        throw err;
    }

    // Jot down a couple of URLs
    utils.setMyUrl(wicked.getInternalKongAdapterUrl());

    // Now let's register with the portal API; we'll use the standard Admin
    const initOptions = {
        initGlobals: true,
        syncApis: true,
        syncConsumers: true
    };
    kongMain.init(initOptions, function (err) {
        debug('kong.init() returned.');
        if (err) {
            error('Could not initialize Kong adapter.');
            throw err;
        }

        // Graceful shutdown
        process.on('SIGINT', function () {
            debug("Gracefully shutting down.");
            kongMain.deinit(function (err) {
                process.exit();
            });
        });

        info("Kong Adapter initialization done.");
        app.initialized = true;

        // Resync APIs every five minutes.
        setInterval(() => { kongMain.resyncApis(); }, 5 * 60 * 1000);
    });
});

/**
 * Normalize a port into a number, string, or false.
 */

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

/**
 * Event listener for HTTP server "error" event.
 */

function onError(err) {
    if (err.syscall !== 'listen') {
        throw err;
    }

    const bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (err.code) {
        case 'EACCES':
            error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw err;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string' ?
        'pipe ' + addr :
        'port ' + addr.port;
    debug('Listening on ' + bind);
}
