'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:api:envs');

const utils = require('../utils');

router.get('/', function (req, res, next) {
    const envVar = req.query.env_var;
    debug(`GET /envs?env_var=${envVar}`);
    if (!envVar)
        return res.status(400).json({ message: 'Invalid request; requires ?env_var=... parameter' });
    const envVars = utils.loadEnvDict(req.app);
    const envMap = {};
    let isMultiline = false;
    for (let e in envVars) {
        if (envVars[e].hasOwnProperty(envVar)) {
            const v = envVars[e][envVar];
            if (typeof v === 'string' && v.indexOf('\n') >= 0)
                isMultiline = true;
            envMap[e] = {
                defined: true,
                value: v
            };
        } else {
            envMap[e] = {
                defined: false
            };
        }
    }
    res.json({
        multiline: isMultiline,
        envs: envMap
    });
});

router.post('/:envId', function (req, res, next) {
    debug(`POST /envs/${req.params.envId}`);
    try {
        const envId = req.params.envId;
        const envVars = utils.loadEnvDict(req.app);
        const body = utils.jsonifyBody(req.body);
        debug(body);

        if (!envVars[envId])
            return res.status(404).json({ message: 'Env ' + envId + ' not found.' });
        const env = envVars[envId];
        const name = body.name;
        const value = body.value;
        const encrypted = body.encrypted;

        if (!env[name])
            env[name] = {};
        env[name].value = value;
        env[name].encrypted = encrypted;
        utils.saveEnvDict(req.app, envVars, envId);

        res.status(200).json({ status: 200, message: 'OK' });
    } catch (ex) {
        error(ex);
        res.status(500).json({ message: ex.message });
    }
});


module.exports = router;