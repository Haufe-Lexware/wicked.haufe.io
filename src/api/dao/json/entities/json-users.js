'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:users');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt-nodejs');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class JsonUsers {

    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getById(userId, callback) {
        debug('getById()');
        this.jsonUtils.checkCallback(callback);
        let userInfo;
        try {
            userInfo = this.loadUser(userId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, userInfo); // may be null
    }

    getByEmail(email, callback) {
        debug('getByEmail()');
        this.jsonUtils.checkCallback(callback);
        let userInfo;
        try {
            userInfo = this.loadUserByEmail(email);
        } catch (err) {
            return callback(err);
        }
        return callback(null, userInfo); // may be null
    }

    save(userInfo, savingUserId, callback) {
        debug('save()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.saveUser(userInfo, savingUserId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    create(userCreateInfo, callback) {
        debug('create()');
        this.jsonUtils.checkCallback(callback);
        let freshUser;
        try {
            freshUser = this.createUser(userCreateInfo);
        } catch (err) {
            return callback(err);
        }
        return callback(null, freshUser);
    }

    delete(userId, deletingUserId, callback) {
        debug('delete()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteUser(userId, deletingUserId);
        } catch (err) {
            return callback(err);
        }
        callback(null);
    }

    getIndex(offset, limit, callback) {
        debug('getIndex()');
        this.jsonUtils.checkCallback(callback);
        let userIndex;
        try {
            userIndex = this.getIndexSync(offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, userIndex.rows, { count: userIndex.count, cached: false });
    }

    getCount(callback) {
        debug('getCount()');
        this.jsonUtils.checkCallback(callback);
        let userIndex;
        try {
            userIndex = this.loadUserIndex();
        } catch (err) {
            return callback(err);
        }
        return callback(null, userIndex.length);
    }

    getShortInfoByEmail(email, callback) {
        debug('getShortInfoByEmail()');
        this.jsonUtils.checkCallback(callback);
        let shortInfo;
        try {
            shortInfo = this.getShortInfoByEmailSync(email);
        } catch (err) {
            return callback(err);
        }
        return callback(null, shortInfo);
    }

    getShortInfoByCustomId(customId, callback) {
        debug('getShortInfoByCustomId()');
        this.jsonUtils.checkCallback(callback);
        let shortInfo;
        try {
            shortInfo = this.getShortInfoByCustomIdSync(customId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, shortInfo);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    loadUser(userId) {
        debug('loadUser(): ' + userId);
        if (!userId) {
            return null;
        }
        const userDir = path.join(this.jsonUtils.getDynamicDir(), 'users');
        const userFileName = path.join(userDir, userId + '.json');
        if (!fs.existsSync(userFileName)) {
            return null;
        }

        //throw "users.loadUser - User not found: " + userId;
        const userInfo = JSON.parse(fs.readFileSync(userFileName, 'utf8'));

        return userInfo;
    }

    loadUserByEmail(userEmail) {
        debug('loadUserByEmail(): ' + userEmail);
        const userIndex = this.loadUserIndex();
        const email = userEmail.toLowerCase().trim();
        for (let i = 0; i < userIndex.length; ++i) {
            const userShort = userIndex[i];
            if (email == userShort.email) {
                const user = this.loadUser(userShort.id);
                if (!user) {
                    throw Error("User found in index, but could not be loaded: " + userEmail + ", id: " + userShort.id);
                }
                return user;
            }
        }
        // Not found
        return null;
    }

    saveUser(userInfo, savingUserId) {
        debug('saveUser()');

        const userDir = path.join(this.jsonUtils.getDynamicDir(), 'users');
        const userFileName = path.join(userDir, userInfo.id + '.json');

        // Need to add developer group if validated?
        daoUtils.checkValidatedUserGroup(userInfo);
        // ClientID and ClientSecret?
        // daoUtils.checkClientIdAndSecret(userInfo);

        // Check for name change (not needed when not stored separately,
        // like in Postgres or other real databases. Later it might be possible
        // to also change the email address, so let's check that as well.
        let indexChanged = false;
        const prevUser = this.loadUser(userInfo.id);
        if (prevUser && prevUser.email !== userInfo.email) {
            indexChanged = true;
        }

        userInfo.changedBy = savingUserId;
        userInfo.changedDate = utils.getUtc();

        // if (userInfo.clientId)
        //     userInfo.clientId = utils.apiEncrypt(userInfo.clientId);
        // if (userInfo.clientSecret)
        //     userInfo.clientSecret = utils.apiEncrypt(userInfo.clientSecret);

        fs.writeFileSync(userFileName, JSON.stringify(userInfo, null, 2), 'utf8');

        if (indexChanged) {
            debug('saveUser: Detected email change, updating index.');
            // We must update the index, as the name changed
            const userIndex = this.loadUserIndex();
            const userId = userInfo.id;

            for (let i = 0; i < userIndex.length; ++i) {
                if (userIndex[i].id === userId) {
                    // Use user variable, not userInfo; user has already been updated
                    userIndex[i].email = userInfo.email;
                    break;
                }
            }
            // Persist index
            this.saveUserIndex(userIndex);
        }

        return;
    }

    createUser(userCreateInfo) {
        debug('createUser()');
        const instance = this;
        return this.jsonUtils.withLockedUserIndex(function () {
            const userIndex = instance.loadUserIndex();

            // Check for email address and custom ID
            for (let i = 0; i < userIndex.length; ++i) {
                if (userCreateInfo.email && userIndex[i].email == userCreateInfo.email) {
                    throw utils.makeError(409, 'A user with the given email address already exists.');
                }
                if (userCreateInfo.customId && userIndex[i].customId) {
                    if (userCreateInfo.customId == userIndex[i].customId) {
                        throw utils.makeError(409, 'A user with the given custom ID already exists.');
                    }
                }
            }

            const newUser = Object.assign({}, userCreateInfo, { applications: [] });
            const newId = newUser.id;

            userIndex.push({
                id: newId,
                email: newUser.email,
                customId: newUser.customId,
            });

            // First push user record
            instance.saveUser(newUser, newId);

            // Then push index
            instance.saveUserIndex(userIndex);

            // Re-load the user to get the links and stuff
            const freshUser = instance.loadUser(newId);

            // Delete the password, if present
            if (freshUser.password) {
                delete freshUser.password;
            }

            return freshUser;
        });
    }

    deleteUser(userId, deletingUserId) {
        debug('deleteUser()');
        const instance = this;
        return this.jsonUtils.withLockedUserIndex(function () {
            const userIndex = instance.loadUserIndex();

            let index = -1;
            // Find user in index
            for (let i = 0; i < userIndex.length; ++i) {
                let user = userIndex[i];
                if (user.id == userId) {
                    index = i;
                    break;
                }
            }

            if (index < 0) {
                throw utils.makeError(404, 'Not found.');
            }

            // Make sure the user does not have active applications
            let user = instance.loadUser(userId);
            if (user) {
                // This shouldn't be necessary, as it's checked in the generic
                // functionality (users.js: users.deleteUser).
                if (user.applications.length > 0) {
                    throw utils.makeError(409, 'User has applications; remove user from applications first.');
                }
            } else {
                debug('User not found, but exists in index!');
                error("WARNING: User not found, but exists in index!");
            }

            // Remove from user index
            userIndex.splice(index, 1);

            // Write index (before deleting file, please, otherway around can create inconsistencies)
            instance.saveUserIndex(userIndex);

            const userDir = path.join(instance.jsonUtils.getDynamicDir(), 'users');
            const userFileName = path.join(userDir, userId + '.json');
            // Delete user JSON
            if (fs.existsSync(userFileName)) {
                fs.unlinkSync(userFileName);
            }

            return; // Yay
        });
    }

    getShortInfoByCustomIdSync(customId) {
        debug('getShortInfoByCustomIdSync()');
        const userIndex = this.loadUserIndex();
        let index = -1;
        for (let i = 0; i < userIndex.length; ++i) {
            if (userIndex[i].customId == customId) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            return null;
        }
        // throw utils.makeError(404, 'User with customId "' + customId + '" not found.');
        return userIndex[index];
    }

    getShortInfoByEmailSync(email) {
        debug('getShortInfoByEmailSync()');
        const userIndex = this.loadUserIndex();
        email = email.toLowerCase().trim();
        let index = -1;
        for (let i = 0; i < userIndex.length; ++i) {
            if (userIndex[i].email == email) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            return null;
        }
        // throw utils.makeError(404, 'User with email "' + email + '" not found.');
        return userIndex[index];
    }

    loadUserIndex() {
        debug('loadUserIndex()');
        const userDir = path.join(this.jsonUtils.getDynamicDir(), 'users');
        const userIndexFileName = path.join(userDir, '_index.json');
        return JSON.parse(fs.readFileSync(userIndexFileName, 'utf8'));
    }

    getIndexSync(offset, limit) {
        debug('getIndexSync()');
        const userIndex = this.loadUserIndex();
        return {
            rows: this.jsonUtils.pageArray(userIndex, offset, limit),
            count: userIndex.length
        };
    }

    saveUserIndex(userIndex) {
        debug('saveUserIndex()');
        debug(userIndex);
        const userDir = path.join(this.jsonUtils.getDynamicDir(), 'users');
        const userIndexFileName = path.join(userDir, '_index.json');
        fs.writeFileSync(userIndexFileName,
            JSON.stringify(userIndex, null, 2),
            'utf8');
    }
}

module.exports = JsonUsers;