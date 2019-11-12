'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:plugin-utils');

const pluginUtils = function () { };

pluginUtils.makeViewModel = function (configPlugins) {
    let foundRateLimiting = false;
    let foundCors = false;
    let foundFileLog = false;
    let foundCorrelationId = false;
    let foundAwsLambda = false;

    const plugins = {
        others: {
            useOthers: false,
            config: []
        }
    };

    for (let i = 0; i < configPlugins.length; ++i) {
        const plugin = configPlugins[i];
        if ("rate-limiting" == plugin.name) {
            plugins.rate_limiting = plugin;
            plugins.rate_limiting.useRateLimiting = true;
            foundRateLimiting = true;
        } else if ("cors" == plugin.name) {
            plugins.cors = plugin;
            plugins.cors.useCors = true;
            debug(JSON.stringify(plugins.cors, null, 2));
            if (typeof (plugin.config.origins) === 'string')
                plugin.config.origins = [plugin.config.origins];
            foundCors = true;
        } else if ("file-log" == plugin.name) {
            plugins.file_log = plugin;
            plugins.file_log.useFileLog = true;
            foundFileLog = true;
        } else if ("correlation-id" == plugin.name) {
            plugins.correlation_id = plugin;
            plugins.correlation_id.useCorrelationId = true;
            foundCorrelationId = true;
        } else if ("aws-lambda" == plugin.name) {
            plugins.aws_lambda = plugin;
            plugins.aws_lambda.useAwsLambda = true;
            foundAwsLambda = true;
        } else {
            // Other plugin, here's room for extensions
            plugins.others.useOthers = true;
            plugins.others.config.push(plugin);
        }
    }

    if (!foundRateLimiting) {
        // Add a stub
        plugins.rate_limiting = {
            useRateLimiting: false,
            name: "rate-limiting",
            config: {
                hour: 100,
                fault_tolerant: true
            }
        };
    }
    if (!foundAwsLambda) {
        // Add a stub
        plugins.aws_lambda = {
            useAwsLambda: false,
            name: "aws-lambda",
            config: {
                aws_region: 'us-east-1'
            }
        };
    }

    if (!foundCors) {
        // Add a stub for CORS
        plugins.cors = {
            useCors: false,
            name: "cors",
            config: {
                origins: ['*'],
                methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
            }
        };
    }

    if (!foundFileLog) {
        // Add a stub for FileLog
        plugins.file_log = {
            useFileLog: false,
            name: 'file-log',
            config: {
                path: '/usr/local/kong/logs/kong-access.log'
            }
        };
    }

    if (!foundCorrelationId) {
        // Add a stub for correlation id
        plugins.correlation_id = {
            useCorrelationId: false,
            name: 'correlation-id',
            config: {
                header_name: 'Correlation-Id',
                generator: 'uuid',
                echo_downstream: false
            }
        };
    }

    if (plugins.others.useOthers) {
        plugins.others.config = JSON.stringify(plugins.others.config, null, 2);
    } else {
        // We'll add a small stub here as well
        plugins.others.config = JSON.stringify([
            {
                name: "jwt",
                config: {
                    uri_param_names: 'jwt',
                    claims_to_verify: '...'
                }
            },
            {
                name: "...",
                config: {}
            }
        ], null, 2);
    }

    return plugins;
};

// Sanitize JSON format for Kong
function fixRateLimiting(data) {
    //debug('fixRateLimiting: ' + JSON.stringify(data, null, 2));
    const rls = [
        "second",
        "minute",
        "hour",
        "day",
        "month",
        "year"
    ];
    for (let propIndex in rls) {
        const prop = rls[propIndex];
        if (data.config.hasOwnProperty(prop) && data.config[prop] !== "")
            data.config[prop] = Number(data.config[prop]);
        else if (data.config.hasOwnProperty(prop))
            delete data.config[prop];
    }
    return data;
}


// Sanitize JSON format for Kong
function fixCors(data) {
    //debug('fixCors: ' + JSON.stringify(data, null, 2));
    if (data.config.hasOwnProperty('max_age') && data.config.max_age !== "")
        data.config.max_age = Number(data.config.max_age);
    else if (data.config.hasOwnProperty('max_age'))
        delete data.config.max_age;
    const props = [
        "origins",
        "methods",
        "headers",
        "exposed_headers"
    ];
    for (let propIndex in props) {
        const prop = props[propIndex];
        if (!(data.config.hasOwnProperty(prop) && data.config[prop] !== ""))
            delete data.config[prop];
    }
    return data;
}

pluginUtils.makePluginsArray = function (bodyPlugins) {
    //debug(JSON.stringify(bodyPlugins, null, 2));
    const plugins = [];
    if (bodyPlugins.rate_limiting.useRateLimiting) {
        delete bodyPlugins.rate_limiting.useRateLimiting;
        bodyPlugins.rate_limiting.name = 'rate-limiting';
        plugins.push(fixRateLimiting(bodyPlugins.rate_limiting));
    }
    if (bodyPlugins.aws_lambda && bodyPlugins.aws_lambda.useAwsLambda) {
        delete bodyPlugins.aws_lambda.useAwsLambda;
        bodyPlugins.aws_lambda.name = 'aws-lambda';
        plugins.push(bodyPlugins.aws_lambda);
    }
    if (bodyPlugins.cors && bodyPlugins.cors.useCors) {
        delete bodyPlugins.cors.useCors;
        bodyPlugins.cors.name = 'cors';
        plugins.push(fixCors(bodyPlugins.cors));
    }
    if (bodyPlugins.file_log && bodyPlugins.file_log.useFileLog) {
        delete bodyPlugins.file_log.useFileLog;
        bodyPlugins.file_log.name = 'file-log';
        plugins.push(bodyPlugins.file_log);
    }
    if (bodyPlugins.correlation_id && bodyPlugins.correlation_id.useCorrelationId) {
        delete bodyPlugins.correlation_id.useCorrelationId;
        bodyPlugins.correlation_id.name = 'correlation-id';
        plugins.push(bodyPlugins.correlation_id);
    }
    if (bodyPlugins.others.useOthers) {
        const pluginsArray = JSON.parse(bodyPlugins.others.config);
        if (!Array.isArray(pluginsArray))
            throw new Error('The content of the "other plugins" text area must be a JSON array ([ ... ])!');
        for (let i = 0; i < pluginsArray.length; ++i) {
            const thisPlugin = pluginsArray[i];
            if (!thisPlugin.name)
                throw new Error('An item in the plugins array must always have a "name" property.');
            plugins.push(thisPlugin);
        }
    }
    return plugins;
};

module.exports = pluginUtils;