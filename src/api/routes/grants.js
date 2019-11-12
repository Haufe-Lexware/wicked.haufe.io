'use strict';

const utils = require('./utils');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:grants');
const dao = require('../dao/dao');

const webhooks = require('./webhooks');
const users = require('./users');

const grants = require('express').Router();

// ===== SCOPES =====

const READ = 'read_grants';
const WRITE = 'write_grants';

const verifyReadScope = utils.verifyScope(READ);
const verifyWriteScope = utils.verifyScope(WRITE);

// ===== ENDPOINTS =====

grants.get('/:userId', verifyReadScope, function (req, res, next) {
    getByUser(req.app, res, req.apiUserId, req.params.userId);
});

grants.delete('/:userId', verifyWriteScope, function (req, res, next) {
    deleteByUser(req.app, res, req.apiUserId, req.params.userId);
});

grants.get('/:userId/applications/:applicationId/apis/:apiId', verifyReadScope, function (req, res, next) {
    getByUserApplicationAndApi(req.app, res, req.apiUserId, req.params.userId, req.params.applicationId, req.params.apiId);
});

grants.put('/:userId/applications/:applicationId/apis/:apiId', verifyWriteScope, function (req, res, next) {
    upsertGrants(req.app, res, req.apiUserId, req.params.userId, req.params.applicationId, req.params.apiId, req.body);
});

grants.delete('/:userId/applications/:applicationId/apis/:apiId', verifyWriteScope, function (req, res, next) {
    deleteGrants(req.app, res, req.apiUserId, req.params.userId, req.params.applicationId, req.params.apiId);
});

// ===== IMPLEMENTATION =====

function verifyAccess(app, loggedInUserId, userId, callback) {
    debug(`verifyAccess(${loggedInUserId}, ${userId})`);
    if (!loggedInUserId) {
        return callback(utils.makeError(403, 'Grants: Must be making call on behalf of a user (must be logged in).'));
    }
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return callback(utils.makeError(500, 'Grants: Could not load logged in user.', err));
        }
        if (!loggedInUserInfo) {
            return callback(utils.makeError(403, 'Grants: Not allowed.'));
        }
        if (!userId) {
            return callback(utils.makeError(400, 'Grants: Invalid state - need context user.'));
        }
        // Admins are allowed access
        if (!loggedInUserInfo.admin) {
            // We have a non-admin here
            // Logged in user, and checking data for a user - they have to match
            if (loggedInUserId !== userId) {
                debug(loggedInUserInfo);
                return callback(utils.makeError(403, `Grants: Not allowed (user mismatch, ${loggedInUserId} != ${userId}).`));
            }
        }
        // Looks fine so far, now we must check the user context. That user
        // also has to exist for this to make sense.
        users.loadUser(app, userId, (err, userInfo) => {
            if (err) {
                return callback(utils.makeError(500, 'Grants: Could not load context user', err));
            }
            if (!userInfo) {
                return callback(utils.makeError(404, 'Grants: Context user not found.'));
            }
            // OK, user exists, we'll be fine
            return callback(null);
        });
    });
}

function getByUser(app, res, loggedInUserId, userId) {
    debug(`getByUser(${loggedInUserId}, ${userId})`);

    verifyAccess(app, loggedInUserId, userId, (err) => {
        if (err) {
            return utils.failError(res, err);
        }

        dao.grants.getByUser(userId, (err, grantList, countResult) => {
            if (err) {
                return utils.fail(res, 500, 'Grants: Could not load grants by user', err);
            }

            return res.json({
                items: grantList,
                count: countResult.count,
                count_cached: countResult.cached
            });
        });
    });
}

function deleteByUser(app, res, loggedInUserId, userId) {
    debug(`deleteByUser(${loggedInUserId}, ${userId})`);

    verifyAccess(app, loggedInUserId, userId, (err) => {
        if (err) {
            return utils.failError(res, err);
        }
        dao.grants.deleteByUser(userId, loggedInUserId, (err) => {
            if (err) {
                return utils.fail(res, 500, 'Grants: Could not delete all user grants', err);
            }
            return res.status(204).json({ code: 204, message: 'Deleted all grants.' });
        });
    });
}

function getByUserApplicationAndApi(app, res, loggedInUserId, userId, applicationId, apiId) {
    debug(`getByUserApplicationAndApi(${loggedInUserId}, ${userId}, ${applicationId}, ${apiId})`);

    verifyAccess(app, loggedInUserId, userId, (err) => {
        if (err) {
            return utils.failError(res, err);
        }

        dao.grants.getByUserApplicationAndApi(userId, applicationId, apiId, (err, grant) => {
            if (err) {
                return utils.fail(res, 500, 'Grants: Could not load grants by user and API', err);
            }

            // TODO: Paging links
            return res.json(grant);
        });
    });
}

function upsertGrants(app, res, loggedInUserId, userId, applicationId, apiId, newGrants) {
    debug(`upsertGrants(${loggedInUserId}, ${userId}, ${applicationId}, ${apiId})`);
    debug(newGrants);

    // Let's verify a couple of things before we start writing grants, mmkay?
    let apiInfo;
    try {
        // This may throw if the API is not available
        apiInfo = utils.getApi(apiId);
        debug(apiInfo);
    } catch (err) {
        return utils.failError(res, err);
    }

    // If it's an invalid applicationI ID, we needn't go further
    if (!utils.isValidApplicationId(applicationId)) {
        return utils.fail(res, 400, utils.invalidApplicationIdMessage());
    }
    // Check whether the application is present
    dao.applications.getById(applicationId, (err, appInfo) => {
        if (err) {
            return utils.fail(res, 500, 'Grants: Could not retrieve application information.', err);
        }
        if (!appInfo) {
            return utils.fail(res, 404, 'Grants: Application not found.');
        }
        // OK, we're fine so far

        const validationError = validateGrants(apiInfo, newGrants);
        if (validationError) {
            return utils.fail(res, 400, `Grants: Invalid request: ${validationError}`);
        }

        const upsertData = {
            userId: userId,
            applicationId: applicationId,
            apiId: apiId,
            grants: newGrants.grants
        };

        // Delegate to DAO to write this thing
        dao.grants.upsert(userId, applicationId, apiId, loggedInUserId, upsertData, (err) => {
            if (err) {
                return utils.fail(res, 500, 'Grants: Could not upsert grants', err);
            }
            return res.status(204).json({ code: 204, message: 'Upserted grants.' });
        });
    });
}

// Checks:
// (a) That the grantInfo is well formed
// (b) That the granted scopes are present in the API
function validateGrants(apiInfo, grantInfo) {
    debug(`validateGrants(...)`);
    debug(grantInfo);
    if (!grantInfo.grants) {
        return 'The supplied grants do not contain a "grants" property.';
    }
    if (!Array.isArray(grantInfo.grants)) {
        return 'The supplied grants property is not an array.';
    }

    // If we have grants, check that the API has scope definitions
    if (grantInfo.grants.length > 0) {
        if (!apiInfo.settings || (apiInfo.settings && !apiInfo.settings.scopes)) {
            // This API doesn't have any scopes, wtf is this?
            return `The API ${apiInfo.id} does not have a scopes definition, cannot grant access to it.`;
        }
    }

    // Now validate the scope grants one by one
    for (let i = 0; i < grantInfo.grants.length; ++i) {
        const g = grantInfo.grants[i];
        const gType = typeof (g);
        if (gType !== 'object') {
            return `The items im the grants property are expected to be 'object', is '${gType}'`;
        }
        if (!g.scope) {
            return 'All items in the grants array must contain a "scope" property.';
        }

        // Okay, so far it's well formed, let's check whether the scope is actually present in the API
        if (!apiInfo.settings.scopes[g.scope]) {
            return `The API ${apiInfo.id} doesn't have a scope called "${g.scope}".`;
        }
    }
    // Yay, all's good
    return null;
}

function deleteGrants(app, res, loggedInUserId, userId, applicationId, apiId) {
    debug(`deleteGrants(${loggedInUserId}, ${userId}, ${applicationId}, ${apiId})`);

    // We explicitly don't check whether application or API is present here; in case
    // we have "leftovers", we want to allow a user to delete those.
    verifyAccess(app, loggedInUserId, userId, (err) => {
        if (err) {
            return utils.failError(err);
        }

        dao.grants.delete(userId, applicationId, apiId, loggedInUserId, (err) => {
            if (err) {
                return utils.fail(res, 500, 'Grants: Could not delete grants.', err);
            }
            return res.status(204).json({ code: 204, message: 'Deleted.' });
        });
    });
}



module.exports = grants;