'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:ssl');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    let glob = utils.loadGlobals(req.app);
    let hasCertificates = utils.hasCertsFolder(req.app);

    res.render('ssl', {
        configPath: req.app.get('config_path')
    });
});

router.post('/', function (req, res, next) {
    let validDays = req.body.validDays - 0; // cast to number
    debug('validDays: ' + validDays);
    if (validDays <= 0 || isNaN(validDays)) {
        return next(new Error('Invalid validDays argument. Must be a number greater than zero.'));
    }
    try {
        utils.createCerts(req.app, validDays);    
    } catch (ex) {
        return next(new Error('utils.createCerts threw an exception: ' + ex));
    }

    res.redirect('/ssl');
});

module.exports = router;
