'use strict';

var fs = require('fs');
var path = require('path');
var { debug, info, warn, error } = require('./logger')('portal-env:config-updater');
var cryptTools = require('./crypt-tools');

var updater = function () { };

var updateSteps = {
    1: updateStep1_June2016,
    2: updateStep2_June2016,
    3: updateStep3_Oct2016,
    4: updateStep4_Mar2017,
    5: updateStep5_Apr2017,
    6: updateStep6_Aug2017,
    7: updateStep7_Nov2017,
    8: updateStep8_Dec2017,
    10: updateStep10_v1_0_0a,
    11: updateStep11_v1_0_0b,
    12: updateStep12_v1_0_0c,
    13: updateStep13_v1_0_0d,
    14: updateStep14_v1_0_0e,
    15: updateStep15_v1_0_0f,
    16: updateStep16_v1_0_0g,
    17: updateStep17_v1_0_0h,
    18: updateStep18_v1_0_0i,
    19: updateStep19_v1_0_0j,
    20: updateStep20_v1_0_0k,
    21: updateStep21_v1_0_0i
};

updater.updateConfig = function (staticConfigPath, initialStaticConfigPath, configKey) {
    info('updateConfig - Target: ' + staticConfigPath + ', Source: ' + initialStaticConfigPath);
    var targetConfig = makeConfigPaths(staticConfigPath);
    var sourceConfig = makeConfigPaths(initialStaticConfigPath);

    var targetGlobals = JSON.parse(fs.readFileSync(targetConfig.globalsFile));
    var currentVersion = 0;
    if (targetGlobals.version)
        currentVersion = targetGlobals.version;

    info('Starting at config version: ' + currentVersion);

    for (var step in updateSteps) {
        if (currentVersion < step)
            updateSteps[step](targetConfig, sourceConfig, configKey);
    }

    verifyConfigKey(staticConfigPath, configKey);

    info('updateConfig finished.');
};

function verifyConfigKey(staticConfigPath, configKey) {
    const globalData = JSON.parse(fs.readFileSync(path.join(staticConfigPath, 'globals.json'), 'utf8'));
    if (globalData.configKeyCheck) {
        const configKeyCheck = cryptTools.apiDecrypt(configKey, globalData.configKeyCheck);
        debug('configKeyCheck: ' + configKeyCheck);
        const wickedCheckText = configKeyCheck.substring(40);
        if (wickedCheckText !== 'wicked')
            throw Error('Property configKeyCheck in globals.json did not contain expected check string; is your PORTAL_CONFIG_KEY wrong?.');
        debug('updateConfig() - config key verified correct.');
    }
}

function makeConfigPaths(basePath) {
    debug('makeConfigPaths() - ' + basePath);
    var globalsFile = path.join(basePath, 'globals.json');
    var apisDir = path.join(basePath, 'apis');
    var contentDir = path.join(basePath, 'content');
    var groupsDir = path.join(basePath, 'groups');
    var templatesDir = path.join(basePath, 'templates');
    var emailDir = path.join(templatesDir, 'email');
    var plansFile = path.join(basePath, 'plans', 'plans.json');
    var authServersDir = path.join(basePath, 'auth-servers');
    var poolsDir = path.join(basePath, 'pools');
    var envDir = path.join(basePath, 'env');

    return {
        basePath: basePath,
        globalsFile: globalsFile,
        apisDir: apisDir,
        contentDir: contentDir,
        groupsDir: groupsDir,
        templatesDir: templatesDir,
        emailDir: emailDir,
        chatbotTemplates: path.join(templatesDir, 'chatbot.json'),
        plansFile: plansFile,
        authServersDir: authServersDir,
        poolsDir: poolsDir,
        envDir: envDir
    };
}

function loadGlobals(config) {
    debug('loadGlobals() - ' + config.globalsFile);
    return JSON.parse(fs.readFileSync(config.globalsFile, 'utf8'));
}

function saveGlobals(config, glob) {
    debug('saveGlobals() - ' + config.globalsFile);
    fs.writeFileSync(config.globalsFile, JSON.stringify(glob, null, 2), 'utf8');
}

function loadApis(config) {
    debug('loadApis() - ' + config.apisDir);
    return JSON.parse(fs.readFileSync(path.join(config.apisDir, 'apis.json'), 'utf8'));
}

function saveApis(config, apiDefs) {
    debug('saveApis() - ' + config.apisDir);
    fs.writeFileSync(path.join(config.apisDir, 'apis.json'), JSON.stringify(apiDefs, null, 2), 'utf8');
}

function getApiConfigFileName(config, apiId) {
    return path.join(config.apisDir, apiId, 'config.json');
}

function loadApiConfig(config, apiId) {
    debug('loadApiConfig() - ' + config.apisDir + ', API ' + apiId);
    return JSON.parse(fs.readFileSync(getApiConfigFileName(config, apiId), 'utf8'));
}

function saveApiConfig(config, apiId, apiConfig) {
    debug('saveApiConfig() - ' + config.apisDir + ', API ' + apiId);
    debug('apiConfig.api:');
    debug(apiConfig.api);
    debug('apiConfig.plugins:');
    debug(apiConfig.plugins);
    fs.writeFileSync(getApiConfigFileName(config, apiId), JSON.stringify(apiConfig, null, 2), 'utf8');
}

function loadPlans(config) {
    debug('loadPlans() - ' + config.plansFile);
    return JSON.parse(fs.readFileSync(config.plansFile, 'utf8'));
}

function savePlans(config, plans) {
    debug('savePlans() - ' + config.plansFile);
    debug(plans);
    fs.writeFileSync(config.plansFile, JSON.stringify(plans, null, 2));
}

function copyTextFile(source, target) {
    debug('copyTextFile("' + source + '", "' + target + '")');
    fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
}

function copyFile(source, target) {
    debug('copyFile("' + source + '", "' + target + '")');
    fs.writeFileSync(target, fs.readFileSync(source));
}

function loadAuthServerList(config) {
    var authServerDir = config.authServersDir;
    debug('loadAuthServerList("' + authServerDir + '"');
    debug('Checking directory ' + authServerDir + ' for auth servers.');
    if (!fs.existsSync(authServerDir)) {
        debug('No auth servers defined.');
        return [];
    } else {
        const fileNames = fs.readdirSync(authServerDir);
        const serverNames = [];
        for (let i = 0; i < fileNames.length; ++i) {
            const fileName = fileNames[i];
            if (fileName.endsWith('.json')) {
                const authServerName = fileName.substring(0, fileName.length - 5);
                debug('Found auth server ' + authServerName);
                serverNames.push(authServerName); // strip .json
            }
        }
        return serverNames;
    }
}

function loadAuthServer(config, authServerId) {
    debug('loadAuthServer("' + authServerId + '")');
    return JSON.parse(fs.readFileSync(path.join(config.authServersDir, authServerId + '.json')));
}

function saveAuthServer(config, authServerId, authServer) {
    debug('saveAuthServer() - ' + authServerId);
    fs.writeFileSync(path.join(config.authServersDir, authServerId + '.json'), JSON.stringify(authServer, null, 2));
}

function existsEnv(config, envName) {
    debug(`existsEnv(${envName})`);
    return fs.existsSync(path.join(config.envDir, envName + '.json'));
}

function loadEnv(config, envName) {
    debug(`loadEnv(${envName})`);
    return JSON.parse(fs.readFileSync(path.join(config.envDir, envName + '.json')));
}

function saveEnv(config, envName, envData) {
    debug(`saveEnv(${envName})`);
    fs.writeFileSync(path.join(config.envDir, envName + '.json'), JSON.stringify(envData, null, 2));
}

function loadKickstarter(config) {
    debug('loadKickstarter()');
    return JSON.parse(fs.readFileSync(path.join(config.basePath, 'kickstarter.json')));
}

function saveKickstarter(config, kickData) {
    debug('saveKickstarter()');
    fs.writeFileSync(path.join(config.basePath, 'kickstarter.json'), JSON.stringify(kickData, null, 2));
}

function updateStep21_v1_0_0i(targetConfig, sourceConfig, configKey) {
    debug("Performing updateStep21");

    const targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 21;

    if (targetGlobals.chatbot) {
        const events = targetGlobals.chatbot.events;  // Copy old events to each new hook
        // Check if this file already has a targets variable and skip its updating
        if (targetGlobals.chatbot.targets === undefined) {
            // Create new field with target values
            targetGlobals.chatbot.targets = [];

            // With this version the chatbot changed in a couple of ways
            // 1. Support has been added for ms teams and the structure has been changed to be extendible
            // 2. Events to notify for are now set on a per hook basis instead of global over all hooks
            for (let i = 0; i < targetGlobals.chatbot.hookUrls.length; i++) {
                let hookUrl = targetGlobals.chatbot.hookUrls[i];
                targetGlobals.chatbot.targets.push({
                    "type": "slack",
                    "hookUrl": hookUrl,
                    "events": events
                });
            }

            // The old two properties can be deleted now.
            delete targetGlobals.chatbot.events;
            delete targetGlobals.chatbot.hookUrls;
        }
    }
    saveGlobals(targetConfig, targetGlobals);
}

function updateStep20_v1_0_0k(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep20');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);
    targetGlobals.version = 20;

    const sourceDefaultEnv = loadEnv(sourceConfig, 'default');
    const targetDefaultEnv = loadEnv(targetConfig, 'default');

    let needsSave = false;
    if (targetGlobals.storage) {
        // Check if the defaults are still set in globals.json, and if so, make sure that they
        // are replaced with overridable environment variables.
        if (targetGlobals.storage.pgPort == '5432' && !targetDefaultEnv.hasOwnProperty('PORTAL_STORAGE_PGPORT')) {
            // Replace with env var
            targetGlobals.storage.pgPort = sourceGlobals.storage.pgPort;
            targetDefaultEnv.PORTAL_STORAGE_PGPORT = sourceDefaultEnv.PORTAL_STORAGE_PGPORT;
            needsSave = true;
        }
        if (targetGlobals.storage.pgUser == 'kong' && !targetDefaultEnv.hasOwnProperty('PORTAL_STORAGE_PGUSER')) {
            targetGlobals.storage.pgUser = sourceGlobals.storage.pgUser;
            targetDefaultEnv.PORTAL_STORAGE_PGUSER = sourceDefaultEnv.PORTAL_STORAGE_PGUSER;
            needsSave = true;
        }
        if (targetGlobals.storage.pgDatabase == 'wicked' && !targetDefaultEnv.hasOwnProperty('PORTAL_STORAGE_PGDATABASE')) {
            targetGlobals.storage.pgDatabase = sourceGlobals.storage.pgDatabase;
            targetDefaultEnv.PORTAL_STORAGE_PGDATABASE = sourceDefaultEnv.PORTAL_STORAGE_PGDATABASE;
            needsSave = true;
        }
    }

    if (needsSave) {
        info('Updated Postgres settings for wicked (introduced environment variables)');
        saveEnv(targetConfig, 'default', targetDefaultEnv);
        saveGlobals(targetConfig, targetGlobals);
    }

    // This has to be done in any case, to persist the updated version; it might be we
    // do it twice here, but that's not so important.
    saveGlobals(targetConfig, targetGlobals);
}

function updateStep19_v1_0_0j(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep19');

    const targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 19;

    const sourceBoxEnv = loadEnv(sourceConfig, 'box');
    if (!existsEnv(targetConfig, 'box')) {
        saveEnv(targetConfig, 'box', sourceBoxEnv);
    }
    const sourceDefaultEnv = loadEnv(sourceConfig, 'default');
    const targetDefaultEnv = loadEnv(targetConfig, 'default');
    if (!targetDefaultEnv.DOCKER_HOST) {
        targetDefaultEnv.DOCKER_HOST = sourceDefaultEnv.DOCKER_HOST;
        saveEnv(targetConfig, 'default', targetDefaultEnv);
    }

    const kickstarter = loadKickstarter(targetConfig);
    if (!kickstarter.envs.find(e => e === 'box')) {
        // Add a k8s env
        kickstarter.envs.push('box');
        saveKickstarter(targetConfig, kickstarter);
    }

    saveGlobals(targetConfig, targetGlobals);
}


function updateStep18_v1_0_0i(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep18');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);

    if (!targetGlobals.api)
        targetGlobals.api = {};
    if (!targetGlobals.api.hasOwnProperty('apiUserGroup'))
        targetGlobals.api.apiUserGroup = sourceGlobals.api.apiUserGroup;
    if (!targetGlobals.api.hasOwnProperty('echoUserGroup'))
        targetGlobals.api.echoUserGroup = sourceGlobals.api.echoUserGroup;

    targetGlobals.version = 18;

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep17_v1_0_0h(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep17');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);

    if (!targetGlobals.passwordStrategy)
        targetGlobals.passwordStrategy = sourceGlobals.passwordStrategy;

    targetGlobals.version = 17;

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep16_v1_0_0g(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep16');

    const targetGlobals = loadGlobals(targetConfig);

    targetGlobals.version = 16;
    const swaggerCssFile = 'swagger-override.css.mustache';
    const targetSwaggerCssFile = path.join(targetConfig.contentDir, swaggerCssFile);
    const sourceSwaggerCssFile = path.join(sourceConfig.contentDir, swaggerCssFile);
    if (!fs.existsSync(targetSwaggerCssFile)) {
        copyFile(sourceSwaggerCssFile, targetSwaggerCssFile);
    }

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep15_v1_0_0f(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep15');

    const targetGlobals = loadGlobals(targetConfig);

    targetGlobals.version = 15;
    if (targetGlobals.storage) {
        // Specify the default postgres database for the wicked data
        if (!targetGlobals.storage.pgDatabase)
            targetGlobals.storage.pgDatabase = 'wicked';
    }

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep14_v1_0_0e(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep14');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);

    targetGlobals.version = 14;
    if (!targetGlobals.storage) {
        targetGlobals.storage = sourceGlobals.storage;

        const sourceDefaultEnv = loadEnv(sourceConfig, 'default');
        const targetDefaultEnv = loadEnv(targetConfig, 'default');


        const updateEnv = function (source, target) {
            let updated = false;
            if (!target.PORTAL_STORAGE_PGHOST) {
                debug('Adding ' + JSON.stringify(source.PORTAL_STORAGE_PGHOST));
                target.PORTAL_STORAGE_PGHOST = source.PORTAL_STORAGE_PGHOST;
                updated = true;
            }
            if (!target.PORTAL_STORAGE_PGPASSWORD) {
                target.PORTAL_STORAGE_PGPASSWORD = source.PORTAL_STORAGE_PGPASSWORD;
                updated = true;
            }
            return updated;
        };

        debug(targetDefaultEnv);
        updateEnv(sourceDefaultEnv, targetDefaultEnv);
        saveEnv(targetConfig, 'default', targetDefaultEnv);
        debug(targetDefaultEnv);

        // Also for k8s env
        const sourceK8sEnv = loadEnv(sourceConfig, 'k8s');
        if (existsEnv(targetConfig, 'k8s')) {
            const targetK8sEnv = loadEnv(targetConfig, 'k8s');
            if (updateEnv(sourceK8sEnv, targetK8sEnv))
                saveEnv(targetConfig, 'k8s', targetK8sEnv);
        }
        // Don't update if there is no localhost env yet
        if (existsEnv(targetConfig, 'localhost')) {
            const localEnv = loadEnv(targetConfig, 'localhost');
            if (!localEnv.PORTAL_STORAGE_PGHOST) {
                localEnv.PORTAL_STORAGE_PGHOST = {
                    value: "${LOCAL_IP}"
                };
            }
            saveEnv(targetConfig, 'localhost', localEnv);
        }

    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Remove config flag http_if_terminated from Kong configs of APIs.
 */
function updateStep13_v1_0_0d(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep13');

    const targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 13;

    const apis = loadApis(targetConfig);
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        const apiConfig = loadApiConfig(targetConfig, thisApi.id);
        if (apiConfig.api.hasOwnProperty('http_if_terminated')) {
            delete apiConfig.api.http_if_terminated;
            saveApiConfig(targetConfig, thisApi.id, apiConfig);
            info(`Removed property http_if_terminated from API ${thisApi.id} config.`);
        }
    }
    const authServerNames = loadAuthServerList(targetConfig);
    for (let i = 0; i < authServerNames.length; ++i) {
        const asName = authServerNames[i];
        const as = loadAuthServer(targetConfig, asName);
        if (as.config && as.config.api && as.config.api.hasOwnProperty('http_if_terminated')) {
            delete as.config.api.http_if_terminated;
            saveAuthServer(targetConfig, asName, as);
            info(`Removed property http_if_terminated from AuthServer ${asName} config.`);
        }
    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Add new env var PORTAL_ECHO_URL
 */
function updateStep12_v1_0_0c(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep12');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);
    targetGlobals.version = 12;


    const updateEnv = function (source, target) {
        let updated = false;
        if (!target.PORTAL_ECHO_URL) {
            debug('Adding ' + JSON.stringify(source.PORTAL_ECHO_URL));
            target.PORTAL_ECHO_URL = source.PORTAL_ECHO_URL;
            updated = true;
        }
        return updated;
    };

    const sourceDefaultEnv = loadEnv(sourceConfig, 'default');

    const targetDefaultEnv = loadEnv(targetConfig, 'default');
    debug(targetDefaultEnv);
    updateEnv(sourceDefaultEnv, targetDefaultEnv);
    saveEnv(targetConfig, 'default', targetDefaultEnv);
    debug(targetDefaultEnv);

    // Also for k8s env
    const sourceK8sEnv = loadEnv(sourceConfig, 'k8s');
    if (existsEnv(targetConfig, 'k8s')) {
        const targetK8sEnv = loadEnv(targetConfig, 'k8s');
        if (updateEnv(sourceK8sEnv, targetK8sEnv))
            saveEnv(targetConfig, 'k8s', targetK8sEnv);
    }
    // Don't update if there is no localhost env yet
    if (existsEnv(targetConfig, 'localhost')) {
        const localEnv = loadEnv(targetConfig, 'localhost');
        if (!localEnv.PORTAL_ECHO_URL) {
            localEnv.PORTAL_ECHO_URL = {
                value: "http://${LOCAL_IP}:3009"
            };
            saveEnv(targetConfig, 'localhost', localEnv);
        }
    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Add a default registration pool 'wicked'
 */
function updateStep11_v1_0_0b(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep11');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);
    targetGlobals.version = 11;

    if (!fs.existsSync(targetConfig.poolsDir)) {
        debug(`Creating directory ${targetConfig.poolsDir}`);
        fs.mkdirSync(targetConfig.poolsDir);
    }

    const targetWickedConfig = path.join(targetConfig.poolsDir, 'wicked.json');
    const sourceWickedConfig = path.join(sourceConfig.poolsDir, 'wicked.json');
    if (!fs.existsSync(targetWickedConfig)) {
        debug(`Creating ${targetWickedConfig} (copying from initial config)`);
        copyFile(sourceWickedConfig, targetWickedConfig);
    } else {
        debug(`File ${targetWickedConfig} already exists, not overwriting.`);
    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Adapt the scopes configuration inside API definitions to include
 * descriptions (default to the name of the scope for now).
 * 
 * Add new network settings for added components
 * - Kong OAuth2 Adapter
 * - Auth Server
 * 
 * Add default Auth Server configuration
 */
function updateStep10_v1_0_0a(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep6_Aug2017()');

    const targetGlobals = loadGlobals(targetConfig);
    const sourceGlobals = loadGlobals(sourceConfig);
    targetGlobals.version = 10;

    const apis = loadApis(targetConfig);
    let needsSaving = false;
    for (let i = 0; i < apis.apis.length; ++i) {
        const api = apis.apis[i];
        if (api.auth !== 'oauth2')
            continue;
        if (api.settings) {
            if (api.settings.scopes) {
                const newScopes = {};
                if (Array.isArray(api.settings.scopes)) {
                    for (let scope of api.settings.scopes) {
                        newScopes[scope] = { description: scope };
                    }
                } else {
                    for (let scope in api.settings.scopes) {
                        newScopes[scope] = { description: scope };
                    }
                }
                api.settings.scopes = newScopes;
                needsSaving = true;
            }
        }
    }

    if (needsSaving) {
        saveApis(targetConfig, apis);
    }

    if (!targetGlobals.network.kongOAuth2Url)
        targetGlobals.network.kongOAuth2Url = sourceGlobals.network.kongOAuth2Url;
    if (!targetGlobals.portal) // Default authMethods
        targetGlobals.portal = sourceGlobals.portal;

    if (!fs.existsSync(targetConfig.authServersDir))
        fs.mkdirSync(targetConfig.authServersDir);
    const targetDefaultAuthServer = path.join(targetConfig.authServersDir, 'default.json');
    const sourceDefaultAuthServer = path.join(sourceConfig.authServersDir, 'default.json');
    if (!fs.existsSync(targetDefaultAuthServer))
        copyFile(sourceDefaultAuthServer, targetDefaultAuthServer);

    // Now do some env file updating...
    const updateEnv = function (source, target) {
        let updated = false;
        // if (!target.PORTAL_KONG_OAUTH2_URL) {
        //     debug('Adding ' + JSON.stringify(source.PORTAL_KONG_OAUTH2_URL));
        //     target.PORTAL_KONG_OAUTH2_URL = source.PORTAL_KONG_OAUTH2_URL;
        //     updated = true;
        // }
        if (!target.PORTAL_AUTHSERVER_URL) {
            debug('Adding ' + JSON.stringify(source.PORTAL_AUTHSERVER_URL));
            target.PORTAL_AUTHSERVER_URL = source.PORTAL_AUTHSERVER_URL;
            updated = true;
        }
        return updated;
    };

    const sourceDefaultEnv = loadEnv(sourceConfig, 'default');

    const targetDefaultEnv = loadEnv(targetConfig, 'default');
    debug(targetDefaultEnv);
    updateEnv(sourceDefaultEnv, targetDefaultEnv);
    if (!targetDefaultEnv.HELM_NAME)
        targetDefaultEnv.HELM_NAME = sourceDefaultEnv.HELM_NAME;
    if (!targetDefaultEnv.K8S_NAMESPACE)
        targetDefaultEnv.K8S_NAMESPACE = sourceDefaultEnv.K8S_NAMESPACE;
    saveEnv(targetConfig, 'default', targetDefaultEnv);
    debug(targetDefaultEnv);

    // Also for k8s env
    const sourceK8sEnv = loadEnv(sourceConfig, 'k8s');
    if (existsEnv(targetConfig, 'k8s')) {
        const targetK8sEnv = loadEnv(targetConfig, 'k8s');
        if (updateEnv(sourceK8sEnv, targetK8sEnv))
            saveEnv(targetConfig, 'k8s', targetK8sEnv);
    } else {
        // Does not yet exist, just copy it
        saveEnv(targetConfig, 'k8s', sourceK8sEnv);
    }
    // Don't update if there is no localhost env yet
    if (existsEnv(targetConfig, 'localhost')) {
        const localEnv = loadEnv(targetConfig, 'localhost');
        if (!localEnv.PORTAL_AUTHSERVER_URL) {
            localEnv.PORTAL_AUTHSERVER_URL = {
                value: "http://${LOCAL_IP}:3010"
            };
            saveEnv(targetConfig, 'localhost', localEnv);
        }
    }

    const kickstarter = loadKickstarter(targetConfig);
    if (!kickstarter.envs.find(e => e === 'k8s')) {
        // Add a k8s env
        kickstarter.envs.push('k8s');
        saveKickstarter(targetConfig, kickstarter);
    }

    saveGlobals(targetConfig, targetGlobals);
}

function updateApiConfigs(targetConfig, updateApiConfig) {
    debug('updateApiConfigs()');
    const apis = loadApis(targetConfig);
    for (let i = 0; i < apis.apis.length; ++i) {
        const apiConfig = loadApiConfig(targetConfig, apis.apis[i].id);
        let needsSaving = false;
        // Call the update delegate
        if (apiConfig) {
            const { api, plugins } = updateApiConfig(apiConfig.api, apiConfig.plugins);
            apiConfig.api = api;
            apiConfig.plugins = plugins;
            needsSaving = true;
        }
        if (needsSaving) {
            debug('API ' + apis.apis[i].id + ' updated.');
            debug(apiConfig.api);
            saveApiConfig(targetConfig, apis.apis[i].id, apiConfig);
            debug('Reloaded: ');
            debug(loadApiConfig(targetConfig, apis.apis[i].id).api);
        }
    }

    // Also check all Authorization Servers for this setting.
    var authServers = loadAuthServerList(targetConfig);
    for (let i = 0; i < authServers.length; ++i) {
        var authServerId = authServers[i];
        var authServer = loadAuthServer(targetConfig, authServerId);
        if (authServer.config && authServer.config.api) {
            const apiConfig = authServer.config;
            const { api, plugins } = updateApiConfig(apiConfig.api, apiConfig.plugins);
            apiConfig.api = api;
            apiConfig.plugins = plugins;
            saveAuthServer(targetConfig, authServerId, authServer);
        }
    }
}

/**
 * Fix another little glitch when coming from a 0.10.x Kong configuration
 * which uses the CORS plugin (origin --> origins in the plugin configuration)
 */
function updateStep7_Nov2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep6_Aug2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 7;

    updateApiConfigs(targetConfig, function (apiConfig, apiPlugins) {
        // Check plugins
        if (apiPlugins) {
            for (let i = 0; i < apiPlugins.length; ++i) {
                const p = apiPlugins[i];
                if (p.name === "cors" && p.config && p.config.origin && !p.config.origins) {
                    p.config.origins = p.config.origin;
                    delete p.config.origin;
                }
            }
        }
        return { api: apiConfig, plugins: apiPlugins };
    });

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep8_Dec2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep8_Dec2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 8;

    if (!targetGlobals.kongAdapter) {
        debug('Adding a default kongAdapter property.');
        targetGlobals.kongAdapter = {
            useKongAdapter: true,
            ignoreList: ['plugin-name']
        };
    }

    copyTextFile(path.join(sourceConfig.contentDir, 'wicked.css'), path.join(targetConfig.contentDir, 'wicked.css'));
    saveGlobals(targetConfig, targetGlobals);
}


/**
 * Adapt the Kong configuration of the APIs to the new Kong API as of
 * Kong 0.10.x, most notably change request_uri to an array uris and
 * map strip_request_path to strip_uri.
 *
 * Add a new section sessionStore to globals, prefill with 'file'.
 */
function updateStep6_Aug2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep6_Aug2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 6;

    var updateApiConfig = function (cfg) {
        if (cfg.request_path) {
            cfg.uris = [cfg.request_path]; // wrap in array
            delete cfg.request_path;
        }
        if (cfg.hasOwnProperty('strip_request_path')) {
            cfg.strip_uri = cfg.strip_request_path;
            delete cfg.strip_request_path;
        }
        if (!cfg.hasOwnProperty('http_if_terminated')) {
            cfg.http_if_terminated = true;
        }
        return cfg;
    };

    // Kong API change (tsk tsk, don't do that, please)
    // Change all request_path and strip_request_path occurrances
    // to uris and strip_uris.
    const apis = loadApis(targetConfig);
    for (let i = 0; i < apis.apis.length; ++i) {
        const apiConfig = loadApiConfig(targetConfig, apis.apis[i].id);
        let needsSaving = false;
        // Look for "api.request_path"
        if (apiConfig && apiConfig.api) {
            apiConfig.api = updateApiConfig(apiConfig.api);
            needsSaving = true;
        }
        if (needsSaving) {
            debug('API ' + apis.apis[i].id + ' updated.');
            debug(apiConfig.api);
            saveApiConfig(targetConfig, apis.apis[i].id, apiConfig);
            debug('Reloaded: ');
            debug(loadApiConfig(targetConfig, apis.apis[i].id).api);
        }
    }

    // Also check all Authorization Servers for this setting; these also
    // have a request_path set which needs to be mapped to a uris array.
    var authServers = loadAuthServerList(targetConfig);
    for (let i = 0; i < authServers.length; ++i) {
        var authServerId = authServers[i];
        var authServer = loadAuthServer(targetConfig, authServerId);
        if (authServer.config && authServer.config.api) {
            authServer.config.api = updateApiConfig(authServer.config.api);
            saveAuthServer(targetConfig, authServerId, authServer);
        }
    }

    if (!targetGlobals.sessionStore) {
        debug('Adding a default sessionStore property.');
        targetGlobals.sessionStore = {
            type: 'file',
            host: 'portal-redis',
            port: 6379,
            password: ''
        };
    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Add options in globals.json to allow
 *  - customization of the layout by the end user
 *  - edition of some views title tagline
 *  - force the redirect to HTTPS
 */
function updateStep5_Apr2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep5_Apr2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 5;

    // Add layouts options
    targetGlobals.layouts = {
        defautRootUrl: 'http://wicked.haufe.io',
        defautRootUrlTarget: '_blank',
        defautRootUrlText: null,
        menu: {
            homeLinkText: 'Home',
            apisLinkVisibleToGuest: true,
            applicationsLinkVisibleToGuest: true,
            contactLinkVisibleToGuest: true,
            contentLinkVisibleToGuest: true,
            classForLoginSignupPosition: 'left',
            showSignupLink: true,
            loginLinkText: 'Log in'
        },
        footer: {
            showBuiltBy: true,
            showBuilds: true
        },
        swaggerUi: {
            menu: {
                homeLinkText: 'Home',
                showContactLink: true,
                showContentLink: false
            }
        }
    };

    // JSHint doesn't like the multiline formatting here, so we'll switch it off for a small section
    /* jshint ignore:start */
    // Add views options
    targetGlobals.views = {
        apis: {
            showApiIcon: true,
            titleTagline: 'This is the index of APIs which are available for this API Portal.'
        },
        applications: {
            titleTagline: 'This page displays all your registered applications. \
It also allows you to register a new application.'
        },
        application: {
            titleTagline: 'This page lets you administer the owners of this application. You can add and remove \
co-owners of the application. New co-owners must be already be registered in the portal \
in order to make them co-owners of the application.'
        }
    };
    /* jshint ignore:end */

    // Add option to force redirection to HTTPS when website is called in HTTP
    targetGlobals.network.forceRedirectToHttps = false;

    // Save new changes
    saveGlobals(targetConfig, targetGlobals);
}

function updateStep4_Mar2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep4_Mar2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 4;

    // This is a checksum to ensure we are using the same config_key when editing
    // and deploying
    const salt = cryptTools.createRandomId();
    targetGlobals.configKeyCheck = cryptTools.apiEncrypt(configKey, salt + 'wicked');

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep3_Oct2016(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep3_Oct2016()');
    // configKey is not used here

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 3;

    // Kong API change (tsk tsk, don't do that, please)
    // Change all rate-limiting and response-ratelimiting plugins, rename
    // continue_on_error to fault_tolerant and remove async.
    const apis = loadApis(targetConfig);
    for (let i = 0; i < apis.apis.length; ++i) {
        const apiConfig = loadApiConfig(targetConfig, apis.apis[i].id);
        let needsSaving = false;
        // Look for "rate-limiting" plugin (if we have plugins)
        if (apiConfig && apiConfig.plugins) {
            for (let plugin = 0; plugin < apiConfig.plugins.length; ++plugin) {
                const apiPlugin = apiConfig.plugins[plugin];
                if (oct2016_updatePlugin(apiPlugin))
                    needsSaving = true;
            }
        }
        if (needsSaving) {
            debug('API ' + apis.apis[i].id + ' updated: Plugins:');
            debug(apiConfig.plugins);
            saveApiConfig(targetConfig, apis.apis[i].id, apiConfig);
            debug('Reloaded: ');
            debug(loadApiConfig(targetConfig, apis.apis[i].id).plugins);
        }
    }

    const plans = loadPlans(targetConfig);
    let planNeedsSaving = false;
    for (let i = 0; i < plans.plans.length; ++i) {
        const plan = plans.plans[i];
        if (plan.config && plan.config.plugins) {
            for (let plugin = 0; plugin < plan.config.plugins.length; ++plugin) {
                const planPlugin = plan.config.plugins[plugin];
                if (oct2016_updatePlugin(planPlugin))
                    planNeedsSaving = true;
            }
        }
    }
    if (planNeedsSaving) {
        debug('Plans updated:');
        debug(plans);
        savePlans(targetConfig, plans);
    }

    // Part two: Make oauth2 settings explicit
    let apisNeedSave = false;
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        if (thisApi.auth && thisApi.auth == 'oauth2') {
            if (!thisApi.settings) {
                thisApi.settings = {
                    token_expiration: 3600
                };
            } else if (!thisApi.settings.token_expiration) {
                thisApi.settings.token_expiration = 3600;
            }
            if (!thisApi.settings.enable_implicit_grant)
                thisApi.settings.enable_client_credentials = true;
            apisNeedSave = true;
        }
    }
    if (apisNeedSave)
        saveApis(targetConfig, apis);

    saveGlobals(targetConfig, targetGlobals);
}

function oct2016_updatePlugin(apiPlugin) {
    let changedSomething = false;
    if (apiPlugin.name !== 'rate-limiting' &&
        apiPlugin.name !== 'response-ratelimiting')
        return false;
    if (apiPlugin.config && apiPlugin.config.hasOwnProperty('continue_on_error')) {
        const fault_tolerant = apiPlugin.config.continue_on_error;
        delete apiPlugin.config.continue_on_error;
        apiPlugin.config.fault_tolerant = fault_tolerant;
        changedSomething = true;
    }
    if (apiPlugin.config && apiPlugin.config.hasOwnProperty('async')) {
        delete apiPlugin.config.async;
        changedSomething = true;
    }
    return changedSomething;
}

function updateStep2_June2016(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep2_June2016()');
    // configKey not used here

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 2;

    // Add two PNG files
    copyFile(path.join(sourceConfig.contentDir, 'images', 'wicked-40.png'), path.join(targetConfig.contentDir, 'images', 'wicked-40.png'));
    copyFile(path.join(sourceConfig.contentDir, 'images', 'wicked-auth-page-120.png'), path.join(targetConfig.contentDir, 'images', 'wicked-auth-page-120.png'));

    // Privacy statement and Terms and Conditions
    copyTextFile(path.join(sourceConfig.contentDir, 'terms-and-conditions.jade'), path.join(targetConfig.contentDir, 'terms-and-conditions.jade'));
    copyTextFile(path.join(sourceConfig.contentDir, 'terms-and-conditions.json'), path.join(targetConfig.contentDir, 'terms-and-conditions.json'));
    copyTextFile(path.join(sourceConfig.contentDir, 'privacy-policy.jade'), path.join(targetConfig.contentDir, 'privacy-policy.jade'));
    copyTextFile(path.join(sourceConfig.contentDir, 'privacy-policy.json'), path.join(targetConfig.contentDir, 'privacy-policy.json'));

    // Pre-fill the company with the title
    targetGlobals.company = targetGlobals.title;

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep1_June2016(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep1_June2016()');
    // configKey not used here

    var targetGlobals = loadGlobals(targetConfig);
    // This is for version 1
    targetGlobals.version = 1;

    // Add kickstarter.json
    copyTextFile(path.join(sourceConfig.basePath, 'kickstarter.json'), path.join(targetConfig.basePath, 'kickstarter.json'));

    // Add the templates
    if (!fs.existsSync(targetConfig.templatesDir))
        fs.mkdirSync(targetConfig.templatesDir);
    if (!fs.existsSync(targetConfig.emailDir))
        fs.mkdirSync(targetConfig.emailDir);

    copyTextFile(sourceConfig.chatbotTemplates, targetConfig.chatbotTemplates);
    var emailTemplates = [
        'lost_password',
        'pending_approval',
        'verify_email'
    ];
    for (var i = 0; i < emailTemplates.length; ++i) {
        var templateFileName = emailTemplates[i] + '.mustache';
        copyTextFile(path.join(sourceConfig.emailDir, templateFileName), path.join(targetConfig.emailDir, templateFileName));
    }

    saveGlobals(targetConfig, targetGlobals);
}

module.exports = updater;
