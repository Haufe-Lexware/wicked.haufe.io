'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:auth');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    res.redirect('/authservers');
    // var glob = utils.loadGlobals(req.app);
    // var envVars = utils.loadEnvDict(req.app);
    // utils.mixinEnv(glob, envVars);

    // res.render('auth',
    //     {
    //         configPath: req.app.get('config_path'),
    //         glob: glob
    //     });
});

// router.post('/', function (req, res, next) {
//     var redirect = req.body.redirect;

//     var body = utils.jsonifyBody(req.body);

//     var glob = utils.loadGlobals(req.app);
//     var envVars = utils.loadEnvDict(req.app);
//     glob.auth = body.glob.auth;
    
//     utils.mixoutEnv(glob, envVars);
//     debug(glob);
//     debug(envVars);

//     utils.saveGlobals(req.app, glob);
//     utils.saveEnvDict(req.app, envVars, "default");

//     // Write changes to Kickstarter.json
//     var kickstarter = utils.loadKickstarter(req.app);
//     kickstarter.auth = 3;
//     utils.saveKickstarter(req.app, kickstarter);

//     res.redirect(redirect);
// });

module.exports = router;
