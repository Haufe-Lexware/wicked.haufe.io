'use strict';

const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:users');
const passwordValidator = require('portal-env').PasswordValidator;
const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const webhooks = require('./webhooks');
const verifications = require('./verifications');
const authMiddleware = require('../auth-middleware');

const users = require('express').Router();

const dao = require('../dao/dao');
const daoUtils = require('../dao/dao-utils');

// ===== SCOPES =====

const READ = 'read_users';
const WRITE = 'write_users';

const verifyReadScope = utils.verifyScope(READ);
const verifyWriteScope = utils.verifyScope(WRITE);

// ===== ENDPOINTS =====

users.post('/', verifyWriteScope, function (req, res) {
    debug(`POST /`);
    const isMachineUser = false;
    users.createUser(req.app, res, req.apiUserId, req.body, isMachineUser);
});

// Endpoint for creating machine users, which can only be called from within the same network
// as the API, e.g. not using the Kong as API Gateway.
users.post('/machine', authMiddleware.rejectFromKong, function (req, res, next) {
    debug(`POST /machine`);
    const isMachineUser = true;
    users.createUser(req.app, res, null, req.body, isMachineUser);
});

users.get('/', verifyReadScope, function (req, res, next) {
    const { offset, limit } = utils.getOffsetLimit(req);
    if (req.query.customId) {
        users.getUserByCustomId(req.app, res, req.query.customId);
    } else if (req.query.email) {
        users.getUserByEmail(req.app, res, req.query.email);
    } else if (req.apiUserId) {
        users.getUsers(req.app, res, req.apiUserId, offset, limit);
    } else {
        res.status(403).jsonp({ message: 'Not allowed. Unauthorized.' });
    }
});

users.get('/:userId', verifyReadScope, function (req, res, next) {
    users.getUser(req.app, res, req.apiUserId, req.params.userId);
});

users.patch('/:userId', verifyWriteScope, function (req, res, next) {
    if (req.get('X-VerificationId')) {
        verifications.patchUserWithVerificationId(req.app, res, users, req.apiUserId, req.get('X-VerificationId'), req.params.userId, req.body);
    } else if (req.apiUserId) {
        users.patchUser(req.app, res, req.apiUserId, req.params.userId, req.body);
    }
});

users.delete('/:userId', verifyWriteScope, function (req, res, next) {
    users.deleteUser(req.app, res, req.apiUserId, req.params.userId);
});

users.delete('/:userId/password', verifyWriteScope, function (req, res, next) {
    users.deletePassword(req.app, res, req.apiUserId, req.params.userId);
});


// ===== IMPLEMENTATION =====

/** Returns
 * {
 *   valid: boolean,
 *   message: string
 * }
 * 
 * Checks globals.json for selected password validation strategy.
 */
users.validatePassword = function (password, passwordIsHashed) {
    if (passwordIsHashed) {
        return true;
    }
    const glob = utils.loadGlobals();
    const passwordStrategy = glob.passwordStrategy;
    return passwordValidator.validatePassword(password, passwordStrategy);
};

users.isUserIdAdmin = function (app, userId, callback) {
    debug('isUserIdAdmin()');
    if (!callback || typeof (callback) !== 'function') {
        throw utils.makeError(500, 'isUserIdAdmin: callback is null or not a function');
    }
    if (!userId) {
        return callback(null, false);
    }
    users.loadUser(app, userId, (err, user) => {
        if (err) {
            return callback(err);
        }

        return callback(null, users.isUserAdmin(app, user));
    });
};

users.isUserAdmin = function (app, userInfo) {
    debug('isUserAdmin()');
    return daoUtils.isUserAdmin(userInfo);
};

users.isUserApprover = function (app, userInfo) {
    debug('isUserApprover()');
    return daoUtils.isUserApprover(userInfo);
};

/* Does the user belong to a specific group, or is he an admin? */
users.hasUserGroup = function (app, userInfo, group) {
    debug('hasUserGroup()');
    let foundGroup = false;
    for (let i = 0; i < userInfo.groups.length; ++i) {
        if (userInfo.groups[i] == group) {
            return true;
        }
    }
    return userInfo.admin;
};

users.isActionAllowed = function (app, loggedInUserId, userId, callback) {
    debug('isActionAllowed()');
    if (!callback || typeof (callback) !== 'function') {
        throw new Error('isActionAllowed: callback is null or not a function');
    }
    // Do we have a logged in user?
    if (!loggedInUserId) {
        return callback(null, false, null);
    }
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return callback(err, false, userInfo);
        }
        if (loggedInUserId == userId) {
            return callback(null, true, userInfo);
        }
        if (!userInfo) {
            // User not found, action not allowed
            return callback(null, false, userInfo);
        }
        // Is user an admin?
        return callback(null, userInfo.admin, userInfo);
    });
};

users.loadUser = function (app, userId, callback) {
    debug('loadUser(): ' + userId);
    if (!callback || typeof (callback) !== 'function') {
        throw new Error('loadUser: callback is null or not a function');
    }
    if (!userId) {
        return callback(null, null);
    }
    return dao.users.getById(userId, (err, userInfo) => {
        if (err) {
            return callback(err);
        }
        postProcessUser(userInfo);
        return callback(null, userInfo);
    });
};

function postProcessUser(userInfo) {
    debug('postProcessUser()');
    if (userInfo) {
        userInfo.admin = daoUtils.isUserAdmin(userInfo);
        userInfo.approver = daoUtils.isUserApprover(userInfo);

        // These shouldn't be here anymore anyway, but let's delete them just in case
        delete userInfo.name;
        delete userInfo.firstName;
        delete userInfo.lastName;

        // Add generic links
        userInfo._links = {
            self: { href: '/users/' + userInfo.id },
            groups: { href: '/groups' }
        };

        if (userInfo.clientId) {
            delete userInfo.clientId;
        }
        if (userInfo.clientSecret) {
            delete userInfo.clientSecret;
        }
    }
}


users.loadUserByEmail = function (app, userEmail, callback) {
    debug('loadUserByEmail(): ' + userEmail);
    if (!callback || typeof (callback) !== 'function') {
        throw new Error('loadUser: callback is null or not a function');
    }

    return dao.users.getByEmail(userEmail, callback);
};

users.saveUser = function (app, userInfo, userId, callback) {
    debug('saveUser()');
    debug(userInfo);
    if (!callback || typeof (callback) !== 'function') {
        throw new Error('loadUser: callback is null or not a function');
    }

    const userInfoToSave = Object.assign({}, userInfo);
    if (userInfoToSave.name) {
        delete userInfoToSave.name;
    }
    if (userInfoToSave.admin) {
        delete userInfoToSave.admin;
    }
    if (userInfoToSave.clientId) {
        delete userInfoToSave.clientId;
    }
    if (userInfoToSave.clientSecret) {
        delete userInfoToSave.clientSecret;
    }
    if (userInfoToSave._links) {
        delete userInfoToSave._links;
    }

    dao.users.save(userInfoToSave, userId, callback);
};

users.createUser = function (app, res, loggedInUserId, userCreateInfo, isMachineUser) {
    debug(`createUser(${loggedInUserId}, ..., ${isMachineUser})`);
    // Only admins are allowed to do this (for now)
    if (!isMachineUser) {
        users.loadUser(app, loggedInUserId, (err, creatingUserInfo) => {
            if (err) {
                return utils.fail(res, 403, 'Users: Could not load calling user', err);
            }
            if (!creatingUserInfo.admin) {
                return utils.fail(res, 403, 'Only admins are allowed to create users.');
            }

            // Now fire off the user creation
            createUserImpl(app, res, userCreateInfo);
        });
    } else {
        // Slightly other checks here...
        if (!userCreateInfo.customId) {
            return utils.fail(res, 400, 'Machines users must have a custom ID');
        }
        if (!userCreateInfo.customId.startsWith('internal:')) {
            return utils.fail(res, 400, 'Machine user customId must start with "internal:"');
        }
        if (userCreateInfo.password) {
            return utils.fail(res, 400, 'Machine users must not have a password');
        }
        // Off you go...
        createUserImpl(app, res, userCreateInfo);
    }
};

const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
function createUserImpl(app, res, userCreateInfo) {
    debug('createUserImpl(), user create info:');
    debug(userCreateInfo);
    if (!userCreateInfo.email && !userCreateInfo.customId) {
        return res.status(400).jsonp({ message: 'Bad request. User needs email address.' });
    }
    if (userCreateInfo.password) {
        const passwordResult = users.validatePassword(userCreateInfo.password, userCreateInfo.passwordIsHashed);
        if (!passwordResult.valid) {
            return res.status(400).jsonp({ message: passwordResult.message });
        }
    }
    if (userCreateInfo.email) {
        userCreateInfo.email = userCreateInfo.email.toLowerCase();
    }
    if (!emailRegex.test(userCreateInfo.email)) {
        return res.status(400).json({ message: 'Email address invalid (not RFC 5322 compliant)' });
    }

    // Name is no longer part of the user, this goes into registrations!
    delete userCreateInfo.name;
    delete userCreateInfo.firstName;
    delete userCreateInfo.firstname;
    delete userCreateInfo.lastName;
    delete userCreateInfo.lastname;

    const newId = userCreateInfo.id || utils.createRandomId();
    let password = null;
    let mustChangePassword = false;
    if (userCreateInfo.password) {
        if (userCreateInfo.passwordIsHashed) {
            password = userCreateInfo.password;
        } else {
            password = utils.makePasswordHash(userCreateInfo.password);
        }
        mustChangePassword = userCreateInfo.mustChangePassword;
    }
    if (!userCreateInfo.groups) {
        userCreateInfo.groups = [];
    }

    // The "validated" property is stored as-is, we trust the calling
    // user that it's prefilled correctly. Same goes for the user groups;
    // if the calling user, which is assumed to be an Admin user, says the
    // new user is an Admin, the user will be an Admin.
    const newUser = {
        id: newId,
        customId: userCreateInfo.customId,
        validated: userCreateInfo.validated,
        email: userCreateInfo.email,
        password: password,
        mustChangePassword: mustChangePassword,
        groups: userCreateInfo.groups
    };

    dao.users.create(newUser, (err, createdUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'createUser: Could not create user', err);
        }

        // Reload to get links and things
        users.loadUser(app, newId, (err, freshUser) => {
            if (err) {
                return utils.fail(res, 500, 'createUser: Could not load user after creating', err);
            }
            if (!freshUser) {
                return utils.fail(res, 500, `createUser: Newly created user with id ${newId} could not be loaded (not found)`);
            }

            // Don't return the password hash
            if (freshUser.password) {
                delete freshUser.password;
            }
            res.status(201).json(freshUser);

            webhooks.logEvent(app, {
                action: webhooks.ACTION_ADD,
                entity: webhooks.ENTITY_USER,
                data: {
                    userId: freshUser.id,
                    email: userCreateInfo.email,
                    customId: userCreateInfo.customId
                }
            });
        });
    });
}

users.getUser = function (app, res, loggedInUserId, userId) {
    debug('getUser(): ' + userId);
    users.isActionAllowed(app, loggedInUserId, userId, (err, isAllowed) => {
        if (err) {
            return utils.fail(res, 500, 'getUser: isActionAllowed returned an error.', err);
        }
        if (!isAllowed) {
            return res.status(403).jsonp({ message: 'Not allowed.' });
        }
        users.loadUser(app, userId, (err, user) => {
            if (err) {
                return utils.fail(res, 500, 'getUser: Could not load user.', err);
            }
            if (!user) {
                return res.status(404).jsonp({ message: 'Not found.' });
            }
            if (user.password) {
                delete user.password;
                user.hasPassword = true;
            }
            // You can't retrieve clientId and clientSecret for other users
            if (userId != loggedInUserId) {
                if (user.clientId) {
                    delete user.clientId;
                }
                if (user.clientSecret) {
                    delete user.clientSecret;
                }
            }

            res.json(user);
        });
    });
};

users.getUsers = function (app, res, loggedInUserId, offset, limit) {
    debug('getUsers()');
    users.loadUser(app, loggedInUserId, (err, user) => {
        if (err) {
            return utils.fail(res, 500, 'getUsers: loadUser failed', err);
        }
        if (!user) {
            return utils.fail(res, 400, 'Bad request. Unknown user.');
        }
        if (!user.admin) {
            return utils.fail(res, 403, 'Not allowed. Only admins can retrieve user list.');
        }

        dao.users.getIndex(offset, limit, (err, userIndex, countResult) => {
            if (err) {
                return utils.fail(res, 500, 'getUsers: DAO getIndex failed.', err);
            }
            res.json({
                items: userIndex,
                count: countResult.count,
                count_cached: countResult.cached,
                offset: offset,
                limit: limit
            });
        });
    });
};

users.getUserByCustomId = function (app, res, customId) {
    debug('getUserByCustomId(): ' + customId);

    // No security check here, only retrieves short info
    dao.users.getShortInfoByCustomId(customId, (err, shortInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getUserByCustomId: DAO getShortInfoByCustomId failed.', err);
        }
        if (!shortInfo) {
            return utils.fail(res, 404, `User with custom ID ${customId} not found.`);
        }
        res.json([shortInfo]);
    });
};

users.getUserByEmail = function (app, res, email) {
    debug('getUserByEmail(): ' + email);

    // No security check here, only retrieves short info
    dao.users.getShortInfoByEmail(email, (err, shortInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getUserByEmail: DAO getShortInfoByEmail failed.', err);
        }
        if (!shortInfo) {
            return utils.fail(res, 404, `User with email ${email} not found.`);
        }
        res.json([shortInfo]);
    });
};

function comparePasswords(password, userInfo, callback) {
    debug(`comparePasswords()`);
    if (bcrypt.compareSync(password, userInfo.password)) {
        return callback(null);
    }
    // Fallback to Meteor type checking
    debug('comparePasswords(): Falling back to Meteor type matching');
    const hash = crypto.createHash('sha256');
    const passwordSha256 = hash.update(password).digest('hex');
    if (bcrypt.compareSync(passwordSha256, userInfo.password)) {
        debug('comparePasswords(): Meteor style password matching succeeded; updating user.');
        userInfo.password = utils.makePasswordHash(password);
        dao.users.save(userInfo, userInfo.id, function (err) {
            if (err) {
                error(`comparePasswords(): Did not manage to update user password of user with id ${userInfo.id} (${userInfo.email})`);
                error(err);
            }
            return callback(null);
        });
    } else {
        debug('comparePasswords(): Failed, passwords do not match.');
        return callback(new Error('Could not verify password.'));
    }
}

users.getUserByEmailAndPassword = function (app, res, loggedInUserId, email, password) {
    debug('getUserByEmailAndPassword(): ' + email + ', password=***');
    users.loadUser(app, loggedInUserId, (err, loggedInUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'Could not verify logged in user.', err);
        }
        if (!loggedInUserInfo || (loggedInUserInfo && !loggedInUserInfo.admin)) {
            return utils.fail(res, 403, 'Not allowed. Only admin users can verify a user by email and password.');
        }
        users.loadUserByEmail(app, email, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'getUserByEmailAndPassword: loadUserByEmail failed.', err);
            }
            if (!userInfo) {
                return utils.fail(res, 404, 'User not found or password not correct.');
            }
            if (!userInfo.password) {
                return utils.fail(res, 400, 'Bad request. User has no defined password.');
            }
            comparePasswords(password, userInfo, function (err) {
                if (err) {
                    return utils.fail(res, 403, 'Password not correct or user not found.');
                }
                delete userInfo.password;
                res.json([userInfo]);
            });
        });
    });
};

users.patchUser = function (app, res, loggedInUserId, userId, userInfo) {
    debug('patchUser(): ' + userId);
    debug(userInfo);
    users.isActionAllowed(app, loggedInUserId, userId, (err, isAllowed, loggedInUserInfo) => {
        if (err) {
            return utils.fail(res, 500, 'patchUser: isActionAllowed failed.', err);
        }
        if (!isAllowed) {
            return utils.fail(res, 403, 'Not allowed');
        }
        if (userInfo.password &&
            !userInfo.forcePasswordUpdate) {

            const passwordResult = users.validatePassword(userInfo.password, userInfo.passwordIsHashed);
            if (!passwordResult.valid) {
                return utils.fail(res, 400, passwordResult.message);
            }
        }
        delete userInfo.forcePasswordUpdate;

        users.loadUser(app, userId, (err, user) => {
            if (err) {
                return utils.fail(res, 500, 'patchUser: loadUser failed', err);
            }

            if (!user) {
                return utils.fail(res, 404, 'Not found.');
            }
            if (userInfo.customId && userInfo.customId !== user.customId) {
                return utils.fail(res, 400, 'Bad request. Changing custom ID is not allowed.');
            }
            if (user.password &&
                userInfo.email &&
                (userInfo.email != user.email)) {
                return utils.fail(res, 400, 'Bad request. You can not change the email address of a username with a local password.');
            }

            // Groups can only be changed on behalf of an Admin
            if (userInfo.groups &&
                !loggedInUserInfo.admin) {
                return utils.fail(res, 403, 'Not allowed. Only admins can change a user\'s groups.');
            }
            if (userInfo.groups) {
                user.groups = userInfo.groups;
            }
            if (userInfo.email) {
                user.email = userInfo.email;
            }
            if (userInfo.hasOwnProperty('validated') &&
                userInfo.validated !== user.validated &&
                !loggedInUserInfo.admin) {
                return utils.fail(res, 403, 'Not allowed. Only admins can change a user\'s validated email status.');
            }
            if (userInfo.hasOwnProperty('validated')) {
                user.validated = userInfo.validated;
            }
            if (userInfo.password) {
                // If password is already hashed, leave as is.
                if (!userInfo.passwordIsHashed) {
                    user.password = utils.makePasswordHash(userInfo.password);
                } else {
                    user.password = userInfo.password;
                }
            }
            if (userInfo.hasOwnProperty('mustChangePassword')) {
                if (!loggedInUserInfo.admin) {
                    return utils.fail(res, 403, 'Not allowed. Only admins can update the "mustChangePassword" property.');
                }
                user.mustChangePassword = userInfo.mustChangePassword;
            }

            dao.users.save(user, loggedInUserId, (err) => {
                if (err) {
                    return utils.fail(res, 500, 'patchUser: DAO returned an error', err);
                }
                webhooks.logEvent(app, {
                    action: webhooks.ACTION_UPDATE,
                    entity: webhooks.ENTITY_USER,
                    data: {
                        updatedUserId: userId,
                        userId: loggedInUserId
                    }
                });
                users.loadUser(app, user.id, (err, patchedUser) => {
                    if (err) {
                        return utils.fail(res, 500, 'patchUser: loadUser after patch failed', err);
                    }
                    // Delete password, if present
                    if (patchedUser.password) {
                        delete patchedUser.password;
                    }
                    res.json(patchedUser);
                });
            });
        });
    });
};

users.deleteUser = function (app, res, loggedInUserId, userId) {
    debug('deleteUser(): ' + userId);
    users.isActionAllowed(app, loggedInUserId, userId, (err, isAllowed) => {
        if (err) {
            return utils.fail(res, 500, 'deleteUser: isActionAllowed failed.', err);
        }
        if (!isAllowed) {
            return res.status(403).jsonp({ message: 'Not allowed.' });
        }

        // Make sure the user doesn't have any applications; if that's the case,
        // we will not allow deleting.
        dao.users.getById(userId, (err, userInfo) => {
            if (err) {
                return utils.fail(res, 500, 'deleteUser: DAO failed to load user.', err);
            }
            if (!userInfo) {
                return utils.fail(res, 404, 'User not found');
            }
            if (userInfo.applications && userInfo.applications.length > 0) {
                return utils.fail(res, 409, 'User has applications; remove user from applications first.');
            }

            // OK, now we allow deletion.
            dao.users.delete(userId, loggedInUserId, (err) => {
                if (err) {
                    return utils.fail(res, 500, 'deleteUser: DAO failed to delete user.', err);
                }

                res.status(204).json('');

                webhooks.logEvent(app, {
                    action: webhooks.ACTION_DELETE,
                    entity: webhooks.ENTITY_USER,
                    data: {
                        deletedUserId: userId,
                        userId: loggedInUserId
                    }
                });
            });
        });
    });
};

users.deletePassword = function (app, res, loggedInUserId, userId) {
    debug('deletePassword(): ' + userId);
    users.loadUser(app, loggedInUserId, (err, adminUser) => {
        if (err) {
            return utils.fail(res, 500, 'deletePassword: loadUser (loggedInUserId) failed.', err);
        }
        if (!adminUser) {
            return utils.fail(res, 400, 'Bad request. Unknown user.');
        }
        if (!adminUser.admin) {
            return utils.fail(res, 403, 'Not allowed. Only admins can delete passwords.');
        }
        users.loadUser(app, userId, (err, user) => {
            if (err) {
                return utils.fail(res, 500, 'deletePassword: loadUser (userId) failed.', err);
            }
            if (!user) {
                return res.status(404).jsonp({ message: 'User not found.' });
            }
            if (!user.password) {
                return res.status(204).send('');
            }
            delete user.password;
            users.saveUser(app, user, loggedInUserId, (err) => {
                if (err) {
                    return utils.fail(res, 500, 'deletePassword: saveUser failed.', err);
                }
                return res.status(204).send('');
            });
        });
    });
};

module.exports = users;
