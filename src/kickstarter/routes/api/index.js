'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:api:index');

const apiEnvs = require('./api_envs');
const apiGlob = require('./api_glob');

// This is for AJAX calls from web pages.

router.use('/envs', apiEnvs);
router.use('/globals', apiGlob);

module.exports = router;
