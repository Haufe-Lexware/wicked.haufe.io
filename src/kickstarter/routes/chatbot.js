'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:chatbot');

const utils = require('./utils');

const chatbotTypes = [
    "slack",
    "msteams",
];

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    if (!glob.chatbot.types) {
        glob.chatbot.types = chatbotTypes;
    }

    if (!glob.chatbot.targets) {
        glob.chatbot.targets = [];
    }

    res.render('chatbot',
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
    glob.chatbot = body.glob.chatbot;
    utils.mixoutEnv(glob, envVars);

    if (!glob.chatbot.types) {
        glob.chatbot.types = chatbotTypes;
    }

    if ("deleteTarget" === body.__action) {
        const index = Number(body.__object);
        glob.chatbot.targets.splice(index, 1);
    } else if ("addTarget" === body.__action) {
        if (!glob.chatbot.targets) {
            glob.chatbot.targets = [];
        }
        glob.chatbot.targets.push({
            "type": chatbotTypes[0],
            "hookUrl": "https://your.messaging.service/hookUrlFromYourAdministrator",
            "events": {
                "userSignedUp": true,
                "userValidatedEmail": true,
                "applicationAdded": true,
                "applicationDeleted": true,
                "subscriptionAdded": true,
                "subscriptionDeleted": true,
                "approvalRequired": true,
                "lostPasswordRequest": true,
                "verifyEmailRequest": true
            }
        });
    }
    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");
    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.chatbot = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
