'use strict';

const express = require('express');
const router = express.Router();
const utils = require('./utils');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:index');

/* GET home page. */
router.get('/', function (req, res, next) {
    const kickstarter = utils.loadKickstarter(req.app);
    res.render('index',
        {
            configPath: req.app.get('config_path'),
            kickstarter: kickstarter
        });
});

router.post('/', function (req, res, next) {
    const redirect = req.body.redirect;

    // Do things with the POST body.

    res.redirect(redirect);
});

module.exports = router;
