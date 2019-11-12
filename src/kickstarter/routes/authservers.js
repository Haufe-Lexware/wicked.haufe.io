'use strict';

const express = require('express');
const router = express.Router();
const passwordValidator = require('portal-env').PasswordValidator;
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:authservers');

const utils = require('./utils');
const pluginUtils = require('./pluginUtils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    // var envVars = utils.loadEnvDict(req.app);
    // utils.mixinEnv(glob, envVars);

    const authServerNames = utils.getAuthServers(req.app); // array of strings
    if (authServerNames.length === 1) {
        // If we only have one, redirect there directly
        return res.redirect(`/authservers/${authServerNames[0]}`);
    }

    res.render('authservers',
        {
            configPath: req.app.get('config_path'),
            glob: glob,
            authServers: authServerNames
        });
});

const knownProperties = {
    'id': true,
    'desc': true,
    'config': true,
    'authMethods': true
};

function isPropertyKnown(propName) {
    return knownProperties.hasOwnProperty(propName);
}

function getUnknownProperties(serverConfig) {
    const otherProperties = {};
    for (let propName in serverConfig) {
        if (isPropertyKnown(propName))
            continue;
        otherProperties[propName] = serverConfig[propName];
    }
    return otherProperties;
}

function jsonifyAuthMethods(authMethods) {
    for (let i = 0; i < authMethods.length; ++i) {
        const am = authMethods[i];
        jsonifyObject(am);
    }
}

function jsonifyObject(ob) {
    for (let p in ob) {
        const pt = typeof ob[p];
        if (pt === 'object') {
            if (p === 'config' || p === 'endpoints' || p === 'defaultGroups') {
                jsonifyObject(ob[p]);
            } else {
                ob[p] = JSON.stringify(ob[p], null, 2);
            }
        }
    }
}

router.get('/:serverId', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    const serverId = req.params.serverId;
    const safeServerId = utils.makeSafeId(serverId);
    const authServer = utils.loadAuthServer(req.app, req.params.serverId);
    if (authServer.config && authServer.config.api && authServer.config.api.uris && authServer.config.api.uris.length > 0)
        authServer.uri = authServer.config.api.uris[0];
    if (!authServer.uri)
        authServer.uri = '/auth'; // Default
    debug(authServer.uri);
    const authId = `${serverId}-auth`;
    authServer.id = authId;
    authServer.config.api.name = authId;


    let origPlugins = [];
    if (authServer.config && authServer.config.plugins)
        origPlugins = authServer.config.plugins;
    const plugins = pluginUtils.makeViewModel(origPlugins);

    if (authServer.authMethods) {
        jsonifyAuthMethods(authServer.authMethods);
    }
    if (glob && glob.portal && glob.portal.authMethods) {
        // Mix in auth methods to auth methods here
        for (let amIndex in glob.portal.authMethods) {
            const am = glob.portal.authMethods[amIndex];
            if (typeof am !== 'string')
                continue;
            const splitPos = am.indexOf(':');
            if (splitPos < 0) {
                error('Invalid auth method name: ' + am + ', expected <id>:<auth method id>');
                continue;
            }
            const amServerId = am.substring(0, splitPos);
            if (amServerId !== serverId) // non-matching server
                continue;
            const amAuthMethodId = am.substring(splitPos + 1);
            const authMethod = authServer.authMethods.find(a => a.name === amAuthMethodId); // jshint ignore:line
            if (!authMethod) {
                warn(`Auth Method ${am} is configured for portal, but is unknown.`);
                continue;
            }
            authMethod.useForPortal = true;
        }
    }

    // Mix in api auth methods as well
    const apis = utils.loadApis(req.app);
    // console.log(JSON.stringify(apis, null, 2));
    for (let authMethod of authServer.authMethods) {
        authMethod.apis = {};
        for (let api of apis.apis) {
            if (api.auth !== 'oauth2')
                continue;
            const authMethodName = `${serverId}:${authMethod.name}`;
            if (api.authMethods.indexOf(authMethodName) >= 0)
                authMethod.apis[api.id] = true;
            else
                authMethod.apis[api.id] = false;
        }
    }

    // For new auth methods
    const oauthApis = {};
    for (let api of apis.apis) {
        if (api.auth !== 'oauth2')
            continue;
        oauthApis[api.id] = false;
    }

    const groups = utils.loadGroups(req.app);
    const passwordStrategies = passwordValidator.getStrategies();

    const viewModel = {
        configPath: req.app.get('config_path'),
        glob: glob,
        serverId: serverId,
        safeServerId: safeServerId,
        authServer: authServer,
        plugins: plugins,
        groups: groups,
        passwordStrategies: passwordStrategies,
        oauthApis: oauthApis
    };

    res.render('authserver', viewModel);
});

function mixinUnknownProperties(serverConfig, otherProperties) {
    for (let propName in otherProperties) {
        if (isPropertyKnown(propName)) {
            error('Duplicate property name in auth server config: ' + propName + ', discarding.');
            continue;
        }
        serverConfig[propName] = otherProperties[propName];
    }
}

router.post('/:serverId/api', function (req, res, next) {
    const body = utils.getJson(req.body);
    debug(JSON.stringify(body, null, 2));
    const serverId = req.params.serverId;
    debug(body);

    const glob = utils.loadGlobals(req.app);

    const authServer = utils.loadAuthServer(req.app, serverId);
    const updatedInfo = body.authServer;
    authServer.id = updatedInfo.id;
    authServer.desc = updatedInfo.desc;
    authServer.config = updatedInfo.config;
    authServer.config.api.strip_uri = (!authServer.config.api.strip_uri) ? false : authServer.config.api.strip_uri;
    authServer.config.api.uris = [updatedInfo.uri];

    const pluginsArray = pluginUtils.makePluginsArray(body.plugins);
    authServer.config.plugins = pluginsArray;

    const authMethods = body.authServer.authMethods;
    utils.unpackObjects(authMethods);
    authServer.authMethods = authMethods;
    // Update password strategy in globals.json
    glob.passwordStrategy = body.glob.passwordStrategy;
    // Throw out all auth methods from this auth server from globals
    if (glob.portal && glob.portal.authMethods) {
        const strippedList = [];
        for (let i = 0; i < glob.portal.authMethods.length; ++i) {
            const thisAm = glob.portal.authMethods[i];
            const splitPos = thisAm.indexOf(':');
            if (splitPos < 0) {
                // wtf
                strippedList.push(thisAm);
                continue;
            }
            const thisAmServerId = thisAm.substring(0, splitPos);
            if (thisAmServerId !== serverId)
                strippedList.push(thisAm);
        }
        glob.portal.authMethods = strippedList;
    } else {
        if (glob.portal)
            glob.portal.authMethods = [];
        else
            glob.portal = { authMethods: [] };
    }
    for (let i = 0; i < authMethods.length; ++i) {
        const thisAm = authMethods[i];
        if (thisAm.useForPortal)
            glob.portal.authMethods.push(`${serverId}:${thisAm.name}`);
        if (thisAm.hasOwnProperty('useForPortal'))
            delete thisAm.useForPortal;
    }

    // Now do the same for the APIs; first strip all method IDs from this Auth Server
    const apis = utils.loadApis(req.app);
    for (let api of apis.apis) {
        if (api.auth !== 'oauth2')
            continue;
        const strippedList = [];
        const apiAuthMethods = api.authMethods ? api.authMethods : [];
        for (let authMethodId of apiAuthMethods) {
            if (!authMethodId.startsWith(`${serverId}:`))
                strippedList.push(authMethodId);
        }
        api.authMethods = strippedList;
    }
    // And then add them back from the auth server JSON (and delete the "apis" object)
    for (let am of authMethods) {
        for (let apiId in am.apis) {
            if (am.apis[apiId]) {
                const thisApi = apis.apis.find(a => a.id === apiId);
                if (!thisApi) {
                    warn(`Could not add auth method ${am.name} to API ${apiId}, API not found.`);
                }
                thisApi.authMethods.push(`${serverId}:${am.name}`);
            }
        }
        // Delete the apis object
        delete am.apis;
    }

    debug(glob);
    debug(JSON.stringify(authServer, null, 2));

    utils.saveGlobals(req.app, glob);
    utils.saveAuthServer(req.app, serverId, authServer);
    utils.saveApis(req.app, apis);

    res.status(204).json({ message: 'OK' });
});

module.exports = router;
