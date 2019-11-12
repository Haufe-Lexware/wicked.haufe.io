'use strict';

const express = require('express');
const { debug, info, warn, error } = require('portal-env').Logger('portal:help');
const path = require('path');
const router = express.Router();

const HELP_IDS = {
    'apis': 'API Index',
    'api': 'API Page',
    'api-access': 'API Access',
    'applications': 'Application Index',
    'application': 'Application Page',
    'application-ownership': 'Application Ownership',
    'trusted': 'Application/Subscription Trust',
    'client_types': 'Application/Client Types',
    'oauth2_client_credentials': 'OAuth2: Client Credentials',
    'oauth2_authorization_code': 'OAuth2: Authorization Code',
    'oauth2_implicit_grant': 'OAuth2: Implicit Grant',
    'oauth2_password_grant': 'OAuth2: Password Grant',
    'bundles': 'API Bundles',
    'allowed_scopes': 'OAuth2: Allowed Scopes'
};

router.get('/', function (req, res, next) {
    res.render(path.join('help', 'index'), {
        authUser: req.user,
        glob: req.app.portalGlobals,
        route: '/help',
        title: 'Portal Help',
        helpPages: HELP_IDS
    });
});

router.get('/:helpId', function (req, res, next) {
    const helpId = req.params.helpId;
    debug("get('/help/" + helpId + "')");

    if (!HELP_IDS[helpId])
        return res.status(404).jsonp({ message: 'Not found.' });
    
    res.render(path.join('help', helpId), {
        authUser: req.user,
        glob: req.app.portalGlobals,
        route: '/help/' + helpId,
        title: 'Portal Help'
    });
});

module.exports = router;