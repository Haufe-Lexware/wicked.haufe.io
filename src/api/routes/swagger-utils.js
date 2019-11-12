'use strict';

const utils = require('./utils');
const mustache = require('mustache');


const { debug, info, warn, error } = require('portal-env').Logger('portal-api:swagger-utils');

const swaggerUtils = function () { };

swaggerUtils.injectOpenAPIAuth = function (swaggerJson, globalSettings, apiInfo, requestPaths, apiConfig) {
    if (!apiInfo.auth || apiInfo.auth == "key-auth") {
        const apikeyParam = [{ key: [] }];
        const securitySchemesParam = {
            key: {
                type: "apiKey",
                in: "header",
                name: globalSettings.api.headerName
            }
        };
        // Delete all security properties; those are overridden by the global default
        const securityProperties = findSecurityProperties(swaggerJson);
        securityProperties.forEach(sp => sp.length = 0);
        deleteEmptySecurityProperties(swaggerJson);

        // Inject securitySchemes(Swagger 3.0)
        if (!swaggerJson.components) {
            swaggerJson.components = {};
        }
        swaggerJson.components.securitySchemes = securitySchemesParam;
        swaggerJson.security = apikeyParam; // Apply globally
    } else if (apiInfo.auth == "oauth2") {
        // securitySchemesParam is specific for Swagger 3.0
        if (!swaggerJson.components) {
            swaggerJson.components = {};
        }
        // const origSecuritySchemesParam = swaggerJson.components.securitySchemes ? utils.clone(swaggerJson.components.securitySchemes) : {};
        // We will override the security definitions with our own ones
        swaggerJson.components.securitySchemes = {};

        const securityProperties = findSecurityProperties(swaggerJson);
        // const origSecurityProperties = securityProperties ? utils.clone(securityProperties) : [];
        debug(securityProperties);
        // Reset all security properties
        securityProperties.forEach(sp => sp.length = 0);

        for (let i = 0; i < apiInfo.authMethods.length; ++i) {
            const authMethod = lookupAuthMethod(globalSettings, apiInfo.id, apiInfo.authMethods[i]);
            if (!authMethod) {
                continue;
            }
            const flows = [];
            if (apiInfo.settings.enable_authorization_code) {
                flows.push("authorizationCode");
            }
            if (apiInfo.settings.enable_implicit_grant) {
                flows.push("implicit");
            }
            if (apiInfo.settings.enable_password_grant) {
                flows.push("password");
            }
            if (apiInfo.settings.enable_client_credentials) {
                flows.push("clientCredentials");
            }

            for (let j = 0; j < flows.length; ++j) {
                injectOAuth2OpenAPI(swaggerJson, flows[j], authMethod, apiInfo);
                // TODO: Here we must add the scope for each individual security property
            }
        }

        deleteEmptySecurityProperties(swaggerJson);
        debug('Injecting OAuth2');
    }
    // OpenAPI 3 uses "servers" instead of a basePath, host and schema
    const host = apiConfig && apiConfig.api && apiConfig.api.host ? apiConfig.api.host : globalSettings.network.apiHost;

    swaggerJson.servers = [];
    for (let i = 0; i < requestPaths.length; ++i) {
        const p = requestPaths[i];
        swaggerJson.servers.push({
            url: `${globalSettings.network.schema}://${host}${p}`
        });
    }
    return swaggerJson;
};

swaggerUtils.injectSwaggerAuth = function (swaggerJson, globalSettings, apiInfo, requestPaths, apiConfig) {
    // Swagger 2.0 doesn't support multiple paths, pick first
    const requestPath = requestPaths[0];
    if (!apiInfo.auth || apiInfo.auth == "key-auth") {
        const apikeyParam = [{ key: [] }];
        const securityDefinitionParam = {
            key: {
                type: "apiKey",
                in: "header",
                name: globalSettings.api.headerName
            }
        };
        // Delete all security properties; those are overridden by the global default
        const securityProperties = findSecurityProperties(swaggerJson);
        securityProperties.forEach(sp => sp.length = 0);
        deleteEmptySecurityProperties(swaggerJson);

        // Inject securityDefinitions (Swagger 2.0)
        swaggerJson.securityDefinitions = securityDefinitionParam;
        swaggerJson.security = apikeyParam; // Apply globally
    } else if (apiInfo.auth == "oauth2") {
        // securityDefinitions is specific for Swagger 2.0
        // const origSecurityDefinitions = swaggerJson.securityDefinitions ? utils.clone(swaggerJson.securityDefinitions) : {};
        // We will override the security definitions with our own ones
        swaggerJson.securityDefinitions = {};

        const securityProperties = findSecurityProperties(swaggerJson);
        // const origSecurityProperties = utils.clone(securityProperties);
        debug(securityProperties);
        // Reset all security properties
        securityProperties.forEach(sp => sp.length = 0);

        for (let i = 0; i < apiInfo.authMethods.length; ++i) {
            const authMethod = lookupAuthMethod(globalSettings, apiInfo.id, apiInfo.authMethods[i]);
            if (!authMethod) { continue; }
            const flows = [];
            if (apiInfo.settings.enable_authorization_code) {
                flows.push("accessCode");
            }
            if (apiInfo.settings.enable_implicit_grant) {
                flows.push("implicit");
            }
            if (apiInfo.settings.enable_password_grant) {
                flows.push("password");
            }
            if (apiInfo.settings.enable_client_credentials) {
                flows.push("application");
            }

            for (let j = 0; j < flows.length; ++j) {
                injectOAuth2(swaggerJson, flows[j], authMethod, apiInfo);

                // TODO: Here we must add the scope for each individual security property
            }
        }

        deleteEmptySecurityProperties(swaggerJson);
        debug('Injecting OAuth2');
    }
    swaggerJson.host = apiConfig && apiConfig.api && apiConfig.api.host ? apiConfig.api.host : globalSettings.network.apiHost;
    swaggerJson.basePath = requestPath;
    swaggerJson.schemes = [globalSettings.network.schema];
    return swaggerJson;
};

function injectOAuth2(swaggerJson, oflow, authMethod, apiInfo) {
    const securityDefinitionsParam = (swaggerJson.securityDefinitions) ? swaggerJson.securityDefinitions : {};
    const securityParam = (swaggerJson.security) ? swaggerJson.security : [];
    const securitySchemaName = `${authMethod.friendlyShort}, ${oflow}`;
    securityDefinitionsParam[securitySchemaName] = {
        type: "oauth2",
        flow: oflow,
        authorizationUrl: authMethod.config.authorizeEndpoint,
        tokenUrl: authMethod.config.tokenEndpoint,
        scopes: makeSwaggerUiScopes(apiInfo)
    };

    // TODO: Scopes on specific endpoints
    const securityDef = {};
    securityDef[securitySchemaName] = [];
    securityParam.push(securityDef);
    swaggerJson.securityDefinitions = securityDefinitionsParam;
    swaggerJson.security = securityParam; //apply globally
}

function makeSwaggerUiScopes(apiInfo) {
    const scopeMap = {};
    if (apiInfo.settings && apiInfo.settings.scopes) {
        for (let s in apiInfo.settings.scopes) {
            const thisScope = apiInfo.settings.scopes[s];
            if (thisScope.description) {
                scopeMap[s] = thisScope.description;
            } else {
                scopeMap[s] = s;
            }
        }
    }
    return scopeMap;
}

function findSecurityProperties(swaggerJson) {
    const securityList = [];
    findSecurityPropertiesRecursive(swaggerJson, securityList);
    return securityList;
}

function findSecurityPropertiesRecursive(someProperty, securityList) {
    if (typeof someProperty === 'string' || typeof someProperty === 'number') {
        return;
    }
    if (Array.isArray(someProperty)) {
        for (let i = 0; i < someProperty.length; ++i) {
            findSecurityPropertiesRecursive(someProperty[i], securityList);
        }
    } else if (typeof someProperty === 'object') {
        for (let k in someProperty) {
            if (k === 'security') {
                securityList.push(someProperty[k]);
            } else {
                findSecurityPropertiesRecursive(someProperty[k], securityList);
            }
        }
    } else {
        debug(`Unknown typeof someProperty: ${typeof someProperty}`);
    }
}

function deleteEmptySecurityProperties(someProperty) {
    if (typeof someProperty === 'string' || typeof someProperty === 'number') {
        return;
    }
    if (Array.isArray(someProperty)) {
        for (let i = 0; i < someProperty.length; ++i) {
            deleteEmptySecurityProperties(someProperty[i]);
        }
    } else if (typeof someProperty === 'object') {
        for (let k in someProperty) {
            if (k === 'security') {
                if (Array.isArray(someProperty[k])) {
                    if (someProperty[k].length === 0) {
                        delete someProperty[k];
                    }
                } else {
                    warn('deleteEmptySecurityProperties: Non-Array security property');
                }
            } else {
                deleteEmptySecurityProperties(someProperty[k]);
            }
        }
    } else {
        debug(`Unknown typeof someProperty: ${typeof someProperty}`);
    }
}

function injectOAuth2OpenAPI(swaggerJson, oflow, authMethod, apiInfo) {
    const securitySchemesParam = (swaggerJson.components.securitySchemes) ? swaggerJson.components.securitySchemes : {};
    const securityParam = (swaggerJson.security) ? swaggerJson.security : [];
    const securitySchemaName = `${authMethod.friendlyShort}, ${oflow}`;
    securitySchemesParam[securitySchemaName] = {
        type: "oauth2"
    };
    const mflows = {};
    mflows[oflow] = {
        authorizationUrl: authMethod.config.authorizeEndpoint,
        tokenUrl: authMethod.config.tokenEndpoint,
        scopes: makeSwaggerUiScopes(apiInfo)
    };
    securitySchemesParam[securitySchemaName].flows = mflows;

    // TODO: Scopes on specific endpoints
    const securityDef = {};
    securityDef[securitySchemaName] = [];
    securityParam.push(securityDef);
    swaggerJson.components.securitySchemes = securitySchemesParam;
    swaggerJson.security = securityParam; //apply globally
}

function lookupAuthMethod(globalSettings, apiId, authMethodRef) {
    debug(`lookupAuthMethodConfig(${authMethodRef})`);
    const split = authMethodRef.split(':');
    if (split.length !== 2) {
        error(`lookupAuthMethodConfig: Invalid auth method "${authMethodRef}", expected "<auth server id>:<method id>"`);
        return null;
    }
    const authServerName = split[0];
    const authMethodName = split[1];

    const authServers = utils.loadAuthServerMap();
    if (!authServers[authServerName]) {
        warn(`lookupAuthMethodConfig: Unknown auth server ${authServerName}`);
        return null;
    }
    const authServer = authServers[authServerName];

    const authMethodOrig = authServer.authMethods.find(am => am.name === authMethodName);
    if (!authMethodOrig) {
        warn(`lookupAuthMethodConfig: Unknown auth method name ${authMethodName} (${authMethodRef})`);
        return null;
    }

    if (!authMethodOrig.enabled) {
        warn(`lookupAuthMethodConfig: Auth method ${authMethodRef} is not enabled, skipping.`);
        return null;
    }

    if (authMethodOrig.protected) {
        info(`lookupAuthMethodConfig: Auth method ${authMethodRef} is protected, skipping.`);
        return null;
    }

    const authMethod = utils.clone(authMethodOrig);
    const endpoints = [
        "authorizeEndpoint",
        "tokenEndpoint",
        "profileEndpoint"
    ];

    const apiUrl = globalSettings.network.schema + "://" + globalSettings.network.apiHost;
    // The loading of the authServers in 'www' ensures this is specified
    const authServerUrl = apiUrl + authServer.config.api.uris[0];

    for (let i = 0; i < endpoints.length; ++i) {
        const endpoint = endpoints[i];
        if (authMethod.config && authMethod.config[endpoint]) {
            authMethod.config[endpoint] = authServerUrl + mustache.render(authMethod.config[endpoint], { api: apiId, name: authMethodName });
        } else {
            warn(`Auth server ${authServer.name} does not have definition for endpoint ${endpoint}`);
        }
    }

    return authMethod;
}



module.exports = swaggerUtils;