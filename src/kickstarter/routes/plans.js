'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:plans');

const utils = require('./utils');
const pluginUtils = require('./pluginUtils');

router.get('/', function (req, res, next) {
    const plans = utils.loadPlans(req.app);
    const glob = utils.loadGlobals(req.app);
    const groups = utils.loadGroups(req.app);

    // Make the config UI friendly
    let hasPlanWithApproval = false;
    for (let i = 0; i < plans.plans.length; ++i) {
        //plans.plans[i].configString = JSON.stringify(plans.plans[i].config, null, 2);
        plans.plans[i].config.plugins = pluginUtils.makeViewModel(plans.plans[i].config.plugins);
        if (plans.plans[i].needsApproval)
            hasPlanWithApproval = true;
    }

    res.render('plans',
        {
            configPath: req.app.get('config_path'),
            plans: plans.plans,
            glob: glob,
            groups: groups.groups,
            hasPlanWithApproval: hasPlanWithApproval
        });
});

router.post('/', function (req, res, next) {

    const redirect = req.body.redirect;

    const body = utils.jsonifyBody(req.body);
    const plans = {
        plans: body.plans
    };

    for (let i = 0; i < plans.plans.length; ++i) {
        if (plans.plans[i].requiredGroup == '<none>')
            delete plans.plans[i].requiredGroup;
        plans.plans[i].config.plugins = pluginUtils.makePluginsArray(plans.plans[i].config.plugins);
    }

    if ("addPlan" == body.__action) {
        plans.plans.push({
            id: 'newplan',
            name: 'New Plan',
            desc: 'New Plan Description',
            needsApproval: false,
            config: {
                plugins: []
            }
        });
    }
    if ("deletePlan" == body.__action) {
        const index = Number(body.__object);
        plans.plans.splice(index, 1);
    }

    utils.savePlans(req.app, plans);

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.plans = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
