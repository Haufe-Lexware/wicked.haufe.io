'use strict';

/* global __dirname */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mustache = require('mustache');
const execSync = require('child_process').execSync;
const envReader = require('portal-env');
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:utils');

const utils = function () { };

utils.makeError = function (statusCode, errorText) {
    const err = new Error(errorText);
    err.status = statusCode;
    return err;
};

utils.getJson = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return JSON.parse(ob);
    return ob;
};

utils.jsonifyBody = function (reqBody) {
    const body = {};
    for (let prop in reqBody) {
        applyProperty(body, prop, reqBody[prop]);
    }
    return body;
};

utils.createRandomId = function () {
    return crypto.randomBytes(20).toString('hex');
};

function applyProperty(to, propName, value) {
    const subPropNames = propName.split('.');
    let current = to;
    for (let i = 0; i < subPropNames.length; ++i) {
        let thisProp = subPropNames[i];
        const bracketPos = thisProp.indexOf('[');
        // Array case
        if (bracketPos >= 0) {
            let index = Number(thisProp.substring(bracketPos + 1, thisProp.length - 1));
            thisProp = thisProp.substring(0, bracketPos);
            if (!current.hasOwnProperty(thisProp))
                current[thisProp] = [];
            if (i != subPropNames.length - 1) {
                if (!current[thisProp][index])
                    current[thisProp][index] = {};
                current = current[thisProp][index];
            } else {
                //current[thisProp][index] = value;
                const str_array = value.split(',');
                if (str_array.length > 1) {
                    for (let j = 0; j < str_array.length; j++) {
                        current[thisProp][index++] = str_array[j];
                    }
                } else {
                    current[thisProp][index] = value;
                }
            }
        } else {
            // Object case
            if (i != subPropNames.length - 1) {
                if (!current.hasOwnProperty(thisProp))
                    current[thisProp] = {};
                current = current[thisProp];
            } else {
                if ("on" != value)
                    current[thisProp] = value;
                else
                    current[thisProp] = true;
            }
        }
    }
}

utils.unpackObjects = (ob) => {
    if (typeof ob !== 'object')
        return;
    for (let p in ob) {
        const v = ob[p];
        if (typeof v === 'string') {
            if (v.startsWith('{') || v.startsWith('[')) {
                try {
                    const innerOb = JSON.parse(v);
                    ob[p] = innerOb;
                } catch (err) {
                    error('Could not parse JSON string:');
                    error(v);
                }
            }
        } else if (typeof v === 'object') {
            utils.unpackObjects(v);
        }
    }
};

utils.isString = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return true;
    return false;
};

function replaceVar(ob, propName, envVars) {
    const value = ob[propName];
    if (!value.startsWith('$'))
        return;
    const defaultEnv = envVars["default"];
    const envVar = value.substring(1);
    if (defaultEnv.hasOwnProperty(envVar)) {
        ob[propName] = defaultEnv[envVar].value;
        // Mark it as taken from env var
        ob[propName + '_'] = true;
        ob[propName + '__'] = defaultEnv[envVar].encrypted;
    } else {
        warn('Env var "' + envVar + '" is used, but does not exist in env var dictionary.');
        ob[propName] = '';
        ob[propName + '_'] = true;
        ob[propName + '__'] = false; // Default to unencrypted
    }
}

function getStringValue(origValue, envVars) {
    if (!origValue.startsWith('$'))
        return origValue;
    let envVar = origValue.substring(1);
    let defaultEnv = envVars["default"];
    if (defaultEnv.hasOwnProperty(envVar))
        return defaultEnv[envVar].value;
    warn('getStringValue("' + origValue + '", envVars): Env var is used, but does not exist in env var dictionary.');
    return '';
}

utils.mixinEnv = function (target, envVars) {
    for (let prop in target) {
        const value = target[prop];
        if (utils.isString(value)) {
            // Do our thing here
            replaceVar(target, prop, envVars);
        } else if (Array.isArray(value)) {
            // Well well
            for (let i = 0; i < value.length; ++i) {
                const arrayValue = value[i];
                if (utils.isString(arrayValue))
                    value[i] = getStringValue(arrayValue, envVars);
                else if (!arrayValue)
                    continue;
                else if (Array.isArray(arrayValue))
                    throw new Error('mixinEnv does not support nested arrays. Meh.');
                else
                    utils.mixinEnv(arrayValue, envVars); // Now we can assume an object and recurse
            }
        } else {
            // Assume object, recurse
            utils.mixinEnv(value, envVars);
        }
    }
};

function mixoutVar(prefix, ob, propName, envVars) {
    const value = ob[propName];
    if (!ob[propName + '_'])
        return;
    let envVarName = prefix + '_' + propName.toUpperCase();
    switch (propName) {
        case "apiUrl": envVarName = 'PORTAL_API_URL'; break;
        case "portalUrl": envVarName = 'PORTAL_PORTAL_URL'; break;
        case "kongAdapterUrl": envVarName = 'PORTAL_KONG_ADAPTER_URL'; break;
        case "kongAdminUrl": envVarName = 'PORTAL_KONG_ADMIN_URL'; break;
        case "mailerUrl": envVarName = 'PORTAL_MAILER_URL'; break;
        case "chatbotUrl": envVarName = 'PORTAL_CHATBOT_URL'; break;
        case "staticConfig": envVarName = 'PORTAL_API_STATIC_CONFIG'; break;
        case "dynamicConfig": envVarName = 'PORTAL_API_DYNAMIC_CONFIG'; break;
    }
    if (!envVars[envVarName])
        envVars[envVarName] = {};
    envVars[envVarName].value = value;
    const encrypt = ob[propName + '__'];
    envVars[envVarName].encrypted = encrypt;
    ob[propName] = '$' + envVarName;
    delete ob[propName + '_'];
    delete ob[propName + '__'];
}

function mixoutEnvInt(prefix, source, envVars) {
    for (let prop in source) {
        if (prop.endsWith('_'))
            continue;
        const value = source[prop];
        if (utils.isString(value)) {
            // Do our thing here
            mixoutVar(prefix, source, prop, envVars);
        } else if (Array.isArray(value)) {
            // Well well
            //console.log(value);
            for (let i = 0; i < value.length; ++i) {
                const arrayValue = value[i];
                //console.log(arrayValue);
                if (utils.isString(arrayValue)) {
                    // nop
                } else if (!arrayValue)
                    continue;
                else if (Array.isArray(arrayValue))
                    throw new Error('mixoutEnv does not support nested arrays. Meh.');
                else
                    mixoutEnvInt(prefix + '_' + prop.toUpperCase() + i, arrayValue, envVars); // Now we can assume an object and recurse
            }
        } else {
            // Assume object, recurse
            mixoutEnvInt(prefix + '_' + prop.toUpperCase(), value, envVars);
        }
    }
}

utils.mixoutEnv = function (source, envVars, prefix) {
    if (!prefix)
        mixoutEnvInt('PORTAL', source, envVars["default"]);
    else
        mixoutEnvInt(prefix, source, envVars["default"]);
};

function getBaseDir(app) {
    return app.get('base_path');
}

function getConfigDir(app) {
    return app.get('config_path');
}

function getConfigKey(app) {
    return app.get('config_key');
}

function getResDir() {
    return path.join(__dirname, 'res');
}

function getGlobalsFileName(app) {
    const configDir = getConfigDir(app);
    const globalsFileName = path.join(configDir, 'globals.json');
    return globalsFileName;
}

utils.loadGlobals = function (app) {
    const g = JSON.parse(fs.readFileSync(getGlobalsFileName(app), 'utf8'));
    if (!g.network)
        g.network = {};
    if (!g.network.apiUrl)
        g.network.apiUrl = '$PORTAL_API_URL';
    if (!g.network.portalUrl)
        g.network.portalUrl = '$PORTAL_PORTAL_URL';
    if (!g.network.kongAdapterUrl)
        g.network.kongAdapterUrl = '$PORTAL_KONG_ADAPTER_URL';
    if (!g.network.kongAdminUrl)
        g.network.kongAdminUrl = '$PORTAL_KONG_ADMIN_URL';
    if (!g.network.mailerUrl)
        g.network.mailerUrl = '$PORTAL_MAILER_URL';
    if (!g.network.chatbotUrl)
        g.network.chatbotUrl = '$PORTAL_CHATBOT_URL';
    if (!g.db)
        g.db = {};
    if (!g.db.staticConfig)
        g.db.staticConfig = '$PORTAL_API_STATIC_CONFIG';
    if (!g.db.dynamicConfig)
        g.db.dynamicConfig = '$PORTAL_API_DYNAMIC_CONFIG';
    return g;
};

utils.saveGlobals = function (app, glob) {
    fs.writeFileSync(getGlobalsFileName(app), JSON.stringify(glob, null, 2), 'utf8');
};

/*
utils.loadEnv = function (app) {
    //return JSON.parse(fs.readFileSync(app.get('env_file'), 'utf8'));
    const envFile = fs.readFileSync(app.get('env_file'), 'utf8');
    const lines = envFile.replace(/\r/g, '').split('\n');
    const env = {};
    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        if (!line)
            continue;
        const eq = line.indexOf('=');
        const envVar = line.substring(0, eq);
        const rest = line.substring(eq + 1).trim();
        if (rest.startsWith('$'))
            rest = rest.substring(1);
        if (rest.startsWith('"') || rest.startsWith("'"))
            rest = rest.substring(1, rest.length - 1);
        env[envVar] = unescape(rest);
    }
    return env;
}

utils.saveEnv = function (app, envVars) {
    console.log('env_file: ' + app.get('env_file'));
    //fs.writeFileSync(app.get('env_file') + '.json', JSON.stringify(envVars, null, 2), 'utf8');

    writeEnvFile(app.get('env_file'), envVars);
}
*/

utils.jsonClone = function (ob) {
    return JSON.parse(JSON.stringify(ob));
};

const BUILTIN_ENVVARS = {
    'LOCAL_IP': true,
    'LOCAL_API_HOST': true,
    'LOCAL_PORTAL_HOST': true,
    'LOCAL_PORTAL_URL': true,
    'LOCAL_API_URL': true
};

utils.loadEnvDict = function (app, usedEnvVars) {
    let kickstarter = utils.loadKickstarter(app);
    const envDict = {};
    if (!kickstarter.envs) {
        kickstarter.envs = ["default"];
        utils.saveKickstarter(app, kickstarter);
    }
    for (let i = 0; i < kickstarter.envs.length; ++i) {
        let envName = kickstarter.envs[i];
        let envFileName = path.join(getConfigDir(app), 'env', envName + '.json');
        if (!fs.existsSync(envFileName))
            throw new Error('loadEnvDict(): File not found: ' + envFileName);
        envDict[envName] = JSON.parse(fs.readFileSync(envFileName, 'utf8'));
    }
    decryptEnvDict(app, envDict);
    const defaultEnv = envDict["default"];

    if (usedEnvVars) {
        // Check if we have used env vars which are not yet in the
        // default environment dictionary.
        for (let propName in usedEnvVars) {
            if (BUILTIN_ENVVARS.hasOwnProperty(propName))
                continue;
            if (!defaultEnv.hasOwnProperty(propName)) {
                info('Picked up new env var ' + propName);
                defaultEnv[propName] = {
                    encrypted: false,
                    value: 'new property\nedit value'
                };
            }
        }
    }

    if (kickstarter.envs.length > 1) {
        // Propagate env vars from override files back to default env. If you haven't
        // manually edited the env files, this should never happen, but we do it in
        // case somebody has done just that.
        for (let envName in envDict) {
            if (envName == 'default')
                continue;
            let env = envDict[envName];
            for (let propName in env) {
                if (!defaultEnv[propName])
                    defaultEnv[propName] = utils.jsonClone(env[propName]);
            }
        }
        // Propagate default env vars back to all other envs and mark those
        // which come from "default" as inherited.
        for (let envName in envDict) {
            if (envName == 'default')
                continue;
            let env = envDict[envName];
            for (let propName in defaultEnv) {
                if (!env[propName]) {
                    env[propName] = utils.jsonClone(defaultEnv[propName]);
                    env[propName].inherited = true;
                }
            }
        }
    }

    // Now sort all the names; I know, this is actually not really defined,
    // but it works anyhow. Node.js handles the properties in the order they
    // were inserted.
    const propNames = [];
    for (let propName in defaultEnv)
        propNames.push(propName);
    propNames.sort();
    const tempDict = {};

    // Reinsert all the properties for all envs in the right order.
    for (let envName in envDict) {
        tempDict[envName] = {};
        for (let i = 0; i < propNames.length; ++i) {
            let propName = propNames[i];
            tempDict[envName][propName] = envDict[envName][propName];
        }
    }
    return tempDict;
};

function decryptEnvDict(app, envDict) {
    for (let envName in envDict) {
        const env = envDict[envName];
        for (let propName in env) {
            const prop = env[propName];
            if (prop.encrypted)
                prop.value = envReader.Crypt.apiDecrypt(getConfigKey(app), prop.value);
        }
    }
}

utils.saveEnvDict = function (app, envDict, envName) {
    const env = envDict[envName];
    cleanupEnv(env);
    encryptEnv(app, env);
    const envFileName = path.join(getConfigDir(app), 'env', envName + '.json');
    fs.writeFileSync(envFileName, JSON.stringify(env, null, 2), 'utf8');
};

function cleanupEnv(env) {
    // Clean up inherited values
    for (let propName in env) {
        const prop = env[propName];
        if (prop && prop.inherited)
            delete env[propName];
    }
}

function encryptEnv(app, env) {
    for (let propName in env) {
        const prop = env[propName];
        if (prop.encrypted)
            prop.value = envReader.Crypt.apiEncrypt(getConfigKey(app), prop.value);
    }
}

utils.deleteEnv = function (app, envId) {
    const envFileName = path.join(getConfigDir(app), 'env', envId + '.json');
    if (fs.existsSync(envFileName))
        fs.unlinkSync(envFileName);
};

utils.createEnv = function (app, newEnvId) {
    let envFileName = path.join(getConfigDir(app), 'env', newEnvId + '.json');
    let envDict = {};
    if (newEnvId === "localhost") {
        envDict = {
            PORTAL_CONFIG_BASE: { value: '/override/this/' },
            PORTAL_API_URL: { value: 'http://${LOCAL_IP}:3001' },
            PORTAL_CHATBOT_URL: { value: 'http://${LOCAL_IP}:3004' },
            PORTAL_KONG_ADAPTER_URL: { value: 'http://${LOCAL_IP}:3002' },
            PORTAL_KONG_ADMIN_URL: { value: 'http://${LOCAL_IP}:8001' },
            PORTAL_MAILER_URL: { value: 'http://${LOCAL_IP}:3003' },
            PORTAL_NETWORK_APIHOST: { value: '${LOCAL_IP}:8000' },
            PORTAL_NETWORK_PORTALHOST: { value: '${LOCAL_IP}:3000' },
            PORTAL_NETWORK_SCHEMA: { value: 'http' },
            PORTAL_PORTAL_URL: { value: 'http://${LOCAL_IP}:3000' },
            PORTAL_SESSIONSTORE_TYPE: { type: 'file' },
            PORTAL_AUTHSERVER_URL: { value: 'http://${LOCAL_IP}:3010' },
            PORTAL_KONG_OAUTH2_URL: { value: 'http://${LOCAL_IP}:3006' },
            PORTAL_STORAGE_PGHOST: { value: '${LOCAL_IP}' }
        };
    }
    fs.writeFileSync(envFileName, JSON.stringify(envDict, null, 2), 'utf8');
};

/*
function writeEnvFile(envFileName, envVars) {
    const envString = '';
    for (let name in envVars) {
        envString += name + "=$'";
        envString += escape(envVars[name]) + "'\n";
    }
    fs.writeFileSync(envFileName, envString, 'utf8');
}
*/

function escape(s) {
    if (!s)
        return '';
    return s.replace(/[\\'"]/g, "\\$&").replace(/\r/g, '').replace(/\n/g, '\\n');
}

function unescape(s) {
    if (!s)
        return '';
    return s.replace(/\\n/g, '\r\n').replace(/\\[\\'"]/g, '$&');
}

function getPlansFileName(app) {
    const configDir = getConfigDir(app);
    const plansDir = path.join(configDir, 'plans');
    const plansFile = path.join(plansDir, 'plans.json');
    return plansFile;
}

utils.loadPlans = function (app) {
    return JSON.parse(fs.readFileSync(getPlansFileName(app)));
};

utils.savePlans = function (app, plans) {
    fs.writeFileSync(getPlansFileName(app), JSON.stringify(plans, null, 2), 'utf8');
};

function getGroupsFileName(app) {
    const configDir = getConfigDir(app);
    const groupsDir = path.join(configDir, 'groups');
    const groupsFile = path.join(groupsDir, 'groups.json');
    return groupsFile;
}

utils.loadGroups = function (app) {
    return JSON.parse(fs.readFileSync(getGroupsFileName(app), 'utf8'));
};

utils.saveGroups = function (app, groups) {
    fs.writeFileSync(getGroupsFileName(app), JSON.stringify(groups, null, 2), 'utf8');
};

function getApisFileName(app) {
    const configDir = getConfigDir(app);
    const apisDir = path.join(configDir, 'apis');
    const apisFileName = path.join(apisDir, 'apis.json');
    return apisFileName;
}

utils.loadApis = function (app) {
    const apis = JSON.parse(fs.readFileSync(getApisFileName(app), 'utf8'));
    const authServers = utils.getAuthServers(app);
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        // Fubble some defaults.
        if (!thisApi.settings) {
            thisApi.settings = {
                token_expiration: 3600,
                scopes: '',
                mandatory_scope: false
            };
        }
    }
    return apis;
};

utils.saveApis = function (app, apis) {
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        if (thisApi.auth == 'key-auth') {
            if (thisApi.hasOwnProperty('settings'))
                delete thisApi.settings;
            if (thisApi.hasOwnProperty('authServers'))
                delete thisApi.authServer;
        }

    }
    fs.writeFileSync(getApisFileName(app), JSON.stringify(apis, null, 2), 'utf8');
};

function getApiDir(app, apiId) {
    const configDir = getConfigDir(app);
    const apisDir = path.join(configDir, 'apis');
    const apiDir = path.join(apisDir, apiId);
    return apiDir;
}

utils.prepareNewApi = function (app, apiId) {
    const apiDir = getApiDir(app, apiId);
    if (!fs.existsSync(apiDir))
        fs.mkdirSync(apiDir);
    else {
        error("utils.prepareNewApi: API already exists.");
        return;
    }
    const apiConfig = {
        api: {
            upstream_url: "http://your.new.api/",
            name: apiId,
            routes: [
                {
                    paths: [
                        "/" + apiId
                    ],
                    strip_path: true,
                    preserve_host: false
                }
            ]
        },
        plugins: []
    };
    const apiSwagger = {
        swagger: "2.0",
        info: {
            title: apiId,
            version: "1.0.0"
        },
        paths: {
            "/newapi": {
                get: {
                    responses: {
                        "200": {
                            description: "Success"
                        }
                    }
                }
            }
        }
    };
    utils.saveApiConfig(app, apiId, apiConfig);
    utils.saveSwagger(app, apiId, apiSwagger);
    utils.saveApiDesc(app, apiId, 'Your **new** API. Describe it here.');
};

utils.removeApiDir = function (app, apiId) {
    const apiDir = getApiDir(app, apiId);
    if (!fs.existsSync(apiDir))
        return; // ?
    const configFile = path.join(apiDir, 'config.json');
    const swaggerFile = path.join(apiDir, 'swagger.json');
    const descFile = path.join(apiDir, 'desc.md');

    if (fs.existsSync(configFile))
        fs.unlinkSync(configFile);
    if (fs.existsSync(swaggerFile))
        fs.unlinkSync(swaggerFile);
    if (fs.existsSync(descFile))
        fs.unlinkSync(descFile);
    fs.rmdirSync(apiDir);
};

function getSwaggerFileName(app, apiId) {
    const apiDir = getApiDir(app, apiId);
    const swaggerFileName = path.join(apiDir, 'swagger.json');
    return swaggerFileName;
}

utils.existsSwagger = function (app, apiId) {
    const swaggerFileName = getSwaggerFileName(app, apiId);
    return fs.existsSync(swaggerFileName);
};

utils.loadSwagger = function (app, apiId) {
    debug('apiId: ' + apiId);
    // Hmmm... what if this thing is not valid JSON?
    return JSON.parse(fs.readFileSync(getSwaggerFileName(app, apiId), 'utf8'));
};

utils.saveSwagger = function (app, apiId, swagger) {
    if (typeof swagger == 'string')
        fs.writeFileSync(getSwaggerFileName(app, apiId), swagger, 'utf8');
    else
        fs.writeFileSync(getSwaggerFileName(app, apiId), JSON.stringify(swagger, null, 2), 'utf8');
};

utils.loadApiDesc = function (app, apiId) {
    const apiDir = getApiDir(app, apiId);
    const apiDescFile = path.join(apiDir, 'desc.md');
    if (!fs.existsSync(apiDescFile))
        return '';
    return fs.readFileSync(apiDescFile, 'utf8');
};

utils.saveApiDesc = function (app, apiId, markdown) {
    const apiDir = getApiDir(app, apiId);
    const apiDescFile = path.join(apiDir, 'desc.md');
    fs.writeFileSync(apiDescFile, markdown, 'utf8');
};

utils.loadApiConfig = function (app, apiId) {
    const apiDir = getApiDir(app, apiId);
    const configFileName = path.join(apiDir, 'config.json');
    return JSON.parse(fs.readFileSync(configFileName, 'utf8'));
};

utils.saveApiConfig = function (app, apiId, config) {
    const apiDir = getApiDir(app, apiId);
    const configFileName = path.join(apiDir, 'config.json');
    fs.writeFileSync(configFileName, JSON.stringify(config, null, 2), 'utf8');
};

function getContentDir(app) {
    const configDir = getConfigDir(app);
    return path.join(configDir, 'content');
}

function getCssFileName(app) {
    const contentDir = getContentDir(app);
    return path.join(contentDir, 'wicked.css');
}

utils.loadCss = function (app) {
    return fs.readFileSync(getCssFileName(app), 'utf8');
};

utils.saveCss = function (app, css) {
    fs.writeFileSync(getCssFileName(app), css, 'utf8');
};

utils.isPublic = function (uriName) {
    return uriName.endsWith('jpg') ||
        uriName.endsWith('jpeg') ||
        uriName.endsWith('png') ||
        uriName.endsWith('gif') ||
        uriName.endsWith('css');
};

utils.isContent = function (uriName) {
    return uriName.endsWith('.md') ||
        uriName.endsWith('.jade');
};

utils.getContentType = function (uriName) {
    if (uriName.endsWith('jpg') ||
        uriName.endsWith('jpeg'))
        return "image/jpeg";
    if (uriName.endsWith('png'))
        return "image/png";
    if (uriName.endsWith('gif'))
        return "image/gif";
    if (uriName.endsWith('css'))
        return "text/css";
    return "text/markdown";
};

utils.getContentFileName = function (app, pathUri) {
    const contentDir = getContentDir(app);
    if (pathUri.startsWith('/content/'))
        pathUri = pathUri.substring(9);
    return path.join(contentDir, pathUri);
};

utils.getContentIndexFileName = function (app) {
    const configDir = getConfigDir(app);
    return path.join(configDir, 'index');
};

function getContentItem(file, fileName, fullPath, pathUri) {
    if (file.endsWith('.md')) {
        let pathUriTemp = pathUri.substring(0, pathUri.length - 3); // cut .md
        return {
            path: pathUriTemp,
            localPath: fullPath,
            type: 'markdown'
        };
    } else if (file.endsWith('.jade')) {
        let pathUriTemp = pathUri.substring(0, pathUri.length - 5); // cut .jade
        return {
            path: pathUriTemp,
            localPath: fullPath,
            type: 'jade'
        };
    }
    throw Error("wtf?");
}

function getContentFileNamesRecursive(app, baseDir, dir, pathUris, publicUris) {
    let forDir = baseDir;
    if (dir)
        forDir = path.join(forDir, dir);
    const fileNames = fs.readdirSync(forDir).sort();

    //console.log(fileNames);

    // Files first
    const dirNames = [];
    for (let i = 0; i < fileNames.length; ++i) {
        const file = path.join(forDir, fileNames[i]);
        const fullPath = path.resolve(baseDir, file);
        const stat = fs.statSync(file);
        if (stat.isDirectory())
            dirNames.push(fileNames[i]);
        if (stat.isFile()) {
            const pathUriTemp = dir + '/' + fileNames[i];
            if (utils.isContent(file)) {
                pathUris.push(getContentItem(file, fileNames[i], fullPath, pathUriTemp));
            } else if (utils.isPublic(file)) {
                publicUris.push(dir + '/' + fileNames[i]);
            }
        }
    }
    for (let i = 0; i < dirNames.length; ++i) {
        let subDir = '/' + dirNames[i];
        if (dir)
            subDir = dir + subDir;
        getContentFileNamesRecursive(app, baseDir, subDir, pathUris, publicUris);
    }
}

utils.getContentFileNames = function (app) {
    const pathUris = [];
    const publicUris = [];
    const contentDir = getContentDir(app);
    getContentFileNamesRecursive(app, contentDir, '', pathUris, publicUris);
    return {
        pathUris: pathUris,
        publicUris: publicUris
    };
};

utils.createNewContent = function (app, newContent, contentType, callback) {
    const contentDir = getContentDir(app);
    let currentDir = contentDir;
    const fileParts = newContent.split('/');
    for (let i = 0; i < fileParts.length - 1; ++i) {
        currentDir = path.join(currentDir, fileParts[i]);
        fs.mkdirSync(currentDir);
    }
    const fileBase = path.join(currentDir, fileParts[fileParts.length - 1]);
    let contentFile;
    if (contentType == 'markdown')
        contentFile = fileBase + '.md';
    else // jade
        contentFile = fileBase + '.jade';
    const jsonFile = fileBase + '.json';

    if (fs.existsSync(contentFile))
        return callback(utils.makeError(409, 'Conrtent file ' + contentFile + ' already exists.'));
    if (fs.existsSync(jsonFile))
        return callback(utils.makeError(409, 'JSON config file ' + jsonFile + ' already exists.'));

    if (contentType == 'markdown')
        fs.writeFileSync(contentFile, '# Markdown Content', 'utf8');
    else
        fs.writeFileSync(contentFile, 'h1 Jade Content\r\n\r\np This is a paragraph.', 'utf8');
    const jsonConfig = {
        title: 'New Content',
        subTitle: 'Edit the file with whatever editor you like, then change the settings using the Preview here.',
        showTitle: true,
        omitContainer: false
    };
    fs.writeFileSync(jsonFile, JSON.stringify(jsonConfig, null, 2), 'utf8');

    callback();
};

utils.getInitialConfigDir = function () {
    const appDir = path.join(__dirname, '..', 'node_modules', 'portal-env');
    return path.join(appDir, 'initial-config');
};

utils.getInitialStaticConfigDir = function () {
    return path.join(utils.getInitialConfigDir(), 'static');
};

function getTemplatesDir(app) {
    const configDir = getConfigDir(app);
    const templatesDir = path.join(configDir, 'templates');
    return templatesDir;
}

function getChatbotTemplatesFile(app) {
    return path.join(getTemplatesDir(app), 'chatbot.json');
}

utils.loadChatbotTemplates = function (app) {
    return JSON.parse(fs.readFileSync(getChatbotTemplatesFile(app), 'utf8'));
};

utils.saveChatbotTemplates = function (app, templates) {
    fs.writeFileSync(getChatbotTemplatesFile(app), JSON.stringify(templates, null, 2), 'utf8');
};

utils.loadEmailTemplate = function (app, templateId) {
    const templatesDir = getTemplatesDir(app);
    const fileName = path.join(templatesDir, 'email', templateId + '.mustache');
    if (!fs.existsSync(fileName)) {
        const err = new Error('File not found: ' + fileName);
        err.status = 404;
        throw err;
    }
    return fs.readFileSync(fileName, 'utf8');
};

utils.saveEmailTemplate = function (app, templateId, templateText) {
    const templatesDir = getTemplatesDir(app);
    const fileName = path.join(templatesDir, 'email', templateId + '.mustache');
    fs.writeFileSync(fileName, templateText, 'utf8');
};

utils.loadKickstarter = function (app) {
    const configDir = getConfigDir(app);
    const kickstarter = JSON.parse(fs.readFileSync(path.join(configDir, 'kickstarter.json'), 'utf8'));
    if (!kickstarter.hasOwnProperty("env"))
        kickstarter.env = 2;
    return kickstarter;
};

utils.saveKickstarter = function (app, kickstarter) {
    const configDir = getConfigDir(app);
    fs.writeFileSync(path.join(configDir, 'kickstarter.json'), JSON.stringify(kickstarter, null, 2), 'utf8');
};

// === DEPLOY / DOCKER

utils.readDockerComposeTemplate = function (app) {
    return fs.readFileSync(path.join(getResDir(), 'docker-compose.yml.template'), 'utf8');
};

utils.readDockerComposeFile = function (app) {
    const baseDir = getBaseDir(app);
    const composeFile = path.join(baseDir, 'docker-compose.yml');
    if (fs.existsSync(composeFile)) {
        return fs.readFileSync(composeFile, 'utf8');
    }
    return null;
};

utils.writeDockerComposeFile = function (app, composeFileContent) {
    const baseDir = getBaseDir(app);
    const composeFile = path.join(baseDir, 'docker-compose.yml');
    fs.writeFileSync(composeFile, composeFileContent, 'utf8');
};

utils.deleteDockerComposeFile = function (app) {
    const baseDir = getBaseDir(app);
    const composeFile = path.join(baseDir, 'docker-compose.yml');
    if (fs.existsSync(composeFile))
        fs.unlinkSync(composeFile);
};

utils.readDockerfileTemplate = function (app) {
    return fs.readFileSync(path.join(getResDir(), 'Dockerfile.template'), 'utf8');
};

utils.readDockerfile = function (app) {
    const configDir = getConfigDir(app);
    const dockerFile = path.join(configDir, 'Dockerfile');
    if (fs.existsSync(dockerFile)) {
        return fs.readFileSync(dockerFile, 'utf8');
    }
    return null;
};

utils.writeDockerfile = function (app, dockerFileContent) {
    const configDir = getConfigDir(app);
    const dockerFile = path.join(configDir, 'Dockerfile');
    fs.writeFileSync(dockerFile, dockerFileContent, 'utf8');
};

utils.deleteDockerFile = function (app) {
    const configDir = getConfigDir(app);
    const dockerFile = path.join(configDir, 'Dockerfile');
    if (fs.existsSync(dockerFile))
        fs.unlinkSync(dockerFile);
};

// ==== SSL / CERTIFICATES

function getCertsDir(app) {
    const baseDir = getBaseDir(app);
    const certsDir = path.join(baseDir, 'certs');
    return certsDir;
}

utils.hasCertsFolder = function (app) {
    return fs.existsSync(getCertsDir(app));
};

utils.createCerts = function (app, validDays) {
    const certsDir = getCertsDir(app);
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir);
    }
    const glob = utils.loadGlobals(app);
    const kick = utils.loadKickstarter(app);

    if (!kick.envs)
        throw 'kickstarter.json does not have an envs property.';
    let envDict = utils.loadEnvDict(app);
    for (let env in kick.envs) {
        let envName = kick.envs[env];
        if (envName === 'localhost') // Don't do it for localhost
            continue;
        utils.createCert(app, glob, envDict, certsDir, envName, validDays);
    }
};

utils.createCert = function (app, glob, envDict, certsDir, envName, validDays) {
    const envDir = path.join(certsDir, envName);
    if (!fs.existsSync(envDir))
        fs.mkdirSync(envDir);
    let portalHost = utils.resolveByEnv(envDict, envName, glob.network.portalHost.trim());
    let apiHost = utils.resolveByEnv(envDict, envName, glob.network.apiHost.trim());
    let portalHostVarName = utils.resolveEnvVarName(glob.network.portalHost.trim(), 'PORTAL_NETWORK_PORTALHOST');
    let apiHostVarName = utils.resolveEnvVarName(glob.network.apiHost.trim(), 'PORTAL_NETWORK_APIHOST');

    let shTemplate = fs.readFileSync(path.join(getResDir(), 'env.sh.template'), 'utf8');
    let shContent = mustache.render(shTemplate, {
        envName: envName,
        portalHostVarName: portalHostVarName,
        portalHost: portalHost,
        apiHostVarName: apiHostVarName,
        apiHost: apiHost,
        portalConfigKey: getConfigKey(app)
    });
    let shFileName = path.join(certsDir, envName + '.sh');
    fs.writeFileSync(shFileName, shContent, 'utf8');
    fs.chmodSync(shFileName, '755');

    let openSslPortal = 'openssl req -x509 -nodes -days ' + validDays +
        ' -newkey rsa:2048 -keyout ' + envName + '/portal-key.pem' +
        ' -out ' + envName + '/portal-cert.pem' +
        ' -subj "/CN=' + portalHost + '"';
    let openSslApi = 'openssl req -x509 -nodes -days ' + validDays +
        ' -newkey rsa:2048 -keyout ' + envName + '/gateway-key.pem' +
        ' -out ' + envName + '/gateway-cert.pem' +
        ' -subj "/CN=' + apiHost + '"';

    let portalLogFile = path.join(certsDir, envName, 'portal-openssl.txt');
    let apiLogFile = path.join(certsDir, envName, 'gateway-openssl.txt');

    fs.writeFileSync(portalLogFile, openSslPortal, 'utf8');
    fs.writeFileSync(apiLogFile, openSslApi, 'utf8');

    let execOptions = {
        cwd: certsDir
    };

    execSync(openSslPortal, execOptions);
    execSync(openSslApi, execOptions);
};

utils.resolveEnvVarName = function (hostName, defaultName) {
    let envVarName;
    if (hostName.startsWith('${'))
        envVarName = hostName.substring(2, hostName.length - 1);
    else if (hostName.startsWith('$'))
        envVarName = hostName.substring(1);
    else
        return defaultName;
    return envVarName;
};

utils.resolveByEnv = function (envDict, envName, varValue) {
    if (!varValue.startsWith('$'))
        return varValue; // No env var here.
    let envVarName = utils.resolveEnvVarName(varValue);
    if (!envDict[envName])
        throw 'Unknown environment name: ' + envName;
    if (!envDict[envName][envVarName])
        throw 'Unknown env var used for host: ' + envVarName;
    return envDict[envName][envVarName].value;
};

function getAuthServerDir(app) {
    const configDir = getConfigDir(app);
    const authServerDir = path.join(configDir, 'auth-servers');
    if (!fs.existsSync(authServerDir))
        fs.mkdirSync(authServerDir);
    return authServerDir;
}

function isValidServerName(serverName) {
    return /^[a-z\-\_0-9]+$/.test(serverName);
}

utils.getAuthServers = function (app) {
    const authServerDir = getAuthServerDir(app);
    const fileNames = fs.readdirSync(authServerDir);
    const authServerNames = [];
    for (let i = 0; i < fileNames.length; ++i) {
        const fileName = fileNames[i];
        if (fileName.endsWith('.json')) {
            const strippedName = fileName.substring(0, fileName.length - 5);
            if (isValidServerName(strippedName))
                authServerNames.push(strippedName); // strip .json
        }
    }
    return authServerNames;
};

utils.loadAuthServer = function (app, serverName) {
    if (!isValidServerName(serverName))
        throw new Error('Server name ' + serverName + ' is not a valid auth server name (a-z, 0-9, -, _).');
    const authServerDir = getAuthServerDir(app);
    const fileName = path.join(authServerDir, serverName + '.json');
    if (!fs.existsSync(fileName))
        throw new Error('File not found: ' + fileName);
    return JSON.parse(fs.readFileSync(fileName, 'utf8'));
};

utils.saveAuthServer = function (app, serverName, serverInfo) {
    const authServerDir = getAuthServerDir(app);
    const fileName = path.join(authServerDir, serverName + '.json');
    fs.writeFileSync(fileName, JSON.stringify(serverInfo, null, 2), 'utf8');
};

utils.createAuthServer = function (app, serverName) {
    if (!isValidServerName(serverName))
        throw new Error('Server names must only contain a-z (lowercase), 0-9, - and _.');
    const authServerDir = getAuthServerDir(app);
    const fileName = path.join(authServerDir, serverName + '.json');
    if (fs.existsSync(fileName))
        throw new Error('File ' + fileName + ' already exists.');
    const serverInfo = {
        id: serverName,
        name: serverName,
        desc: 'Description of Authorization Server ' + serverName,
        url: "https://${PORTAL_NETWORK_APIHOST}/auth-server/{{apiId}}?client_id=(your app's client id)",
        config: {
            api: {
                name: serverName,
                upstream_url: 'http://auth-server:3005',
                routes: [
                    {
                        paths: [
                            '/auth-server'
                        ],
                        preserve_host: false,
                        strip_path: false,
                    }
                ]
            },
            plugins: [
                {
                    name: 'correlation-id',
                    config: {
                        header_name: 'Correlation-Id',
                        generator: 'uuid',
                        echo_downstream: false
                    }
                }
            ]
        },
    };
    utils.saveAuthServer(app, serverName, serverInfo);
};

function getPoolsDir(app) {
    const configDir = getConfigDir(app);
    const poolsDir = path.join(configDir, 'pools');
    if (!fs.existsSync(poolsDir))
        fs.mkdirSync(poolsDir);
    return poolsDir;
}

utils.loadPools = function (app) {
    const poolsDir = getPoolsDir(app);
    const poolFiles = fs.readdirSync(poolsDir);
    const pools = {};
    for (let i = 0; i < poolFiles.length; ++i) {
        const poolFile = poolFiles[i];
        if (!poolFile.endsWith('.json'))
            continue;
        const poolName = poolFile.substring(0, poolFile.length - 5).toLowerCase(); // strip .json
        const pool = JSON.parse(fs.readFileSync(path.join(poolsDir, poolFile), 'utf8'));
        pools[poolName] = pool;
    }
    return pools;
};

utils.savePools = function (app, pools) {
    const poolsDir = getPoolsDir(app);
    // First delete all .json files...
    const poolFiles = fs.readdirSync(poolsDir);
    for (let i = 0; i < poolFiles.length; ++i) {
        const poolFile = poolFiles[i];
        if (!poolFile.endsWith('.json'))
            continue;
        fs.unlinkSync(path.join(poolsDir, poolFile));
    }
    // Then write them.
    for (let poolName in pools) {
        const poolFile = poolName.toLowerCase() + '.json';
        fs.writeFileSync(path.join(poolsDir, poolFile), JSON.stringify(pools[poolName], null, 2), 'utf8');
    }
};

utils.makeSafeId = function (unsafeId) {
    return unsafeId.replace(/\-/g, '');
};

utils._packageVersion = null;
utils.getVersion = function () {
    if (!utils._packageVersion) {
        const packageFile = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packageFile)) {
            try {
                const packageInfo = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (packageInfo.version)
                    utils._packageVersion = packageInfo.version;
            } catch (ex) {
                error('Could not read package.json!');
                error(ex);
            }
        }
        if (!utils._packageVersion) // something went wrong
            utils._packageVersion = "0.0.0";
    }
    return utils._packageVersion;
};

module.exports = utils;
