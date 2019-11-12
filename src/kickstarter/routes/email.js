'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:email');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    if (!glob.mailer.smtpPort)
        glob.mailer.smtpPort = 465;
    const envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    res.render('email',
        {
            configPath: req.app.get('config_path'),
            glob: glob
        });
});

router.post('/', function (req, res, next) {
    const redirect = req.body.redirect;

    const body = utils.jsonifyBody(req.body);

    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    if (body.glob.mailer.smtpPort) {
        debug(body.glob.mailer.smtpPort);
        body.glob.mailer.smtpPort = Number(body.glob.mailer.smtpPort);
        debug(body.glob.mailer.smtpPort);
    }
    glob.mailer = body.glob.mailer;

    utils.mixoutEnv(glob, envVars);

    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.email = 3;
    if (!glob.mailer.useMailer)
        kickstarter.email = 2;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
