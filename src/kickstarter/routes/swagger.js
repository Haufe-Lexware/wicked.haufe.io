'use strict';

const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:swagger');

const utils = require('./utils');

router.get('/:apiId', function (req, res, next) {
    const apiId = req.params.apiId;
    const swagger = utils.loadSwagger(req.app, apiId);
    const swaggerText = JSON.stringify(swagger, null, 4);
    res.render('swagger',
        {
            configPath: req.app.get('config_path'),
            envFile: req.app.get('env_file'),
            apiId: apiId,
            swagger: swaggerText
        });
});

router.post('/:apiId', function (req, res, next) {
    const redirect = req.body.redirect;
    const apiId = req.params.apiId;

    let swagger = '';
    try {
        swagger = JSON.parse(req.body.swagger);
    } catch (err) {
        // If we ran into trouble, we'll try YAML
        try {
            swagger = yaml.safeLoad(req.body.swagger);
        } catch (err) {
            return next(err);
        }
    }
    
    // We could parse it, then it will be okayish.
    utils.saveSwagger(req.app, apiId, swagger);

    res.redirect(redirect);
});

module.exports = router;
