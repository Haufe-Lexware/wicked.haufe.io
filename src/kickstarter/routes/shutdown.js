'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:shutdown');

router.get('/', function (req, res, next) {
    info('Received /shutdown, closing server.');
    res.send('Kickstarter has been shut down. <a href="/">Main Index</a>.');
    process.exit(0);
});

module.exports = router;