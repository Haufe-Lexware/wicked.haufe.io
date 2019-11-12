'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const envReader = require('portal-env');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:envs');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const kickstarter = utils.loadKickstarter(req.app);
    const envDict = utils.loadEnvDict(req.app);

    res.render('envs',
        {
            configPath: req.app.get('config_path'),
            envs: kickstarter.envs,
            envDict: envDict
        });
});

router.post('/', function (req, res, next) {
    const body = utils.jsonifyBody(req.body);
    const kickstarter = utils.loadKickstarter(req.app);
    debug(body);
    const newEnvId = body.new_env;
    if (!/^[a-z0-9\-]+$/.test(newEnvId)) { // eslint-disable-line
        const err = new Error('Invalid environment name; must only contain a-z, 0-9 and hyphen (-).');
        err.status = 400;
        throw err;
    }
    utils.createEnv(req.app, newEnvId);
    kickstarter.envs.push(newEnvId);
    kickstarter.env = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect('/envs/' + newEnvId);
});

router.get('/:envId', function (req, res, next) {
    const usedEnvVars = {};
    envReader.gatherEnvVarsInDir(req.app.get('config_path'), usedEnvVars);
    usedEnvVars.PORTAL_API_AESKEY = ['(implicit)'];

    const envDict = utils.loadEnvDict(req.app, usedEnvVars);
    const envId = req.params.envId;
    // debug(usedEnvVars);

    res.render('env',
        {
            configPath: req.app.get('config_path'),
            envId: envId,
            envDict: envDict,
            usedVars: usedEnvVars
        });
});

router.post('/:envId', function (req, res, next) {
    const envId = req.params.envId;
    const body = utils.jsonifyBody(req.body);
    //debug(body);

    const envDict = utils.loadEnvDict(req.app);
    const updateDict = {};
    for (let propName in body) {
        let prop = body[propName];
        if (envId != 'default' &&
            !prop.override &&
            !prop.deleted)
            continue;
        updateDict[propName] = { value: prop.value };
        if (prop.encrypted)
            updateDict[propName].encrypted = true;
    }

    envDict[envId] = updateDict;

    // Any deleted env vars?
    let saveAll = false;
    if (envId == 'default') {
        for (let propName in body) {
            let prop = body[propName];
            if (!prop.deleted)
                continue;
            info('Deleting env var ' + propName);
            for (let envName in envDict) {
                let env = envDict[envName];
                if (env[propName]) {
                    info(' * in environment ' + envName);
                    delete env[propName];
                    saveAll = true;
                }
            }
        }
    }

    //debug(envDict["default"]);

    if (!saveAll) {
        utils.saveEnvDict(req.app, envDict, envId);
    } else {
        for (let envName in envDict)
            utils.saveEnvDict(req.app, envDict, envName);
    }

    res.redirect('/envs/' + envId);
});

router.post('/:envId/delete', function (req, res, next) {
    // I hope the user knows what he's doing. But there's always git.
    const envId = req.params.envId;
    const kickstarter = utils.loadKickstarter(req.app);
    const newEnvs = [];
    for (let i = 0; i < kickstarter.envs.length; ++i) {
        if (kickstarter.envs[i] == envId)
            continue;
        newEnvs.push(kickstarter.envs[i]);
    }
    kickstarter.envs = newEnvs;
    utils.deleteEnv(req.app, envId);

    kickstarter.env = 3;
    utils.saveKickstarter(req.app, kickstarter);
    res.redirect('/envs');
});

module.exports = router;