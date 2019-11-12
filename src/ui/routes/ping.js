'use strict';

const express = require('express');
const { debug, info, warn, error } = require('portal-env').Logger('portal:ping');
const wicked = require('wicked-sdk');
const router = express.Router();
const utils = require('./utils');

const _startupSeconds = utils.getUtc();
router.get('/', function (req, res, next) {
    debug("get('/')");
    if (!req.app.initialized) {
        return res.status(503).json({
            name: 'portal',
            message: 'Initializing',
            uptime: 0,
            healthy: false,
            version: utils.getVersion(),
            gitLastCommit: utils.getGitLastCommit(),
            gitBranch: utils.getGitBranch(),
            buildDate: utils.getBuildDate()
        });
    }

    // We're initialized, we can access the globals
    const portalUrl = wicked.getExternalPortalUrl();
    res.json({
        name: 'portal',
        message: 'Up and running',
        uptime: (utils.getUtc() - _startupSeconds),
        healthy: true,
        pingUrl: portalUrl + '/ping',
        version: utils.getVersion(),
        gitLastCommit: utils.getGitLastCommit(),
        gitBranch: utils.getGitBranch(),
        buildDate: utils.getBuildDate()
    });
});

module.exports = router;