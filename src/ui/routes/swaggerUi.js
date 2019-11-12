'use strict';

const express = require('express');
const { debug, info, warn, error } = require('portal-env').Logger('portal:swagger-ui');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    debug("get('/')");
    res.render('swagger-ui',
        {
            title: req.app.portalGlobals.title + ' - Swagger UI',
            route: '/swagger-ui',
            glob: req.app.portalGlobals,
        });
});

module.exports = router;
