'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:users');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    const groups = utils.loadGroups(req.app);

    res.render('users',
        {
            configPath: req.app.get('config_path'),
            glob: glob,
            groups: groups.groups
        });
});

router.post('/', function (req, res, next) {
    const redirect = req.body.redirect;

    const body = utils.jsonifyBody(req.body);

    const groups = utils.loadGroups(req.app);
    if (body.glob.initialUsers) {
        for (let userIndex = 0; userIndex < body.glob.initialUsers.length; ++userIndex) {
            const groupsList = [];
            for (let i = 0; i < groups.groups.length; ++i) {
                const groupId = groups.groups[i].id;
                if (body.glob.initialUsers[userIndex].groups &&
                    body.glob.initialUsers[userIndex].groups[groupId])
                    groupsList.push(groupId);
            }
            body.glob.initialUsers[userIndex].groups = groupsList;
        }
    }

    //debug(JSON.stringify(body, null, 2));
    if ("addUser" == body.__action) {
        info('Adding user.');
        body.glob.initialUsers.push({
            id: utils.createRandomId(),
            firstName: "New",
            lastName: "User",
            email: "bar@foo.com",
            password: "password",
            groups: []
        });
    } else if ("deleteUser" == body.__action) {
        info('Deleting user.');
        let userIndex = Number(body.__object);
        body.glob.initialUsers.splice(userIndex, 1);
    }

    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    glob.initialUsers = body.glob.initialUsers;

    utils.mixoutEnv(glob, envVars);

    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.users = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
