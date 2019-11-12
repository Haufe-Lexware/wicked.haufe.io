'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:groups');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const groups = utils.loadGroups(req.app);
    const glob = utils.loadGlobals(req.app);

    // Remove old alt_ids if present, add explicit properties
    groups.groups.forEach(g => {
        if (g.hasOwnProperty('alt_ids'))
            delete g.alt_ids;
        if (!g.hasOwnProperty('adminGroup'))
            g.adminGroup = false;
        if (!g.hasOwnProperty('approverGroup'))
            g.approverGroup = false;
    });

    res.render('groups', {
        glob: glob,
        configPath: req.app.get('config_path'),
        groups: groups,
    });
});

router.post('/api', function (req, res, next) {
    const body = utils.getJson(req.body);
    const groups = body.groups;
    utils.saveGroups(req.app, groups);

    // Changes to validated user group?
    const validatedGroup = body.glob.validatedUserGroup;
    const glob = utils.loadGlobals(req.app);
    if (glob.validatedUserGroup != validatedGroup) {
        if (!validatedGroup)
            delete glob.validatedUserGroup;
        else
            glob.validatedUserGroup = validatedGroup;
        utils.saveGlobals(req.app, glob);
    }

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.groups = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.json({ message: "OK" });
});

module.exports = router;
