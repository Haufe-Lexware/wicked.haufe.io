'use strict';

/* global __dirname */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt-nodejs');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:utils');

const utils = function () { };

utils._app = null;
utils.init = (app) => {
    debug('init()');
    utils._app = app;
};

function getApp() { return utils._app; }

utils.getApp = function () { return getApp(); };

utils.getStaticDir = function () {
    return getApp().get('static_config');
};

utils.getInitialConfigDir = function () {
    const appDir = path.join(__dirname, '..');
    const rootDir = path.join(appDir, 'node_modules');
    const envDir = path.join(rootDir, 'portal-env');
    return path.join(envDir, 'initial-config');
};

utils._migrationMode = false;
utils._migrationConfig = null;
utils.setMigrationMode = function (value, config) {
    debug(`setMigrationMode(${value})`);
    utils._migrationMode = value;
    utils._migrationConfig = config;
};

utils.isMigrationMode = function () {
    return utils._migrationMode;
};

utils.getMigrationConfig = function () {
    return utils._migrationConfig;
};

utils.createRandomId = function () {
    return crypto.randomBytes(20).toString('hex');
};

utils.makePasswordHash = function (password) {
    return bcrypt.hashSync(password);
};

utils.getUtc = function () {
    return Math.floor((new Date()).getTime() / 1000);
};

utils.getJson = function (ob) {
    if (ob instanceof String || typeof ob === "string") {
        const obTrim = ob.trim();
        if (obTrim.startsWith('{') || obTrim.startsWith('[')) {
            return JSON.parse(obTrim);
        }
        return { warning: 'Expected JSON, received a plain string?', message: obTrim };
    }
    return ob;
};

utils.getText = function (ob) {
    if (ob instanceof String || typeof ob === "string") {
        return ob;
    }
    return JSON.stringify(ob, null, 2);
};

utils.fail = function (res, statusCode, message, err) {
    if (err) {
        error(err);
        const status = err.status || statusCode || 500;
        res.status(status).json({ status: status, message: message, error: err.message });
    } else {
        res.status(statusCode).json({ status: statusCode, message: message });
    }
};

utils.failError = function (res, err) {
    if (err.stack) {
        error(err.stack);
    }
    return utils.fail(res, err.status || 500, err.message);
};

utils.makeError = (statusCode, message) => {
    const err = new Error(message);
    err.status = statusCode;
    return err;
};

let _groups = null;
utils.loadGroups = function () {
    debug('loadGroups()');
    if (utils.isMigrationMode()) {
        throw new Error('You must not call loadGroups() in migration mode.');
    }
    if (!_groups) {
        const groupsDir = path.join(utils.getStaticDir(), 'groups');
        const groupsFile = path.join(groupsDir, 'groups.json');
        _groups = require(groupsFile);
        utils.replaceEnvVars(_groups);
    }
    return _groups;
};

let _apis = null;
utils.loadApis = function () {
    debug('loadApis()');
    if (utils.isMigrationMode()) {
        throw new Error('You must not call loadApis() in migration mode.');
    }
    if (!_apis) {
        const apisDir = path.join(utils.getStaticDir(), 'apis');
        const apisFile = path.join(apisDir, 'apis.json');
        _apis = require(apisFile);
        const internalApisFile = path.join(__dirname, 'internal_apis', 'apis.json');
        const internalApis = require(internalApisFile);
        injectRequiredGroups(internalApis);
        injectAuthMethods(internalApis);
        _apis.apis.push.apply(_apis.apis, internalApis.apis);
        utils.replaceEnvVars(_apis);
    }
    return _apis;
};

utils.getApi = function (apiId) {
    debug(`getApi(${apiId})`);
    const apiList = utils.loadApis();
    const apiIndex = apiList.apis.findIndex(a => a.id === apiId);
    if (apiIndex < 0) {
        throw utils.makeError(404, `API ${apiId} is unknown`);
    }
    return apiList.apis[apiIndex];
};

let _poolsMap = null;
utils.getPools = function () {
    debug(`getPools()`);
    if (utils.isMigrationMode()) {
        throw new Error('You must not call getPools() in migration mode.');
    }
    if (!_poolsMap) {
        _poolsMap = {};
        // Load all the pools
        const poolsDir = path.join(utils.getStaticDir(), 'pools');
        const poolFiles = fs.readdirSync(poolsDir);
        for (let i = 0; i < poolFiles.length; ++i) {
            const file = poolFiles[i];
            if (!file.endsWith('.json')) {
                warn(`getPools: Found non-JSON file in pools directory: ${file} (ignoring)`);
                continue;
            }
            const poolFile = path.join(poolsDir, file);
            const poolId = file.substring(0, file.length - 5); // Cut off .json
            const poolInfo = JSON.parse(fs.readFileSync(poolFile, 'utf8'));
            debug(poolInfo);

            if (!poolInfo.properties || !Array.isArray(poolInfo.properties)) {
                throw new Error(`Pool info for pool ${poolId} contains an invalid "properties" property; MUST be an array.`);
            }

            _poolsMap[poolId] = poolInfo;
        }
    }
    return _poolsMap;
};

utils.getPool = function (poolId) {
    debug(`getPool(${poolId})`);
    const pools = utils.getPools();
    if (!utils.isPoolIdValid(poolId)) {
        throw utils.makeError(400, utils.validationErrorMessage('Pool ID'));
    }
    if (!utils.hasPool(poolId)) {
        throw utils.makeError(404, `The registration pool ${poolId} is not defined.`);
    }
    return pools[poolId];
};

utils.hasPool = function (poolId) {
    debug(`hasPool(${poolId})`);
    const pools = utils.getPools();
    return (pools.hasOwnProperty(poolId));
};

const validationRegex = /^[a-z0-9_-]+$/;
utils.isNamespaceValid = (namespace) => {
    // Empty or null namespaces are valid
    if (!namespace) {
        return true;
    }
    if (validationRegex.test(namespace)) {
        return true;
    }
    return false;
};

utils.isPoolIdValid = (poolId) => {
    if (!poolId) {
        return false;
    }
    if (validationRegex.test(poolId)) {
        return true;
    }
    return false;
};

utils.validationErrorMessage = (entity) => {
    return `Registrations: ${entity} is invalid, must contain a-z, 0-9, _ and - only.`;
};

const applicationRegex = /^[a-z0-9\-_]+$/;
utils.isValidApplicationId = (appId) => {
    if (!applicationRegex.test(appId)) {
        return false;
    }
    return true;
};

utils.invalidApplicationIdMessage = () => {
    return 'Invalid application ID, allowed chars are: a-z, 0-9, - and _';
};

function injectRequiredGroups(apis) {
    debug('injectRequiredGroups()');
    const globals = utils.loadGlobals();
    if (!globals.api) {
        warn('injectRequiredGroups: globals.json does not contain an "api" property.');
        return;
    }
    const portalApi = apis.apis.find(api => api.id === 'portal-api');
    if (!portalApi) {
        throw utils.makeError(500, 'injectAuthMethods: Internal API portal-api not found in internal APIs list');
    }
    portalApi.requiredGroup = globals.api.apiUserGroup;
    const echoApi = apis.apis.find(api => api.id === 'echo');
    if (!echoApi) {
        throw utils.makeError(500, 'injectAuthMethods: Internal API echo not found in internal APIs list');
    }
    echoApi.requiredGroup = globals.api.echoUserGroup;
}

function injectAuthMethods(apis) {
    debug('injectAuthMethods()');
    const globals = utils.loadGlobals();
    if (!globals.portal ||
        !globals.portal.authMethods ||
        !Array.isArray(globals.portal.authMethods)) {
        throw utils.makeError(500, 'injectAuthMethods: globals.json does not contain a portal.authMethods array.');
    }
    const portalApi = apis.apis.find(api => api.id === 'portal-api');
    if (!portalApi) {
        throw utils.makeError(500, 'injectAuthMethods: Internal API portal-api not found in internal APIs list');
    }
    debug('Configuring auth methods for portal-api API:');
    debug(globals.portal.authMethods);
    portalApi.authMethods = utils.clone(globals.portal.authMethods);

    const echoApi = apis.apis.find(api => api.id === 'echo');
    if (!echoApi) {
        throw utils.makeError(500, 'injectAuthMethods: Internal API echo not found in internal APIs list');
    }
    debug('Configuring auth methods for echo API:');
    echoApi.authMethods = utils.clone(globals.portal.authMethods);
}

let _plans = null;
utils.loadPlans = function () {
    debug('loadPlans()');
    if (!_plans) {
        const plansDir = path.join(utils.getStaticDir(), 'plans');
        const plansFile = path.join(plansDir, 'plans.json');
        _plans = require(plansFile);
        const internalPlansFile = path.join(__dirname, 'internal_apis', 'plans.json');
        const internalPlans = require(internalPlansFile);
        _plans.plans.push.apply(_plans.plans, internalPlans.plans);
        utils.replaceEnvVars(_plans);
    }
    return _plans;
};

let _globalSettings = null;
utils.loadGlobals = function () {
    debug('loadGlobals()');
    if (utils.isMigrationMode()) {
        throw new Error('In migration mode, loadGlobals() must not be called.');
    }
    if (!_globalSettings) {
        const globalsFile = path.join(utils.getStaticDir(), 'globals.json');
        _globalSettings = JSON.parse(fs.readFileSync(globalsFile, 'utf8'));
        utils.replaceEnvVars(_globalSettings);
        _globalSettings.configDate = getConfigDate();
        _globalSettings.lastCommit = getLastCommit();
        // Return the used NODE_ENV, this is useful for debugging and error handling
        // when checking the configuration.
        _globalSettings.environment = process.env.NODE_ENV;
    }
    return _globalSettings;
};

let _authServerNames = null;
utils.loadAuthServerNames = function () {
    debug('loadAuthServers()');
    if (!_authServerNames) {
        const staticDir = utils.getStaticDir();
        const authServerDir = path.join(staticDir, 'auth-servers');
        debug('Checking directory ' + authServerDir + ' for auth servers.');
        if (!fs.existsSync(authServerDir)) {
            debug('No auth servers defined.');
            _authServerNames = [];
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
            _authServerNames = serverNames;
        }
    }
    return _authServerNames;
};

const _authServers = {};
utils.loadAuthServer = function (serverId) {
    debug(`loadAuthServer(${serverId})`);

    if (!_authServers[serverId]) {
        const staticDir = utils.getStaticDir();
        const authServerFileName = path.join(staticDir, 'auth-servers', serverId + '.json');

        if (!fs.existsSync(authServerFileName)) {
            debug('Unknown auth-server: ' + serverId);
            _authServers[serverId] = {
                name: serverId,
                exists: false
            };
        } else {
            const data = JSON.parse(fs.readFileSync(authServerFileName, 'utf8'));
            utils.replaceEnvVars(data);
            // Name and id of the Auth Server is used to identify the generated
            // API within the Kong Adapter; if those are missing, add them automatically
            // to the answer.
            if (!data.name) {
                data.name = serverId;
            }
            if (!data.id) {
                data.id = serverId;
            }

            // Check a couple of standard end points for the auth methods
            appendAuthMethodEndpoints(data);

            debug('Found auth server "' + serverId + '"');
            debug(data);
            _authServers[serverId] = {
                name: serverId,
                exists: true,
                data: data
            };
        }
    }
    return _authServers[serverId];
};

let _authServerMap = null;
utils.loadAuthServerMap = function () {
    if (!_authServerMap) {
        _authServerMap = {};
        const serverNames = utils.loadAuthServerNames();
        for (let i = 0; i < serverNames.length; ++i) {
            const authServerName = serverNames[i];
            const as = utils.loadAuthServer(authServerName);
            if (as.exists && as.data) {
                _authServerMap[authServerName] = as.data;
            } else {
                warn(`Could not load auth server with id ${authServerName}`);
            }
        }
    }
    return _authServerMap;
};

function appendAuthMethodEndpoints(authServer) {
    debug('appendAuthMethodEndpoints()');
    if (!authServer.authMethods ||
        !Array.isArray(authServer.authMethods)) {
        warn(`appendAuthMethodEndpoints(${authServer.id}): There are no authMethods defined, or it is not an array.`);
        return;
    }

    const authServerId = authServer.id;
    for (let i = 0; i < authServer.authMethods.length; ++i) {
        const authMethod = authServer.authMethods[i];
        const authMethodId = authMethod.name;

        let config = authMethod.config;
        if (!config) {
            warn(`appendAuthMethodEndpoints(${authServerId}): Auth method ${authMethodId} does not have a config property; creating a default one.`);
            config = {};
            authMethod.config = config;
        }

        checkEndpoint(authServerId, authMethodId, config, 'authorizeEndpoint', '/{{name}}/api/{{api}}/authorize');
        checkEndpoint(authServerId, authMethodId, config, 'tokenEndpoint', '/{{name}}/api/{{api}}/token');
        checkEndpoint(authServerId, authMethodId, config, 'profileEndpoint', '/profile');
        checkEndpoint(authServerId, authMethodId, config, 'verifyEmailEndpoint', '/{{name}}/verifyemail');
        checkEndpoint(authServerId, authMethodId, config, 'grantsEndpoint', '/{{name}}/grants');
    }
}

function checkEndpoint(authServerId, authMethodId, config, endpointName, defaultValue) {
    if (!config.hasOwnProperty(endpointName)) {
        config[endpointName] = defaultValue;
    } else {
        warn(`appendAuthMethodEndpoints(${authServerId}): Auth method ${authMethodId} has a specified ${endpointName} endpoint; consider using the default. Defined: ${config[endpointName]}, default: ${defaultValue}`);
    }
}

function getConfigDate() {
    debug('getConfigDate()');
    const buildDatePath = path.join(utils.getStaticDir(), 'build_date');
    if (!fs.existsSync(buildDatePath)) {
        return "(no config date found)";
    }
    return fs.readFileSync(buildDatePath, 'utf8');
}

function getLastCommit() {
    debug('getLastCommit()');
    const commitPath = path.join(utils.getStaticDir(), 'last_commit');
    if (!fs.existsSync(commitPath)) {
        return "(no last commit found)";
    }
    return fs.readFileSync(commitPath, 'utf8');
}

utils.replaceEnvVars = function (someObject) {
    debug('replaceEnvVars()');
    replaceEnvVarsInternal(someObject);
};

function hasEnvVars(s) {
    return s.startsWith('$') || (s.indexOf('${') >= 0);
}

function replaceEnvVarsInString(s) {
    let tempString = "" + s;
    let foundVar = hasEnvVars(tempString);
    let iterCount = 0;
    while (foundVar) {
        iterCount++;
        if (iterCount > 10) {
            error('Detected recursive use of env variables.');
            error('Original string: ' + s);
            error('Current string : ' + tempString);
            return tempString;
        }
        if (tempString.startsWith('$') &&
            !tempString.startsWith("${")) {
            let envVarName = tempString.substring(1);
            if (process.env[envVarName]) {
                debug('Replacing ' + envVarName + ' with "' + process.env[envVarName] + '" in "' + tempString + '".');
                tempString = process.env[envVarName];
            }
        } else {
            // Inline env var ${...}
            const envRegExp = /\$\{([A-Za-z\_0-9]+)\}/g; // match ${VAR_NAME}
            const match = envRegExp.exec(tempString);
            if (match) {
                let envVarName = match[1]; // Capture group 1
                // Replace regexp with value of env var
                if (process.env[envVarName]) {
                    debug('Replacing ' + envVarName + ' with "' + process.env[envVarName] + '" in "' + tempString + '".');
                    tempString = tempString.replace(match[0], process.env[envVarName]);
                }
            }
        }
        // Possibly recurse
        foundVar = hasEnvVars(tempString);
    }
    return tempString;
}

function replaceEnvVarsInternal(someObject) {
    debug(someObject);
    for (let propName in someObject) {
        const propValue = someObject[propName];
        if (typeof propValue == "string") {
            if (hasEnvVars(propValue)) {
                debug('Detected env var in ' + propName + ': ' + propValue);
                someObject[propName] = replaceEnvVarsInString(propValue);
            }
        } else if (typeof propValue == "object") {
            replaceEnvVarsInternal(propValue);
        }
    }
}

function resolveTemplatesDir() {
    debug('resolveTemplatesDir()');
    let configDir = utils.getStaticDir();
    let templatesDir = path.join(configDir, 'templates');
    debug(' - trying ' + templatesDir);
    let chatbotFile = path.join(templatesDir, 'chatbot.json');
    if (fs.existsSync(chatbotFile)) {
        debug('Templates dir (from config): ' + templatesDir);
        return templatesDir;
    }
    const rootConfigDir = utils.getInitialConfigDir();
    configDir = path.join(rootConfigDir, 'static');
    templatesDir = path.join(configDir, 'templates');
    debug(' - trying ' + templatesDir);
    chatbotFile = path.join(templatesDir, 'chatbot.json');
    if (fs.existsSync(chatbotFile)) {
        debug('Templates dir (from defaults): ' + templatesDir);
        return templatesDir;
    }
    throw new Error('Could not locate templates dir!');
}

utils._chatbotTemplates = null;
utils.loadChatbotTemplates = function () {
    debug('loadChatbotTemplates()');
    if (!utils._chatbotTemplates) {
        const templatesDir = resolveTemplatesDir();
        const chatbotFile = path.join(templatesDir, 'chatbot.json');
        utils._chatbotTemplates = require(chatbotFile);
    }
    return utils._chatbotTemplates;
};

utils.loadEmailTemplate = function (app, templateName) {
    const templatesDir = resolveTemplatesDir();
    const emailTemplatesDir = path.join(templatesDir, 'email');
    const templateFile = path.join(emailTemplatesDir, templateName + '.mustache');
    if (!fs.existsSync(templateFile)) {
        throw new Error('File not found: ' + templateFile);
    }
    return fs.readFileSync(templateFile, 'utf8');
};

// ENCRYPTION/DECRYPTION

const ALGORITHM = 'aes-256-ctr';

function getCipher() {
    const key = getApp().get('aes_key').toString("binary");
    const cipher = crypto.createCipher(ALGORITHM, key);
    return cipher;
}

function getDecipher() {
    const key = getApp().get('aes_key').toString("binary");
    const decipher = crypto.createDecipher(ALGORITHM, key);
    return decipher;
}

utils.apiEncrypt = function (text) {
    if (utils.isMigrationMode()) {
        return text;
    }
    const cipher = getCipher();
    // Add random bytes so that it looks different each time.
    let cipherText = cipher.update(utils.createRandomId() + text, 'utf8', 'hex');
    cipherText += cipher.final('hex');
    cipherText = '!' + cipherText;
    return cipherText;
};

utils.apiDecrypt = function (cipherText) {
    if (utils.isMigrationMode()) {
        return cipherText;
    }
    if (!cipherText.startsWith('!')) {
        return cipherText;
    }
    cipherText = cipherText.substring(1); // Strip '!'
    const decipher = getDecipher();
    let text = decipher.update(cipherText, 'hex', 'utf8');
    text += decipher.final('utf8');
    text = text.substring(40); // Strip random bytes
    return text;
};

utils._packageVersion = null;
utils.getVersion = function () {
    if (!utils._packageVersion) {
        const packageFile = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packageFile)) {
            try {
                const packageInfo = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (packageInfo.version) {
                    utils._packageVersion = packageInfo.version;
                }
            } catch (ex) {
                error(ex);
            }
        }
        if (!utils._packageVersion) {
            // something went wrong
            utils._packageVersion = "0.0.0";
        }
    }
    return utils._packageVersion;
};

utils._gitLastCommit = null;
utils.getGitLastCommit = function () {
    if (!utils._gitLastCommit) {
        const lastCommitFile = path.join(__dirname, '..', 'git_last_commit');
        if (fs.existsSync(lastCommitFile)) {
            utils._gitLastCommit = fs.readFileSync(lastCommitFile, 'utf8');
        } else {
            utils._gitLastCommit = '(no last git commit found - running locally?)';
        }
    }
    return utils._gitLastCommit;
};

utils._gitBranch = null;
utils.getGitBranch = function () {
    if (!utils._gitBranch) {
        const gitBranchFile = path.join(__dirname, '..', 'git_branch');
        if (fs.existsSync(gitBranchFile)) {
            utils._gitBranch = fs.readFileSync(gitBranchFile, 'utf8');
        } else {
            utils._gitBranch = '(unknown)';
        }
    }
    return utils._gitBranch;
};

utils._buildDate = null;
utils.getBuildDate = function () {
    if (!utils._buildDate) {
        const buildDateFile = path.join(__dirname, '..', 'build_date');
        if (fs.existsSync(buildDateFile)) {
            utils._buildDate = fs.readFileSync(buildDateFile, 'utf8');
        } else {
            utils._buildDate = '(unknown build date)';
        }
    }
    return utils._buildDate;
};

utils.getOffsetLimit = (req) => {
    const offset = req.query.offset ? req.query.offset : 0;
    const limit = req.query.limit ? req.query.limit : 0;
    return {
        offset,
        limit
    };
};

utils.getNoCountCache = (req) => {
    const no_cache = req.query.no_cache;
    if (no_cache && (no_cache == '1' || no_cache == 'true')) {
        return true;
    }
    return false;
};

utils.getEmbed = (req) => {
    const embed = req.query.embed;
    if (embed && (embed == '1' || embed == 'true')) {
        return true;
    }
    return false;
};

utils.getFilter = (req) => {
    const filterString = req.query.filter;
    if (filterString && filterString.startsWith("{")) {
        try {
            const filter = JSON.parse(filterString);
            let invalidObject = false;
            for (let p in filter) {
                if (typeof (filter[p]) !== 'string') {
                    invalidObject = true;
                }
            }
            if (invalidObject) {
                warn(`Detected nested/invalid filter object, expected plain string properties: ${filterString}`);
            } else {
                return filter;
            }
        } catch (err) {
            warn(`Invalid filter string used: ${filterString}, expected valid JSON`);
        }
    }
    return {};
};

utils.getOrderBy = (req) => {
    let orderByInput = req.query.order_by;
    let orderBy = null;
    if (orderByInput) {
        const oList = orderByInput.split(' ');
        let invalidInput = false;
        if (oList.length === 2) {
            const field = oList[0];
            const direction = oList[1].toUpperCase();
            if (direction !== 'ASC' && direction !== 'DESC') {
                warn(`Invalid order_by request parameter, direction to be either ASC or DESC: "${orderByInput}"`);
            } else {
                orderBy = `${field} ${direction}`;
            }
        } else {
            warn(`Invalid order_by request parameter, expected '<field> <ASC|DESC>': "${orderByInput}"`);
        }
    }
    return orderBy;
};

utils.concatUrl = (a, b) => {
    if (a.endsWith('/') && b.startsWith('/')) {
        return a + b.substring(1);
    }
    if (a.endsWith('/') && !b.startsWith('/')) {
        return a + b;
    }
    // !a.endsWith('/')
    if (b.startsWith('/')) {
        return a + b;
    }
    return a + '/' + b;
};

// Middleware to verify a scope
utils.verifyScope = (requiredScope) => {
    return function (req, res, next) {
        if (requiredScope) {
            if (!req.scope || (req.scope && !req.scope[requiredScope])) {
                warn(`Rejecting call due to missing scope ${requiredScope}`);
                return res.status(403).json({ code: 403, message: `Forbidden, missing required scope '${requiredScope}'` });
            }
        }
        return next();
    };
};

// Inspection utility:
const REGEX_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
const REGEX_FUNCTION_PARAMS = /(?:\s*(?:function\s*[^(]*)?\s*)((?:[^'"]|(?:(?:(['"])(?:(?:.*?[^\\]\2)|\2))))*?)\s*(?=(?:=>)|{)/m;
const REGEX_PARAMETERS_VALUES = /\s*(\w+)\s*(?:=\s*((?:(?:(['"])(?:\3|(?:.*?[^\\]\3)))((\s*\+\s*)(?:(?:(['"])(?:\6|(?:.*?[^\\]\6)))|(?:[\w$]*)))*)|.*?))?\s*(?:,|$)/gm;

/**
 * Retrieve a function's parameter names and default values
 * Notes:
 *  - parameters with default values will not show up in transpiler code (Babel) because the parameter is removed from the function.
 *  - does NOT support inline arrow functions as default values
 *      to clarify: ( name = "string", add = defaultAddFunction )   - is ok
 *                  ( name = "string", add = ( a )=> a + 1 )        - is NOT ok
 *  - does NOT support default string value that are appended with a non-standard ( word characters or $ ) variable name
 *      to clarify: ( name = "string" + b )         - is ok
 *                  ( name = "string" + $b )        - is ok
 *                  ( name = "string" + b + "!" )   - is ok
 *                  ( name = "string" + λ )         - is NOT ok
 * @param {function} func
 * @returns {Array} - An array of the given function's parameter [key, default value] pairs.
 */
utils.getFunctionParams = (func) => {
    let functionAsString = func.toString();
    let params = [];
    let match;
    functionAsString = functionAsString.replace(REGEX_COMMENTS, '');
    functionAsString = functionAsString.match(REGEX_FUNCTION_PARAMS)[1];
    // Strip method name?
    if (functionAsString.charAt(0) !== '(') {
        functionAsString = functionAsString.substring(functionAsString.indexOf('('));
    }
    if (functionAsString.charAt(0) === '(') {
        functionAsString = functionAsString.slice(1, -1);
    } else {
        debug(`Does not start with "(", look at me: ${functionAsString}`);
    }

    while (match = REGEX_PARAMETERS_VALUES.exec(functionAsString)) params.push([match[1], match[2]]); // eslint-disable-line
    return params;
};

utils.clone = (ob) => {
    return JSON.parse(JSON.stringify(ob));
};

// Normalizes the redirectUri and redirectUris properties.
// As of 1.0.0-rc.2, the redirectUris is the "correct" property to use,
// and redirectUri will only contain the first redirect URI for legacy
// compatibility.
utils.normalizeRedirectUris = (appInfo) => {
    if (!appInfo.redirectUri && !appInfo.redirectUris) {
        appInfo.redirectUris = [];
        return;
    }
    if (!appInfo.redirectUri && appInfo.redirectUris) {
        if (Array.isArray(appInfo.redirectUris)) {
            if (appInfo.redirectUris.length > 0) {
                appInfo.redirectUri = appInfo.redirectUris[0];
                return;
            }
        } else if (typeof (appInfo.redirectUris) === 'string') {
            warn(`Application ${appInfo.id} has invalid redirectUris (string)`);
            appInfo.redirectUri = appInfo.redirectUris;
            appInfo.redirectUris = [appInfo.redirectUris];
            return;
        }
        warn(`Application ${appInfo.id} has invalid redirectUris (${typeof(appInfo.redirectUris)})`);
        return;
    }
    if (appInfo.redirectUri && !appInfo.redirectUris) {
        appInfo.redirectUris = [appInfo.redirectUri];
        return;
    }
    // We have both redirectUris and redirectUri
    if (Array.isArray(appInfo.redirectUris)) {
        if (appInfo.redirectUris.length > 0) {
            appInfo.redirectUri = appInfo.redirectUris[0];
            return;
        }
        // 0-length array
        appInfo.redirectUris = [appInfo.redirectUri];
        return;
    }
    warn(`Application ${appInfo.id} has a non-null redirectUris field of unexpected type: ${typeof(appInfo.redirectUris)}, overriding with redirectUri.`);
    appInfo.redirectUris = [appInfo.redirectUri];
    return;
};

module.exports = utils;
