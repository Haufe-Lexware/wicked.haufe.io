'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:apidesc');

const utils = require('./utils');

router.get('/:apiId', function (req, res, next) {
    const apiId = req.params.apiId;
    const desc = utils.loadApiDesc(req.app, apiId);
    
    res.render('apidesc',
        {
            configPath: req.app.get('config_path'),
            desc: desc,
            apiId: apiId
        });
});

router.post('/:apiId', function (req, res, next) {
    const apiId = req.params.apiId;
    const redirect = req.body.redirect;

    // We may safely just dump this to the desc.md
    utils.saveApiDesc(req.app, apiId, req.body.desc);    

    res.redirect(redirect);
});

module.exports = router;
