'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:ipconfig');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);

    const localStaticPath = req.app.get('config_path');
    const localDynamicPath = path.join(path.join(localStaticPath, '..'), 'dynamic');

    res.render('ipconfig',
        {
            configPath: req.app.get('config_path'),
            envFile: 'not used',//req.app.get('env_file'),
            localStaticPath: localStaticPath,
            localDynamicPath: localDynamicPath,
            glob: glob
        });
});

router.post('/api', function (req, res, next) {
    const body = utils.getJson(req.body);
    const glob = utils.loadGlobals(req.app);
    glob.network = body.glob.network;
    glob.db = body.glob.db;

    utils.saveGlobals(req.app, glob);

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.ipconfig = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.json({ message: 'OK' });
});

module.exports = router;
