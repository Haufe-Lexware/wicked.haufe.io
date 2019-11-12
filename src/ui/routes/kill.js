'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal:kill');

const kill = require('express').Router();

// ===== MIDDLEWARE =====

kill.use(function (req, res, next) {
    if (!process.env.ALLOW_KILL) {
        return res.status(403).json({});
    }
    next();
});

// ===== ENDPOINTS =====

kill.post('/', function (req, res, next) {
    kill.killPortal(req.app, res);
});

// ===== IMPLEMENTATION =====

kill.killPortal = function (app, res) {
    debug('killPortal()');
    res.status(204).json({});
    setTimeout(function() {
        process.exit(0);
    }, 1000);
};

module.exports = kill;
