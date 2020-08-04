'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:applications');
const utils = require('./utils');
const users = require('./users');
const subscriptions = require('./subscriptions');
const ownerRoles = require('./ownerRoles');
const webhooks = require('./webhooks');
const dao = require('../dao/dao');
const daoUtils = require('../dao/dao-utils');

const applications = require('express').Router();

// ===== SCOPES =====

const READ_APPLICATIONS = 'read_applications';
const WRITE_APPLICATIONS = 'write_applications';

const verifyApplicationsReadScope = utils.verifyScope(READ_APPLICATIONS);
const verifyApplicationsWriteScope = utils.verifyScope(WRITE_APPLICATIONS);

const READ_SUBSCRIPTIONS = 'read_subscriptions';
const WRITE_SUBSCRIPTIONS = 'write_subscriptions';

const verifySubscriptionsReadScope = utils.verifyScope(READ_SUBSCRIPTIONS);
const verifySubscriptionsWriteScope = utils.verifyScope(WRITE_SUBSCRIPTIONS);
const APP_MAX_LENGTH_DESCRIPTION = 1024;

// Temporarily use a null middleware
// const verifySubscriptionsReadScope = function (req, res, next) { next(); };
// const verifySubscriptionsWriteScope = function (req, res, next) { next(); };


// ===== ENDPOINTS =====

applications.get('/', verifyApplicationsReadScope, function (req, res, next) {
    const { offset, limit } = utils.getOffsetLimit(req);
    const filter = utils.getFilter(req);
    const orderBy = utils.getOrderBy(req);
    const noCountCache = utils.getNoCountCache(req);
    const embed = utils.getEmbed(req);
    applications.getApplications(req.app, res, req.apiUserId, filter, orderBy, offset, limit, noCountCache, embed);
});

applications.post('/', verifyApplicationsWriteScope, function (req, res, next) {
    applications.createApplication(req.app, res, req.apiUserId, req.body);
});

applications.get('/roles', verifyApplicationsReadScope, function (req, res, next) {
    applications.getRoles(req.app, res);
});

applications.get('/:appId', verifyApplicationsReadScope, function (req, res, next) {
    applications.getApplication(req.app, res, req.apiUserId, req.params.appId);
});

applications.patch('/:appId', verifyApplicationsWriteScope, function (req, res, next) {
    applications.patchApplication(req.app, res, req.apiUserId, req.params.appId, req.body);
});

applications.delete('/:appId', verifyApplicationsWriteScope, function (req, res, next) {
    applications.deleteApplication(req.app, res, req.apiUserId, req.params.appId);
});

applications.post('/:appId/owners', verifyApplicationsWriteScope, function (req, res, next) {
    applications.addOwner(req.app, res, req.apiUserId, req.params.appId, req.body);
});

applications.delete('/:appId/owners', verifyApplicationsWriteScope, function (req, res, next) {
    applications.deleteOwner(req.app, res, req.apiUserId, req.params.appId, req.query.userEmail);
});

// ===== SUBSCRIPTIONS ENDPOINTS ======

applications.get('/:appId/subscriptions', verifySubscriptionsReadScope, function (req, res, next) {
    subscriptions.getSubscriptions(req.app, res, applications, req.apiUserId, req.params.appId);
});

applications.post('/:appId/subscriptions', verifySubscriptionsWriteScope, function (req, res, next) {
    subscriptions.addSubscription(req.app, res, applications, req.apiUserId, req.params.appId, req.body);
});

applications.get('/:appId/subscriptions/:apiId', verifySubscriptionsReadScope, function (req, res, next) {
    subscriptions.getSubscription(req.app, res, applications, req.apiUserId, req.params.appId, req.params.apiId);
});

applications.delete('/:appId/subscriptions/:apiId', verifySubscriptionsWriteScope, function (req, res, next) {
    subscriptions.deleteSubscription(req.app, res, applications, req.apiUserId, req.params.appId, req.params.apiId);
});

applications.patch('/:appId/subscriptions/:apiId', verifySubscriptionsWriteScope, function (req, res, next) {
    subscriptions.patchSubscription(req.app, res, applications, req.apiUserId, req.params.appId, req.params.apiId, req.body);
});

// ===== SPECIAL ENDPOINT, THIS IS REGISTERED IN app.js =====

// '/subscriptions/:clientId'
applications.getSubscriptionByClientId = function (req, res) {
    subscriptions.getSubscriptionByClientId(req.app, res, applications, req.apiUserId, req.params.clientId);
};

// ===== IMPLEMENTATION =====


const accessFlags = {
    NONE: 0,
    ADMIN: 1,
    COLLABORATE: 2,
    READ: 4
};

function isValidRedirectUri(redirectUri) {
    if (!redirectUri) {
        return false;
    }
    if (typeof (redirectUri) !== 'string') {
        return false;
    }
    let url = null;
    try {
        url = new URL(redirectUri);
    } catch (ex) {
        error(ex);
        return false;
    }
    // Must not contain fragment
    if (redirectUri.indexOf('#') >= 0) {
        return false;
    }

    if (process.env.ALLOW_ANY_REDIRECT_URI && process.env.ALLOW_ANY_REDIRECT_URI !== '') {
        // https://github.com/Haufe-Lexware/wicked.haufe.io/issues/196
        return true;
    }

    if (
        (redirectUri.startsWith('https://') && (redirectUri !== 'https://')) ||
        (redirectUri.startsWith('http://localhost')) ||
        (redirectUri.startsWith('http://127.0.0.1')) ||
        (redirectUri.startsWith('http://portal.local')) ||
        (redirectUri.startsWith('http://') && process.env.NODE_ENV.indexOf('local') >= 0) // Allow unsafe redirects for local development
    ) {
        return true;
    }

    // Now let's check if we have something weird
    if (url.protocol !== 'https:' &&
        url.protocol !== 'http:') {
        // Custom scheme; Kong NEEDS a host (https://github.com/Kong/kong/issues/3790)
        if (!url.host) {
            return false;
        }
        return true;
    }
    return false;
}

applications.checkValidClientType = function (appInfo) {
    if (appInfo.clientType) {
        switch (appInfo.clientType) {
            case daoUtils.ClientType.Confidential:
            case daoUtils.ClientType.Public_SPA:
            case daoUtils.ClientType.Public_Native:
                // The client type is valid, so the value of "confidential" will be calculated
                // cased on this.
                return true;
        }
    } else {
        // This will default to either a 'confidential' or a 'public_spa' client type,
        // depending on the value of the clientType (see above).
        return true;
    }
    return false;
};

applications.getAllowedAccess = function (app, appInfo, userInfo) {
    debug('getAllowedAccess()');
    if (userInfo.admin) {
        return accessFlags.ADMIN;
    }
    // Check roles
    for (let i = 0; i < appInfo.owners.length; ++i) {
        const owner = appInfo.owners[i];
        if (owner.userId != userInfo.id) {
            continue;
        }

        if (ownerRoles.OWNER == owner.role) {
            return accessFlags.ADMIN;
        } else if (ownerRoles.COLLABORATOR == owner.role) {
            return accessFlags.COLLABORATOR;
        } else if (ownerRoles.READER == owner.role) {
            return accessFlags.READER;
        }
    }

    return accessFlags.NONE;
};

applications.getApplications = function (app, res, loggedInUserId, filter, orderBy, offset, limit, noCountCache, embed) {
    debug('getApplications()');
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getApplications: Could not load user.', err);
        }
        if (!userInfo) {
            return utils.fail(res, 403, 'Not allowed.');
        }
        if (!userInfo.admin && !userInfo.approver) {
            return utils.fail(res, 403, 'Not allowed. This is admin land.');
        }

        if (embed) {
            dao.applications.getAll(filter, orderBy, offset, limit, noCountCache, (err, appsIndex, countResult) => {
                if (err) {
                    return utils.fail(res, 500, 'getApplications: getAll failed', err);
                }
                appsIndex.forEach(a => utils.normalizeRedirectUris(a));
                res.json({
                    items: appsIndex,
                    count: countResult.count,
                    count_cached: countResult.cached,
                    offset: offset,
                    limit: limit
                });
            });
        } else {
            dao.applications.getIndex(offset, limit, (err, appsIndex, countResult) => {
                if (err) {
                    return utils.fail(res, 500, 'getApplications: getIndex failed', err);
                }
                res.json({
                    items: appsIndex,
                    count: countResult.count,
                    count_cached: countResult.cached,
                    offset: offset,
                    limit: limit
                });
            });
        }
    });
};

applications.getApplication = function (app, res, loggedInUserId, appId) {
    debug('getApplication(): ' + appId);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getApplication: Could not load user.', err);
        }
        if (!userInfo) {
            return utils.fail(res, 403, 'Not allowed. User invalid.');
        }
        dao.applications.getById(appId, (err, appInfo) => {
            if (err) {
                return utils.fail(res, 500, 'getApplication: Loading application failed', err);
            }
            if (!appInfo) {
                return utils.fail(res, 404, 'Not found: ' + appId);
            }

            const access = applications.getAllowedAccess(app, appInfo, userInfo);

            if (access == accessFlags.NONE) {
                return utils.fail(res, 403, 'Not allowed.');
            }
            appInfo._links = {
                self: { href: `/applications/${appId}` }
            };
            for (let o = 0; o < appInfo.owners.length; ++o) {
                const owner = appInfo.owners[o];
                owner._links = {
                    user: {
                        href: `/users/${owner.userId}`
                    }
                };
            }
            if (access == accessFlags.ADMIN) {
                // Add some more links if you're Admin
                appInfo._links.addOwner = { href: '/applications/' + appId + '/owners', method: 'POST' };
                // If we have more than one owner, we may allow deleting
                if (appInfo.owners.length > 1) {
                    // More than one with role "owner"?
                    let ownerCount = 0;
                    for (let i = 0; i < appInfo.owners.length; ++i) {
                        if (ownerRoles.OWNER == appInfo.owners[i].role) {
                            ownerCount++;
                        }
                    }
                    for (let i = 0; i < appInfo.owners.length; ++i) {
                        if (appInfo.owners[i].role != ownerRoles.OWNER ||
                            ownerCount > 1) {
                            if (!appInfo.owners[i]._links) {
                                appInfo.owners[i]._links = {};
                            }
                            appInfo.owners[i]._links.deleteOwner = {
                                href: '/applications/' + appId + '/owners', method: 'DELETE'
                            };
                        }
                    }
                }
                appInfo._links.addSubscription = { href: '/applications/' + appId + '/subscriptions', method: 'POST' };
                appInfo._links.deleteApplication = { href: '/applications/' + appId, method: 'DELETE' };
                appInfo._links.patchApplication = { href: '/applications/' + appId, method: 'PATCH' };
            }
            utils.normalizeRedirectUris(appInfo);
            res.json(appInfo);
        });
    });
};

function checkRedirectUris(redirectUri, redirectUris, isPatch) {
    if (redirectUri && !isValidRedirectUri(redirectUri)) {
        return { redirectValid: false, redirectMessage: `redirectUri ${redirectUri} is not valid.` };
    }
    if (redirectUris) {
        if (!Array.isArray(redirectUris)) {
            return { redirectValid: false, redirectMessage: 'redirectUris is not an array' };
        }
        const tmpUris = redirectUris;
        redirectUris = [];
        for (let i = 0; i < tmpUris.length; ++i) {
            let ru = tmpUris[i];
            if (typeof (ru) !== 'string') {
                return { redirectValid: false, redirectMessage: 'property redirectUris contains a non-string value' };
            }
            ru = ru.trim();
            if (ru === '') {
                continue;
            }
            if (!isValidRedirectUri(ru)) {
                return { redirectValid: false, redirectMessage: `redirectUri ${ru} is not valid.` };
            }
            redirectUris.push(ru);
        }
        if (redirectUris.length == 0) {
            // Treat empty arrays as null please (see below)
            redirectUris = null;
        }
    }
    let returnUri;
    let returnUris;
    if (!redirectUri && !redirectUris) {
        returnUri = isPatch ? null : '';
        returnUris = isPatch ? null : [];
    } else if (redirectUri && !redirectUris) {
        returnUri = redirectUri;
        returnUris = [redirectUri];
    } else if ((!redirectUri && redirectUris) || (redirectUri && redirectUris)) {
        // If we're here, we know that redirectUris has at least one entry
        // And that first entry "wins"
        returnUri = redirectUris[0];
        returnUris = redirectUris;
    }
    return { redirectValid: true, redirectUri: returnUri, redirectUris: returnUris };
}

applications.createApplication = function (app, res, loggedInUserId, appCreateInfo) {
    debug('createApplication(): loggedInUserId: ' + loggedInUserId);
    debug(appCreateInfo);
    const appId = appCreateInfo.id.trim();
    // Load user information
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'createApplication: Could not load user.', err);
        }
        if (!userInfo) {
            return utils.fail(res, 403, 'Not allowed. User invalid.');
        }
        if (!userInfo.validated) {
            return utils.fail(res, 403, 'Not allowed. Email address not validated.');
        }
        const { redirectValid, redirectMessage, redirectUri, redirectUris } = checkRedirectUris(appCreateInfo.redirectUri, appCreateInfo.redirectUris, false /* isPatch */);
        if (!redirectValid) {
            return utils.fail(res, 400, redirectMessage);
        }
        debug(`createApplication: resolved redirectUris: ${redirectUri}, ${JSON.stringify(redirectUris)}`);
        if (!appCreateInfo.name || appCreateInfo.name.length < 1) {
            return utils.fail(res, 400, 'Friendly name of application cannot be empty.');
        }
        if (!utils.isValidApplicationId(appId)) {
            return utils.fail(res, 400, utils.invalidApplicationIdMessage());
        }
        if (appId.length < 4 || appId.length > 50) {
            return utils.fail(res, 400, 'Invalid application ID, must have at least 4, max 50 characters.');
        }
        if (!applications.checkValidClientType(appCreateInfo)) {
            return utils.fail(res, 400, `Invalid clientType, must be one of "${daoUtils.ClientType.Confidential}", "${daoUtils.ClientType.Public_SPA}" or "${daoUtils.ClientType.Public_Native}"`);
        }

        const newAppInfo = {
            id: appId,
            name: appCreateInfo.name.substring(0, 128),
            redirectUri: redirectUri,
            redirectUris: redirectUris,
            confidential: !!appCreateInfo.confidential,
            clientType: appCreateInfo.clientType,
            mainUrl: appCreateInfo.mainUrl
        };
        if (appCreateInfo.description) {
            newAppInfo.description = appCreateInfo.description.substring(0, APP_MAX_LENGTH_DESCRIPTION);
        }

        dao.applications.create(newAppInfo, userInfo.id, (err, createdAppInfo) => {
            if (err) {
                return utils.fail(res, 500, 'createApplication: DAO create failed', err);
            }

            res.status(201).json(createdAppInfo);

            // Save to webhooks
            webhooks.logEvent(app, {
                action: webhooks.ACTION_ADD,
                entity: webhooks.ENTITY_APPLICATION,
                data: {
                    applicationId: appId,
                    userId: userInfo.id
                }
            }); // logEvent
        });
    });
};

applications.patchApplication = function (app, res, loggedInUserId, appId, appPatchInfo) {
    debug('patchApplication(): ' + appId);
    debug(appPatchInfo);

    dao.applications.getById(appId, (err, appInfo) => {
        if (err) {
            return utils.fail(res, 500, 'patchApplication: Loading app failed', err);
        }
        if (!appInfo) {
            return utils.fail(res, 404, 'Not found: ' + appId);
        }
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'patchApplication: Could not load user.', err);
            }
            if (!userInfo) {
                return utils.fail(res, 403, 'Not allowed. User invalid.');
            }

            const access = applications.getAllowedAccess(app, appInfo, userInfo);
            if (!((accessFlags.ADMIN & access) || (accessFlags.COLLABORATOR & access))) {
                return utils.fail(res, 403, 'Not allowed, not sufficient rights to application.');
            }
            if (appId != appPatchInfo.id) {
                return utils.fail(res, 400, 'Changing application ID is not allowed. Sorry.');
            }
            const { redirectValid, redirectMessage, redirectUri, redirectUris } = checkRedirectUris(appPatchInfo.redirectUri, appPatchInfo.redirectUris, true /* isPatch */);
            if (!redirectValid) {
                return utils.fail(res, 400, redirectMessage);
            }

            // Update app
            if (appPatchInfo.name) {
                appInfo.name = appPatchInfo.name.substring(0, 128);
            }
            if (appPatchInfo.description) {
                appInfo.description = appPatchInfo.description.substring(0, APP_MAX_LENGTH_DESCRIPTION);
            }
            if (redirectUri) {
                appInfo.redirectUri = redirectUri;
            }
            if (redirectUris) {
                appInfo.redirectUris = redirectUris;
            }
            if (appPatchInfo.confidential !== undefined) {
                appInfo.confidential = !!appPatchInfo.confidential;
            }
            if (appPatchInfo.clientType !== undefined) {
                appInfo.clientType = appPatchInfo.clientType;
            }
            if (!applications.checkValidClientType(appInfo)) {
                return utils.fail(res, 400, `Invalid clientType, must be one of "${daoUtils.ClientType.Confidential}", "${daoUtils.ClientType.Public_SPA}" or "${daoUtils.ClientType.Public_Native}"`);
            }

            // And persist
            dao.applications.save(appInfo, loggedInUserId, (err, updatedAppInfo) => {
                if (err) {
                    return utils.fail(res, 500, 'patchApplication: DAO save failed', err);
                }
                res.json(updatedAppInfo);

                // Fire off webhook
                webhooks.logEvent(app, {
                    action: webhooks.ACTION_UPDATE,
                    entity: webhooks.ENTITY_APPLICATION,
                    data: {
                        applicationId: appId,
                        userId: userInfo.id
                    }
                });
            });

        });
    });
};

applications.deleteApplication = function (app, res, loggedInUserId, appId) {
    debug('deleteApplication(): ' + appId);
    dao.applications.getById(appId, (err, appInfo) => {
        if (err) {
            return utils.fail(res, 500, 'deleteApplication: Loading app failed', err);
        }
        if (!appInfo) {
            return res.status(404).jsonp({ message: 'Not found: ' + appId });
        }
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'deleteApplication: Could not load user.', err);
            }
            if (!userInfo) {
                return utils.fail(res, 403, 'Not allowed. User invalid.');
            }

            const access = applications.getAllowedAccess(app, appInfo, userInfo);

            // Only let Owners and Admins do that
            if (!(accessFlags.ADMIN & access)) {
                return utils.fail(res, 403, 'Not allowed. Only Owners and Admins can delete an Application.');
            }

            dao.subscriptions.getByAppId(appId, (err, appSubs) => {
                if (err) {
                    return utils.fail(res, 500, 'deleteApplication: DAO get subscriptions failed', err);
                }

                dao.applications.delete(appId, loggedInUserId, (err) => {
                    if (err) {
                        return utils.fail(res, 500, 'deleteApplication: Failed deleting application.', err);
                    }

                    res.status(204).jsonp({ message: 'Deleted.' });

                    webhooks.logEvent(app, {
                        action: webhooks.ACTION_DELETE,
                        entity: webhooks.ENTITY_APPLICATION,
                        data: {
                            applicationId: appId,
                            userId: userInfo.id,
                            subscriptions: appSubs
                        }
                    });
                });
            });
        });
    });
};

applications.addOwner = function (app, res, loggedInUserId, appId, ownerCreateInfo) {
    debug('addOwner()');
    debug(ownerCreateInfo);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'addOwner: Could not load user.', err);
        }
        if (!userInfo) {
            return utils.fail(res, 403, 'Not allowed. User invalid.');
        }
        dao.applications.getById(appId, (err, appInfo) => {
            if (err) {
                return utils.fail(res, 500, 'addOwner: Loading app failed', err);
            }
            if (!appInfo) {
                return res.status(404).jsonp({ message: 'Not found: ' + appId });
            }

            const access = applications.getAllowedAccess(app, appInfo, userInfo);
            // We want Admin Access for this
            if (!(accessFlags.ADMIN & access)) {
                return utils.fail(res, 403, 'Not allowed. Only Owners and Admins may add owners.');
            }

            const email = ownerCreateInfo.email;
            const role = ownerCreateInfo.role;

            users.loadUserByEmail(app, email, (err, userToAdd) => {
                if (err) {
                    return utils.fail(res, 500, 'addOwner: loadUserByEmail failed.', err);
                }
                const generic400Error = `Bad request. Invalid role or user with given email address not found (${email}).`;
                if (!userToAdd) {
                    return utils.fail(res, 400, generic400Error);
                }
                if (!(ownerRoles.OWNER == role ||
                    ownerRoles.COLLABORATOR == role ||
                    ownerRoles.READER == role)) {
                    return utils.fail(res, 400, generic400Error);
                }

                // Does this user already know this application?
                for (let i = 0; i < userToAdd.applications.length; ++i) {
                    if (userToAdd.applications[i].id == appId) {
                        return utils.fail(res, 409, 'Bad request. Owner is already registered for this application.');
                    }
                }

                dao.applications.addOwner(appId, userToAdd.id, role, loggedInUserId, (err, updatedAppInfo) => {
                    if (err) {
                        return utils.fail(res, 500, 'addOwner: DAO addOwner failed', err);
                    }

                    // Return updated appInfo
                    res.status(201).json(updatedAppInfo);

                    // Webhook
                    webhooks.logEvent(app, {
                        action: webhooks.ACTION_ADD,
                        entity: webhooks.ENTITY_OWNER,
                        data: {
                            applicationId: appId,
                            userId: loggedInUserId,
                            addedUserId: userToAdd.id,
                            role: role
                        }
                    });
                });
            });
        });
    });
};

applications.deleteOwner = function (app, res, loggedInUserId, appId, userEmail) {
    debug('deleteOwner(): ' + appId + ', email: ' + userEmail);
    dao.applications.getById(appId, (err, appInfo) => {
        if (err) {
            return utils.fail(res, 500, 'deleteOwner: Loading app failed', err);
        }
        if (!appInfo) {
            return res.status(404).jsonp({ message: 'Not found: ' + appId });
        }
        users.loadUser(app, loggedInUserId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'deleteOwner: loadUser failed.', err);
            }
            if (!userInfo) {
                return res.status(403).jsonp({ message: 'Not allowed. User invalid.' });
            }

            const access = applications.getAllowedAccess(app, appInfo, userInfo);
            // We want Admin Access for this
            if (!(accessFlags.ADMIN & access)) {
                return res.status(403).jsonp({ message: 'Not allowed. Only Owners and Admins may delete owners.' });
            }

            users.loadUserByEmail(app, userEmail, (err, userToDelete) => {
                if (err) {
                    return utils.fail(res, 500, 'deleteOwner: loadUserByEmail failed', err);
                }
                if (!userToDelete) {
                    return res.status(400).jsonp({ message: 'Bad request. User with email "' + userEmail + '" not found."' });
                }
                // Does this user know this application?
                let index = -1;
                for (let i = 0; i < userToDelete.applications.length; ++i) {
                    if (userToDelete.applications[i].id == appId) {
                        // Yes, found it
                        index = i;
                        break;
                    }
                }

                // In case we don't have this user for this application
                if (index < 0) {
                    return res.json(appInfo);
                }

                // Is it the last owner?
                if (appInfo.owners.length == 1) {
                    return utils.fail(res, 409, 'Conflict. Can not delete last owner of application.');
                }

                dao.applications.deleteOwner(appId, userToDelete.id, loggedInUserId, (err, updatedAppInfo) => {
                    if (err) {
                        return utils.fail(res, 500, 'deleteOwner: DAO deleteOwner failed', err);
                    }
                    res.json(updatedAppInfo);

                    // Webhook
                    webhooks.logEvent(app, {
                        action: webhooks.ACTION_DELETE,
                        entity: webhooks.ENTITY_OWNER,
                        data: {
                            applicationId: appId,
                            userId: loggedInUserId,
                            deletedUserId: userToDelete.id
                        }
                    });
                });
            });
        });
    });
};

applications.getRoles = function (app, res) {
    debug('getRoles()');
    return res.json([
        {
            role: ownerRoles.OWNER,
            desc: 'Administrator, may change all aspects of the Application'
        },
        {
            role: ownerRoles.COLLABORATOR,
            desc: 'Collaborator, may subscribe and unsubscribe to APIs for the application, but may not add or delete owners.'
        },
        {
            role: ownerRoles.READER,
            desc: 'Reader, may see all aspects of an application, but not change anything.'
        }
    ]);
};

module.exports = applications;
