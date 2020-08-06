'use strict';

/* global __dirname */

const fs = require('fs');
const path = require('path');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:initializer');
const async = require('async');
const yaml = require('js-yaml');

const utils = require('./utils');
const principal = require('./principal');
const auditlog = require('./auditlog');
const accessTokens = require('./accessTokens');
const versionizer = require('./versionizer');

const dao = require('../dao/dao');

const initializer = function () { };

initializer.checkDynamicConfig = (callback) => {
    debug('checkDynamicConfig()');

    const glob = utils.loadGlobals();

    // Get checking functions from the DAO
    const daoChecks = dao.meta.getInitChecks();

    const checks = [];
    for (let i = 0; i < daoChecks.length; ++i) {
        checks.push(daoChecks[i]);
    }

    checks.push(addInitialUsers);
    checks.push(checkApiPlans);
    checks.push(checkSubscriptions);

    // This must always be the last step
    checks.push(initializationFinished);

    async.mapSeries(checks,
        function (checkFunction, callback) {
            // Make sure we're async.
            process.nextTick(function () {
                checkFunction(glob, callback);
            });
        },
        function (err, results) {
            if (err) {
                error(err);
            }

            let checkResults = [];
            for (let i = 0; i < results.length; ++i) {
                if (results[i]) {
                    for (let j = 0; j < results[i].length; ++j) {
                        checkResults.push(results[i][j]);
                    }
                }
            }
            if (checkResults.length === 0) {
                checkResults = null;
            }
            callback(err, checkResults);
        });
};

initializer.writeSwaggerJsonFiles = function () {
    debug(`writeSwaggerJsonFiles()`);
    const swaggerDir = path.join(__dirname, '..', 'swagger');
    const swaggerFiles = fs.readdirSync(swaggerDir);
    for (let i = 0; i < swaggerFiles.length; ++i) {
        const fileName = swaggerFiles[i];
        const apiName = fileName.substring(0, fileName.length - 5); // strip .yaml
        if (!fileName.toLowerCase().endsWith('.yaml')) {
            continue;
        }
        const fullFileName = path.join(swaggerDir, fileName);
        try {
            const swaggerYaml = yaml.safeLoad(fs.readFileSync(fullFileName, 'utf8'));
            const apiDir = path.join(__dirname, 'internal_apis', apiName);
            if (!fs.existsSync(apiDir)) {
                warn(`writeSwaggerJsonFiles: Detected Swagger YAML for API ${apiName}, but there is no such directory (${apiDir}).`);
                continue;
            }
            const swaggerJsonFile = path.join(apiDir, 'swagger.json');
            fs.writeFileSync(swaggerJsonFile, JSON.stringify(swaggerYaml, null, 2), 'utf8');
        } catch (err) {
            error(`writeSwaggerJsonFiles: Could not convert file ${fileName} to JSON`);
            throw err;
        }
    }
};

function addInitialUsers(glob, callback) {
    debug('addInitialUsers()');
    let error = null;
    if (!glob.initialUsers) {
        debug('Global config does not contain initial users.');
        return callback(null);
    }

    async.mapSeries(glob.initialUsers, (thisUser, callback) => {
        dao.users.getById(thisUser.id, (err, userInfo) => {
            if (err) {
                return callback(err);
            }
            if (userInfo) {
                debug('User "' + thisUser.email + "' already exists.");
                return callback(null);
            }

            if (thisUser.password && thisUser.customId) {
                error('Initial user with ID ' + thisUser.id + ' has both password and customId; password NOT added.');
                delete thisUser.password;
            }
            if (thisUser.password) {
                // Please note that this code does explicitly NOT check that the initial password is
                // actually compliant with the selected password strategy. I cannot quite make up my
                // mind whether this is a good or bad thing. But it's definitely the most backwards-
                // compatible thing.
                thisUser.password = utils.makePasswordHash(thisUser.password);
            }
            thisUser.applications = [];
            thisUser.validated = true;
            thisUser.email = thisUser.email.toLowerCase();

            dao.users.create(thisUser, callback);
        });
    }, (err) => {
        // This does not generate any messages; it either fails,
        // or it succeeds.
        return callback(err);
    });
}

function checkApiPlans(glob, callback) {
    debug('checkApiPlans()');
    let internalErr = null;
    const messages = [];
    try {
        const apis = utils.loadApis();
        const plans = utils.loadPlans();

        const planMap = buildPlanMap(plans);

        for (let i = 0; i < apis.apis.length; ++i) {
            const api = apis.apis[i];
            for (let p = 0; p < api.plans.length; ++p) {
                if (!planMap[api.plans[p]]) {
                    messages.push('checkApiPlans: API "' + api.id + '" refers to an unknown plan: "' + api.plans[i] + '".');
                }
            }
        }
    } catch (err) {
        error(err);
        internalErr = err;
    }

    let resultMessages = null;
    if (messages.length > 0) {
        resultMessages = messages;
    }
    callback(internalErr, resultMessages);
}

// I think this is one of the worst functions I have ever written.
// No, seriously, it's horrible. It's full of side effects and bad
// hacks. It does some very useful checks, like ensuring that all
// subscriptions are pointing to (a) an API and (b) a plan which is
// still present.
//
// As a side effect, if you're using the JSON DAO, it rebuilds the
// index of subscriptions. And that's really really hacky.
function checkSubscriptions(glob, callback) {
    debug('checkSubscriptions()');

    const messages = [];

    const apis = utils.loadApis();
    const plans = utils.loadPlans();

    const apiMap = buildApiMap(apis);
    const planMap = buildPlanMap(plans);

    // Work on 100 applications at once
    const PAGE = 100;
    dao.applications.getCount((err, appCount) => {
        if (err) {
            return callback(err);
        }

        // Closures are perversly useful.
        const check = function (subsCheck, subs) {
            for (let i = 0; i < subs.length; ++i) {
                const msg = subsCheck(apiMap, planMap, subs[i]);
                if (msg) {
                    messages.push(msg);
                }
            }
        };

        const loops = Math.ceil(appCount / PAGE);
        async.timesSeries(loops, (loop, callback) => {
            const offset = loop * PAGE;
            dao.applications.getIndex(offset, PAGE, (err, apps) => {
                if (err) {
                    return callback(err);
                }
                async.map(apps, (thisApp, callback) => {
                    debug(thisApp);
                    dao.subscriptions.getByAppId(thisApp.id, (err, subs) => {
                        if (err) {
                            return callback(err);
                        }
                        check(thatPlanIsValid, subs);
                        check(thatApiIsValid, subs);
                        check(thatApiPlanIsValid, subs);
                        // Waaa, thisApi.subscriptions is filled here by side-effect
                        check(thatApiIndexIsWritten, subs);
                        // This is only necessary for the JSON DAO, and
                        // it is synchronous.
                        dao.subscriptions.legacyWriteSubsIndex(thisApp, subs);

                        // Yay
                        return callback(null);
                    });
                }, callback);
            });
        }, (err) => {
            if (err) {
                error(err);
                error(err.stack);
            }
            let resultMessages = null;
            if (messages.length > 0) {
                resultMessages = messages;
            }
            // This is legacy functionality which is not necessary for future DAOs,
            // but we will need to keep it in for now.
            // Finish by writing the API to Application index
            for (let i = 0; i < apis.apis.length; ++i) {
                const thisApi = apis.apis[i];
                dao.subscriptions.legacySaveSubscriptionApiIndex(thisApi.id, thisApi.subscriptions);
                delete thisApi.subscriptions;
            }

            callback(err, resultMessages); // err may be null, hopefully is, actually
        });
    });
}

function buildApiMap(apis) {
    const apiMap = {};
    for (let i = 0; i < apis.apis.length; ++i) {
        const api = apis.apis[i];
        // We'll fill this below.
        api.subscriptions = [];
        apiMap[api.id] = api;
    }
    return apiMap;
}

function buildPlanMap(plans) {
    const planMap = {};
    for (let i = 0; i < plans.plans.length; ++i) {
        const plan = plans.plans[i];
        planMap[plan.id] = plan;
    }
    return planMap;
}

function thatPlanIsValid(apis, plans, sub) {
    if (plans[sub.plan]) {
        return null;
    }
    return 'PlanIsValid: Application "' + sub.application + '" has a subscription to invalid plan "' + sub.plan + '" for API "' + sub.api + '".';
}

function thatApiIsValid(apis, plans, sub) {
    if (apis[sub.api]) {
        return null;
    }
    return 'ApiIsValid: Application "' + sub.application + '" has a subscription to invalid API "' + sub.api + '".';
}

function thatApiPlanIsValid(apis, plans, sub) {
    if (!apis[sub.api] || !plans[sub.plan]) {
        return null; // This is covered by the above two
    }
    let found = false;
    const api = apis[sub.api];
    for (let i = 0; i < api.plans.length; ++i) {
        if (api.plans[i] == sub.plan) {
            found = true;
        }
    }
    if (found) {
        return null;
    }
    return 'ApiPlanIsValid: Application "' + sub.application + '" has a subscription to an invalid API Plan (plan not part of API "' + sub.api + '"): "' + sub.plan + '".';
}

// The following function returns "null" as in invariant. This is on
// purpose, as we only need the side effect (pushing to the subscriptions arraay).
// This is of course in itself a code smell. Hence, still we flag it to not be
// checked by SonarQube.
// NOSONAR
function thatApiIndexIsWritten(apis, plans, sub) {
    if (!apis[sub.api] || !plans[sub.plan]) {
        // Shouldn't be possible, but we still won't make it an error.
        return null; 
    }
    const api = apis[sub.api];
    api.subscriptions.push({
        application: sub.application,
        plan: sub.plan
    });
    return null;
}

function initializationFinished(glob, callback) {
    debug('initializationFinished()');
    dao.initFinished();
    versionizer.writeConfigHashToMetadata(() => {
        // Principal/follower election triggering
        principal.initialElection();
        auditlog.initialize();
        accessTokens.initialize();
        callback(null);
    });
}

module.exports = initializer;
