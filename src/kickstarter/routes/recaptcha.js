'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:recaptcha');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);
    res.render('recaptcha',
        {
            configPath: req.app.get('config_path'),
            glob: glob
        });
});

router.post('/', function (req, res, next) {
    const redirect = req.body.redirect;
    //debug(req.body);

    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);

    const body = utils.jsonifyBody(req.body);
    //debug(body);
    glob.recaptcha = body.glob.recaptcha;

    utils.mixoutEnv(glob, envVars);
    //debug(glob);
    //debug(envVars);

    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.recaptcha = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
