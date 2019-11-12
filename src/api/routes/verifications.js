'use strict';

const utils = require('./utils');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:verifications');
const bcrypt = require('bcrypt-nodejs');
const dao = require('../dao/dao');

const webhooks = require('./webhooks');

const verifications = require('express').Router();
verifications.setup = function (users) {
    verifications._usersModule = users;
};

// ===== SCOPES =====

const READ_SCOPE = 'read_verifications';
const WRITE_SCOPE = 'write_verifications';

const verifyReadScope = utils.verifyScope(READ_SCOPE);
const verifyWriteScope = utils.verifyScope(WRITE_SCOPE);

// ===== ENDPOINTS =====

verifications.post('/', verifyWriteScope, function (req, res, next) {
    verifications.addVerification(req.app, res, verifications._usersModule, req.apiUserId, req.body);
});

verifications.get('/:verificationId', verifyReadScope, function (req, res, next) {
    verifications.getVerification(req.app, res, verifications._usersModule, req.apiUserId, req.params.verificationId);
});

verifications.delete('/:verificationId', verifyWriteScope, function (req, res, next) {
    verifications.deleteVerification(req.app, res, verifications._usersModule, req.apiUserId, req.params.verificationId);
});

verifications.get('/', verifyReadScope, function (req, res, next) {
    verifications.getVerifications(req.app, res, verifications._usersModule, req.apiUserId);
});

// ===== IMPLEMENTATION =====

verifications.EXPIRY_SECONDS = 3600;

verifications.addVerification = function (app, res, users, loggedInUserId, body) {
    debug('addVerification()');
    debug(body);
    if (!loggedInUserId) {
        return utils.fail(res, 403, 'Only admins can add verifications (not logged in)');
    }
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'Add verifications: Could not load logged in user', err);
        }
        if (!loggedInUserInfo ||
            !loggedInUserInfo.admin) {
            return utils.fail(res, 403, 'Only admins can add verifications');
        }

        const verificationType = body.type;
        let email = body.email;
        const verificationLink = body.link;

        if (!verificationType ||
            ("email" != verificationType &&
                "lostpassword" != verificationType)) {
            return utils.fail(res, 400, 'Unknown verification type.');
        }
        if (!verificationLink) {
            return utils.fail(res, 400, 'Verification link (property "link") is missing.');
        }
        if (verificationLink.indexOf('{{id}}') < 0) {
            return utils.fail(res, 400, 'Verification link must contain a mustache placeholder for the id: {{id}}');
        }

        let entityName = webhooks.ENTITY_VERIFICATION_LOSTPASSWORD;
        if ("email" == verificationType) {
            entityName = webhooks.ENTITY_VERIFICATION_EMAIL;
        }

        users.loadUserByEmail(app, email, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'addVerification: loadUserByEmail failed', err);
            }
            if (!userInfo) {
                return utils.fail(res, 204, 'No content');
            }
            email = email.toLowerCase().trim();
            if (userInfo.customId && "lostpassword" == verificationType) {
                return utils.fail(res, 400, 'Email address belongs to a federated user. Cannot change password as the user does not have a password. Log in using federation.');
            }

            const newVerif = {
                id: utils.createRandomId(),
                type: verificationType,
                email: email,
                userId: userInfo.id,
                link: verificationLink,
                utc: utils.getUtc(),
            };
            dao.verifications.create(newVerif, (err, persistedVerif) => {
                if (err) {
                    return utils.fail(res, 500, 'addVerification: DAO could not create verification', err);
                }

                webhooks.logEvent(app, {
                    action: webhooks.ACTION_ADD,
                    entity: entityName,
                    data: persistedVerif
                });

                res.status(204).jsonp({ message: 'No content.' });
            });
        });
    });
};

verifications.getVerifications = function (app, res, users, loggedInUserId) {
    debug('getVerifications()');
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getVerifications: loadUser failed', err);
        }
        if (!userInfo ||
            !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. Only Admins may do this.');
        }
        dao.verifications.getAll((err, verifs) => {
            if (err) {
                return utils.fail(res, 500, 'getVerifications: DAO getAll failed.', err);
            }
            return res.json(verifs);
        });
    });
};

verifications.getVerification = function (app, res, users, loggedInUserId, verificationId) {
    debug('getVerification(): ' + verificationId);
    if (!verificationId) {
        return res.status(404).jsonp({ message: 'Not found. Invalid verification ID.' });
    }
    if (!loggedInUserId) {
        return utils.fail(res, 403, 'Only admins can add verifications (not logged in)');
    }
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'Add verifications: Could not load logged in user', err);
        }
        if (!loggedInUserInfo ||
            !loggedInUserInfo.admin) {
            return utils.fail(res, 403, 'Only admins can add verifications');
        }
        dao.verifications.getById(verificationId, (err, thisVerif) => {
            if (err) {
                return utils.fail(res, 500, 'getVerification: DAO failed to get verification');
            }
            if (!thisVerif) {
                return utils.fail(res, 404, 'Verification not found');
            }
            res.json(thisVerif);
        });
    });
};

verifications.deleteVerification = function (app, res, users, loggedInUserId, verificationId) {
    debug('deleteVerification(): ' + verificationId);
    if (!verificationId) {
        return res.status(404).jsonp({ message: 'Not found. Invalid verification ID.' });
    }
    if (!loggedInUserId) {
        return utils.fail(res, 403, 'Only admins can add verifications (not logged in)');
    }
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'Add verifications: Could not load logged in user', err);
        }
        if (!loggedInUserInfo ||
            !loggedInUserInfo.admin) {
            return utils.fail(res, 403, 'Only admins can add verifications');
        }
        dao.verifications.delete(verificationId, (err, deletedVerif) => {
            if (err) {
                return utils.fail(res, 500, 'deleteVerification: DAO failed to delete verification', err);
            }

            res.status(204).send('');

            webhooks.logEvent(app, {
                action: webhooks.ACTION_DELETE,
                entity: webhooks.ENTITY_VERIFICATION,
                data: deletedVerif
            });
        });
    });
};

verifications.patchUserWithVerificationId = function (app, res, users, loggedInUserId, verificationId, userId, body) {
    debug('patchUserWithVerificationId(): ' + userId + ', verificationId: ' + verificationId);
    debug(body);
    if (!loggedInUserId) {
        return utils.fail(res, 403, 'Only admins can add verifications (not logged in)');
    }
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'Add verifications: Could not load logged in user', err);
        }
        if (!loggedInUserInfo ||
            !loggedInUserInfo.admin) {
            return utils.fail(res, 403, 'Only admins can add verifications');
        }

        dao.verifications.getById(verificationId, (err, thisVerif) => {
            if (err) {
                return utils.fail(res, 500, 'patchUserWithVerificationId: DAO could not retrieve verification', err);
            }
            if (!thisVerif) {
                return utils.fail(res, 404, 'Not found. Verification ID not found.');
            }
            if (thisVerif.userId != userId) {
                return utils.fail(res, 403, 'Not allowed. Verification ID belongs to other User ID.');
            }
            let foundPassword = false;
            let foundValidated = false;
            let foundOthers = false;
            for (let propName in body) {
                if ("password" == propName) {
                    foundPassword = true;
                } else if ("validated" == propName) {
                    foundValidated = true;
                } else {
                    foundOthers = true;
                }
            }
            if ((!foundPassword && !foundValidated) || foundOthers) {
                return utils.fail(res, 400, 'Bad request. You can only patch the password or validated property with a verification ID.');
            }
            // utils.withLockedUser(app, res, userId, function () {
            users.loadUser(app, userId, (err, userInfo) => {
                if (err) {
                    return utils.fail(res, 500, 'patchUserWithVerificationId: loadUser failed', err);
                }
                if (!userInfo) {
                    return utils.fail(res, 404, 'Cannot update User. User not found.');
                }
                if (userInfo.customId && foundPassword) {
                    return utils.fail(res, 400, 'Cannot update password of federated user. User has no password.');
                }

                if (foundPassword) {
                    userInfo.password = bcrypt.hashSync(body.password);
                }
                else if (foundValidated) {
                    userInfo.validated = body.validated;
                }

                users.saveUser(app, userInfo, userId, (err) => {
                    if (err) {
                        return utils.fail(res, 500, 'patchUserWithVerificationId: saveUser failed', err);
                    }

                    res.status(204).send('');

                    // Fire off the deletion of this verification record after it has been used
                    // for patching the user. On second thought: Don't. There is an integration test
                    // which relies on this NOT being done, so it might not be a good idea to change
                    // this.
                    // dao.verifications.delete(verificationId, (err) => {
                    //     // Ignore errors
                    //     if (err) {
                    //         error('** Could not delete verification with ID ' + verificationId);
                    //         error(err);
                    //     }
                    // });

                    if (foundPassword) {
                        webhooks.logEvent(app, {
                            action: webhooks.ACTION_PASSWORD,
                            entity: webhooks.ENTITY_USER,
                            data: {
                                userId: userInfo.id
                            }
                        });
                    } else if (foundValidated) {
                        webhooks.logEvent(app, {
                            action: webhooks.ACTION_VALIDATED,
                            entity: webhooks.ENTITY_USER,
                            data: {
                                userId: userInfo.id
                            }
                        });
                    }
                });
            });
        });
    });
};

verifications.checkExpiredRecords = function (app) {
    debug('checkExpiredRecords()');

    dao.verifications.reconcile(verifications.EXPIRY_SECONDS, (err) => {
        if (err) {
            debug('Strange behaviour, caught exception in checkExpiredRecords()');
            debug(err);
            error(err);
            return;
        }

        debug('Reconciliation finished successfully.');
    });
};

module.exports = verifications;
