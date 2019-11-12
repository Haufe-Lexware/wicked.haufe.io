'use strict';

const utils = require('./utils');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:registrations');
const dao = require('../dao/dao');

const webhooks = require('./webhooks');
const users = require('./users');

const registrations = require('express').Router();

// ===== SCOPES =====

const READ = 'read_registrations';
const WRITE = 'write_registrations';

const verifyReadScope = utils.verifyScope(READ);
const verifyWriteScope = utils.verifyScope(WRITE);

// ===== ENDPOINTS =====

registrations.get('/pools/:poolId', verifyReadScope, function (req, res, next) {
    // These may be undefined
    const namespace = req.query.namespace;
    const filter = utils.getFilter(req);
    const orderBy = utils.getOrderBy(req);
    const { offset, limit } = utils.getOffsetLimit(req);
    const noCountCache = utils.getNoCountCache(req);
    registrations.getByPoolAndNamespace(req.app, res, req.apiUserId, req.params.poolId, namespace, filter, orderBy, offset, limit, noCountCache);
});

registrations.get('/pools/:poolId/users/:userId', verifyReadScope, function (req, res, next) {
    registrations.getByPoolAndUser(req.app, res, req.apiUserId, req.params.poolId, req.params.userId);
});

registrations.put('/pools/:poolId/users/:userId', verifyWriteScope, function (req, res, next) {
    registrations.upsert(req.app, res, req.apiUserId, req.params.poolId, req.params.userId, req.body);
});

registrations.delete('/pools/:poolId/users/:userId', verifyWriteScope, function (req, res, next) {
    const namespace = req.query.namespace;
    registrations.delete(req.app, res, req.apiUserId, req.params.poolId, req.params.userId, namespace);
});

registrations.get('/users/:userId', verifyReadScope, function (req, res, next) {
    registrations.getByUser(req.app, res, req.apiUserId, req.params.userId);
});

// ===== IMPLEMENTATION =====

function verifyAccess(app, loggedInUserId, userId, onlyAdmin, callback) {
    debug(`verifyAccess(${loggedInUserId}, ${userId}, ${onlyAdmin})`);
    if (!loggedInUserId) {
        return callback(utils.makeError(403, 'Registrations: Must be making call on behalf of a user (must be logged in).'));
    }
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return callback(utils.makeError(500, 'Registrations: Could not load user.', err));
        }
        if (!loggedInUserInfo) {
            return callback(utils.makeError(403, 'Registrations: Not allowed.'));
        }
        // Admins are allowed access
        if (!loggedInUserInfo.admin) {
            // We have a non-admin here
            if (onlyAdmin) {
                return callback(utils.makeError(403, 'Registrations: Not allowed. This is admin land.'));
            }
            if (!userId) {
                return callback(utils.makeError(500, 'Registrations: Invalid state - need user reference if not user is admin'));
            }
            // Logged in user, and checking data for a user - they have to match
            if (loggedInUserId !== userId) {
                return callback(utils.makeError(403, 'Registrations: Not allowed (user mismatch).'));
            }
        }
        // Looks fine so far, do we have a user context? If so, that user
        // also has to exist for this to make sense.
        if (!userId) {
            // No, then we're already OK!
            return callback(null);
        }
        users.loadUser(app, userId, (err, userInfo) => {
            if (err) {
                return callback(utils.makeError(500, 'Registrations: Could not load context user', err));
            }
            if (!userInfo) {
                return callback(utils.makeError(404, 'Registration: Context user not found.'));
            }
            // OK, user exists, we'll be fine
            return callback(null, userInfo);
        });
    });
}

registrations.getByPoolAndNamespace = (app, res, loggedInUserId, poolId, namespace, filter, orderBy, offset, limit, noCountCache) => {
    debug(`getByPoolAndNamespace(${poolId}, ${namespace}, ${filter}, ${orderBy})`);

    if (!utils.isPoolIdValid(poolId)) {
        return utils.fail(res, 400, utils.validationErrorMessage('Pool ID'));
    }
    if (!utils.isNamespaceValid(namespace)) {
        return utils.fail(res, 400, utils.validationErrorMessage('Namespace'));
    }
    if (!utils.hasPool(poolId)) {
        return utils.fail(res, 404, `Pool with ID ${poolId} does not exist.'`);
    }
    const poolInfo = utils.getPool(poolId);
    if (namespace && !poolInfo.requiresNamespace) {
        return utils.fail(res, 400, `Pool with ID ${poolId} does not support namespaces`);
    }
    if (!namespace && poolInfo.requiresNamespace) {
        return utils.fail(res, 400, `Pool with ID ${poolId} requires a namespace`);
    }

    verifyAccess(app, loggedInUserId, null, true, (err) => {
        if (err) {
            return utils.failError(res, err);
        }
        verifyNamespace(poolId, namespace, (err) => {
            if (err) {
                return utils.failError(res, err);
            }
            dao.registrations.getByPoolAndNamespace(poolId, namespace, filter, orderBy, offset, limit, noCountCache, (err, regList, countResult) => {
                if (err) {
                    return utils.fail(res, 500, 'Registrations: Could not retrieve registrations by pool/namespace.', err);
                }
                // TODO: _links for paging?
                addPool(poolId, regList);
                return res.json({
                    items: regList,
                    count: countResult.count,
                    count_cached: countResult.cached,
                    offset: offset,
                    limit: limit
                });
            });
        });
    });
};

registrations.getByPoolAndUser = (app, res, loggedInUserId, poolId, userId) => {
    debug(`getByPoolAndUser(${poolId}, ${userId})`);

    if (!utils.isPoolIdValid(poolId)) {
        return utils.fail(res, 400, utils.validationErrorMessage('Pool ID'));
    }
    if (!utils.hasPool(poolId)) {
        return utils.fail(res, 404, `Pool with ID ${poolId} does not exist.'`);
    }

    verifyAccess(app, loggedInUserId, userId, false, (err) => {
        if (err) {
            return utils.failError(res, err);
        }

        dao.registrations.getByPoolAndUser(poolId, userId, (err, regList, countResult) => {
            if (err) {
                return utils.fail(res, 500, `Registrations: Could not retrieve registration for user ${userId} and pool ${poolId}.`, err);
            }
            addPool(poolId, regList);
            return res.json({
                items: regList,
                count: countResult.count,
                count_cached: countResult.cached
            });
        });
    });
};

registrations.getByUser = (app, res, loggedInUserId, userId) => {
    debug(`getByUser(${userId})`);

    verifyAccess(app, loggedInUserId, userId, false, (err) => {
        if (err) {
            return utils.failError(res, err);
        }
        dao.registrations.getByUser(userId, (err, regMap) => {
            if (err) {
                return utils.fail(res, 500, 'Registrations: Could not retrieve registrations for user.', err);
            }
            return res.json(regMap);
        });
    });
};


registrations.upsert = (app, res, loggedInUserId, poolId, userId, reg) => {
    debug(`upsert(${poolId}, ${userId})`);

    if (!reg) {
        return utils.fail(res, 400, 'Missing request body');
    }
    if (!utils.isPoolIdValid(poolId)) {
        return utils.fail(res, 400, utils.validationErrorMessage('Pool ID'));
    }
    if (!utils.isNamespaceValid(reg.namespace)) {
        return utils.fail(res, 400, utils.validationErrorMessage('Namespace'));
    }
    const poolInfo = utils.getPool(poolId);
    const namespace = reg.namespace;
    if (namespace && !poolInfo.requiresNamespace) {
        return utils.fail(res, 400, `Pool with ID ${poolId} does not support namespaces`);
    }
    if (!namespace && poolInfo.requiresNamespace) {
        return utils.fail(res, 400, `Pool with ID ${poolId} requires a namespace`);
    }
    if (!utils.hasPool(poolId)) {
        return utils.fail(res, 404, `Pool with ID ${poolId} does not exist.'`);
    }
    const { errorMessage, validatedData } = validateRegistrationData(poolId, reg);
    if (errorMessage) {
        return utils.fail(res, 400, errorMessage);
    }

    // pool id, user id and namespace are never in the prop info, take these explicitly
    validatedData.poolId = poolId;
    validatedData.userId = userId;
    validatedData.namespace = namespace;

    // verifyAccess also can return the userInfo object of the user in question; we want
    // to use this to amend the registration with the email address and custom ID of the
    // user.
    verifyAccess(app, loggedInUserId, userId, false, (err, userInfo) => {
        if (err) {
            return utils.failError(res, err);
        }
        verifyNamespace(poolId, namespace, (err) => {
            if (err) {
                return utils.failError(res, err);
            }
            validatedData.email = userInfo.email;
            validatedData.customId = userInfo.customId;

            dao.registrations.upsert(poolId, userId, loggedInUserId, validatedData, (err) => {
                if (err) {
                    return utils.fail(res, 500, 'Registrations: Failed to upsert.', err);
                }

                res.status(204).json({ code: 204, message: 'Upserted registration.' });
            });
        });
    });
};

registrations.delete = (app, res, loggedInUserId, poolId, userId, namespace) => {
    debug(`delete(${poolId}, ${userId})`);

    if (!utils.isPoolIdValid(poolId)) {
        return utils.fail(res, 400, utils.validationErrorMessage('Pool ID'));
    }
    if (!utils.hasPool(poolId)) {
        return utils.fail(res, 404, `Pool with ID ${poolId} does not exist.'`);
    }
    if (!utils.isNamespaceValid(namespace)) {
        return utils.fail(res, 400, 'Invalid namespace');
    }
    const poolInfo = utils.getPool(poolId);
    if (poolInfo.requiresNamespace && !namespace) {
        return utils.fail(res, 400, 'Namespace required to delete from this pool.');
    }
    if (!poolInfo.requiresNamespace && namespace) {
        return utils.fail(res, 400, 'Invalid request; namespace passed in, but pool does not support namespaces.');
    }

    verifyAccess(app, loggedInUserId, userId, false, (err) => {
        if (err) {
            return utils.failError(res, err);
        }
        verifyNamespace(poolId, namespace, (err) => {
            if (err) {
                return utils.failError(res, err);
            }
            dao.registrations.delete(poolId, userId, namespace, loggedInUserId, (err) => {
                if (err) {
                    return utils.fail(res, 500, 'Registrations: Could not delete registration.', err);
                }

                return res.status(204).json({ code: 204, message: 'Deleted' });
            });
        });
    });
};

function addPool(poolId, regListOrSingle) {
    if (Array.isArray(regListOrSingle)) {
        for (let i = 0; i < regListOrSingle.length; ++i) {
            regListOrSingle[i].poolId = poolId;
        }
    } else {
        regListOrSingle.poolId = poolId;
    }
}

// =======================================
// Registration Validation Logic
// =======================================

function verifyNamespace(poolId, namespace, callback) {
    debug(`verifyNamespace(${poolId}, ${namespace})`);
    if (!namespace) {
        return callback(null, null);
    }
    dao.namespaces.getByPoolAndNamespace(poolId, namespace, (err, namespaceData) => {
        if (err) {
            return callback(err);
        }
        if (!namespaceData) {
            return callback(utils.makeError(400, `Invalid request; namespace ${namespace} does not exist for pool ${poolId}`));
        }
        return callback(null, namespaceData);
    });
}

function validateRegistrationData(poolId, data) {
    debug(`validateRegistrationData(${poolId})`);
    debug(data);

    let errorMessage;
    let validatedData = {};

    const poolInfo = utils.getPool(poolId);
    debug(poolInfo);
    for (let i = 0; i < poolInfo.properties.length; ++i) {
        const propInfo = poolInfo.properties[i];
        const propName = propInfo.id;
        const exists = data.hasOwnProperty(propName);
        const isRequired = propInfo.required;

        if (isRequired && !exists) {
            errorMessage = `Property '${propName}' is a required field.`;
        }

        if (exists) {
            // If it doesn't exist, we don't have to bother, right?
            switch (propInfo.type) {
                case "string":
                    errorMessage = validateString(propName, propInfo, data[propName]);
                    break;
                default:
                    errorMessage = `Property ${propName} has unsupported type ${propInfo.type}`;
                    break;
            }

            // If we haven't found errors, take over data
            if (!errorMessage) {
                validatedData[propName] = data[propName];
            }
        }

        if (errorMessage) {
            validatedData = null;
            break;
        }
    }

    if (!errorMessage) {
        debug('Validated registration input data');
        debug(validatedData);
    } else {
        debug('Validation failed: ' + errorMessage);
    }

    return {
        errorMessage,
        validatedData
    };
}

function validateString(propName, propInfo, prop) {
    const s = prop ? prop : ""; // null, undefined => empty string

    if (propInfo.required && s.length === 0) {
        return `Property ${propName} is empty, but is required`;
    }
    if (propInfo.hasOwnProperty('minLength')) {
        if (propInfo.required || s.length > 0) {
            if (s.length < propInfo.minLength) {
                return `Property ${propName} has a required minimum length of ${propInfo.minLength}`;
            }
        }
    }
    let maxLength = 255; // Default max length
    if (propInfo.hasOwnProperty('maxLength')) {
        maxLength = propInfo.maxLength;
    }
    if (propInfo.required || s.length > 0) {
        if (s.length > maxLength) {
            return `Property ${propName} has a max length of ${maxLength}, given string is ${s.length}`;
        }
    }
    return null;
}

module.exports = registrations;
