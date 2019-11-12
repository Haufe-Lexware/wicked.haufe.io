'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:database');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    
    // const localStaticPath = req.app.get('config_path');
    // const localDynamicPath = path.join(path.join(localStaticPath, '..'), 'dynamic');
    
    res.render('database',
        {
            configPath: req.app.get('config_path'),
            // localStaticPath: localStaticPath,
            // localDynamicPath: localDynamicPath,
            glob: glob
        });
});

router.post('/api', function (req, res, next) {
    const body = utils.jsonifyBody(req.body);
    const glob = utils.loadGlobals(req.app);

    glob.storage = body.glob.storage;
    glob.sessionStore = body.glob.sessionStore;
    
    utils.saveGlobals(req.app, glob);

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.database = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.json({ message: 'OK' });
});

module.exports = router;
