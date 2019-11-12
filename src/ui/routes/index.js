'use strict';

const express = require('express');
const { debug, info, warn, error } = require('portal-env').Logger('portal:index');
const contentRenderer = require('./renderContent');
const router = express.Router();
const utils = require('./utils');

/* GET home page. */
router.get('/', function (req, res, next) {
    debug("get('/')");

    utils.get(req, '/content', function (err, apiResponse, apiBody) {
        if (err)
            return next(err);
        if (200 != apiResponse.statusCode)
            return utils.handleError(res, apiResponse, apiBody, next);
        contentRenderer.renderContent(req, res, '/', 'index', apiResponse, apiBody);
    });
});

module.exports = router;
