'use strict';

// A simple echo server

const express = require('express');
const http = require('http');

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:echo');

const ECHO_PORT = process.env.ECHO_PORT ? process.env.ECHO_PORT : 3009;

const echoApp = express();

echoApp.use(function (req, res, next) {
    debug('GET /*');

    const scope = req.get('x-authenticated-scope');
    let scopes = [];
    if (scope) {
        scopes = scope.split(' ');
    }
    const method = req.method.toLowerCase();
    switch (method) {
        case 'get':
        case 'put':
        case 'post':
        case 'delete':
        case 'patch':
            break;
        default:
            return res.status(400).json({ status: 400, error: `Bad request, invalid method ${req.method}` });
    }
    if (!scope || scopes.length === 0 ||
        !scopes.find(s => s === method)) {
        return res.status(403).json({ status: 403, error: `User has not allowed accessing with scope '${method}'` });
    }

    const response = {
        method: req.method,
        path: req.path,
        headers: req.headers
    };
    res.json(response);
});

echoApp.start = function () {
    debug('start()');
    const echoServer = http.createServer(echoApp);
    info(`Echo server is listening on port ${ECHO_PORT} (override with env var ECHO_PORT)`);
    echoServer.listen(ECHO_PORT);
};

module.exports = echoApp;
