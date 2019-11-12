'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:registrations');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');


class JsonRegistrations {

    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByPoolAndUser(poolId, userId, callback) {
        debug(`getByPoolAndUser(${poolId}, ${userId})`);
        this.jsonUtils.checkCallback(callback);
        let registrations;
        try {
            registrations = this.getByPoolAndUserSync(poolId, userId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, registrations.rows, { count: registrations.count, cached: false });
    }

    getByPoolAndNamespace(poolId, namespace, filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getByPoolAndNamespace(${poolId}, ${namespace}, ${filter}, ${orderBy})`);
        this.jsonUtils.checkCallback(callback);
        let registrations;
        try {
            registrations = this.getByPoolAndNamespaceSync(poolId, namespace, filter, orderBy, offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, registrations.rows, { count: registrations.count, cached: false });
    }

    getByUser(userId, callback) {
        debug(`getByUser(${userId})`);
        this.jsonUtils.checkCallback(callback);
        let regMap;
        try {
            regMap = this.getByUserSync(userId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, regMap);
    }

    upsert(poolId, userId, upsertingUserId, userData, callback) {
        debug(`upsert(${userId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.upsertSync(poolId, userId, userData);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    delete(poolId, userId, namespace, deletingUserId, callback) {
        debug(`delete(${userId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteSync(poolId, userId, namespace);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getPoolIndexFileName(poolId, namespace) {
        const regsDir = path.join(this.jsonUtils.getDynamicDir(), 'registrations');
        if (namespace) {
            return path.join(regsDir, `${poolId}_${namespace}.json`);
        }
        return path.join(regsDir, `${poolId}.json`);
    }

    loadPoolIndex(poolId, namespace) {
        const indexFileName = this.getPoolIndexFileName(poolId, namespace);
        if (fs.existsSync(indexFileName)) {
            return JSON.parse(fs.readFileSync(indexFileName, 'utf8'));
        }
        return [];
    }

    savePoolIndex(poolId, namespace, poolIndex) {
        const indexFileName = this.getPoolIndexFileName(poolId, namespace);
        fs.writeFileSync(indexFileName, JSON.stringify(poolIndex, null, 2), 'utf8');
    }

    getUserRegistrationsFileName(userId) {
        const regsDir = path.join(this.jsonUtils.getDynamicDir(), 'registrations');
        return path.join(regsDir, `${userId}.json`);
    }

    loadUserRegistrations(userId) {
        const regsFileName = this.getUserRegistrationsFileName(userId);
        if (fs.existsSync(regsFileName)) {
            return JSON.parse(fs.readFileSync(regsFileName, 'utf8'));
        }
        return [];
    }

    saveUserRegistrations(userId, userRegs) {
        const indexFileName = this.getUserRegistrationsFileName(userId);
        fs.writeFileSync(indexFileName, JSON.stringify(userRegs, null, 2), 'utf8');
    }

    static userEntryPredicate(poolId, namespace, userId) {
        return function (pi) {
            if (pi.poolId !== poolId) {
                return false;
            }
            if (namespace && pi.namespace !== namespace) {
                return false;
            }
            if (pi.userId !== userId) {
                return false;
            }
            return true;
        };
    }

    static poolEntryPredicate(poolId, namespace) {
        return function (r) {
            if (r.poolId !== poolId) {
                return false;
            }
            if (namespace && r.namespace !== namespace) {
                return false;
            }
            return true;
        };
    }

    ensurePoolIndex(poolId, namespace, userId) {
        debug(`ensurePoolIndex(${poolId}, ${namespace}, ${userId})`);
        const poolIndex = this.loadPoolIndex(poolId, namespace);
        const userEntryIndex = poolIndex.findIndex(JsonRegistrations.userEntryPredicate(poolId, namespace, userId));
        if (userEntryIndex >= 0) {
            return;
        }
        poolIndex.push({
            poolId: poolId,
            namespace: namespace,
            userId: userId
        });
        this.savePoolIndex(poolId, namespace, poolIndex);
    }

    ensureUserRegistration(poolId, namespace, userId, userData) {
        debug(`ensureUserRegistration(${userId})`);
        const userRegs = this.loadUserRegistrations(userId);
        const entryIndex = userRegs.findIndex(JsonRegistrations.poolEntryPredicate(poolId, namespace));
        userData.poolId = poolId;
        userData.namespace = namespace;
        userData.userId = userId;
        if (entryIndex >= 0) {
            // Update
            userRegs[entryIndex] = userData;
        } else {
            userRegs.push(userData);
        }
        this.saveUserRegistrations(userId, userRegs);
    }

    getByPoolUserAndNamespaceSync(poolId, namespace, userId) {
        const userRegs = this.loadUserRegistrations(userId);
        const reg = userRegs.find(JsonRegistrations.poolEntryPredicate(poolId, namespace));
        if (!reg) {
            // This shouldn't happen; if so, the indexes are out of sync.
            error(`Registrations: Missing registration for user ${userId}, pool ${poolId}, namespace ${namespace}`);
        }
        return reg;
    }

    getByPoolAndNamespaceSync(poolId, namespace, filter, orderBy, offset, limit) {
        debug(`getByPoolAndNamespaceSync(${poolId}, ${namespace}, ${JSON.stringify(filter)}, ${orderBy})`);
        // Note: All indexes are always sorted by name internally anyway,
        // so we don't have to do that here.
        const indexList = this.loadPoolIndex(poolId, namespace);
        const tmpArray = [];
        for (let i = 0; i < indexList.length; ++i) {
            const entry = indexList[i]; // contains id and name
            const userRegs = this.getByPoolAndUserSync(poolId, entry.userId);
            if (userRegs.rows.length <= 0) {
                throw utils.makeError(500, `Missing user registration for user ${entry.userId}, pool ${poolId}, namespace ${namespace}`);
            } else {
                let reg;
                if (namespace) {
                    reg = userRegs.rows.find(r => r.namespace === namespace); // jshint ignore:line
                    if (!reg) {
                        throw utils.makeError(500, `Invalid internal state: No registration for user ${entry.userId} for pool ${poolId} and namespace ${namespace}`);
                    }
                } else {
                    if (userRegs.rows.length !== 1) {
                        throw utils.makeError(500, `Invalid internal state: Multiple registrations for user ${entry.userId} for pool ${poolId}`);
                    }
                    reg = userRegs.rows[0];
                }
                tmpArray.push(reg);
            }
        }

        if (!orderBy) {
            orderBy = 'name ASC';
        }

        const { list, filterCount } = this.jsonUtils.filterAndPage(tmpArray, filter, orderBy, offset, limit);
        // Now return the list
        return { rows: list, count: filterCount };
    }

    getByPoolAndUserSync(poolId, userId) {
        debug(`getByPoolAndUserSync(${poolId}, ${userId})`);
        const userRegs = this.loadUserRegistrations(userId);
        const tmpArray = [];
        for (let i = 0; i < userRegs.length; ++i) {
            const thisReg = userRegs[i];
            if (thisReg.poolId !== poolId) {
                continue;
            }
            tmpArray.push(thisReg);
        }
        return { rows: tmpArray, count: tmpArray.length };
    }

    getByUserSync(userId) {
        debug(`getByUserSync(${userId})`);
        const userRegs = this.loadUserRegistrations(userId);
        const regMap = {};
        for (let i = 0; i < userRegs.length; ++i) {
            const thisReg = userRegs[i];
            if (regMap[thisReg.poolId]) {
                regMap[thisReg.poolId].push(thisReg);
            } else {
                regMap[thisReg.poolId] = [thisReg];
            }
        }
        return { pools: regMap };
    }

    upsertSync(poolId, userId, userData) {
        const namespace = userData.namespace; // Note: This may be null
        debug(`upsertSync(${poolId}, ${userId}, namespace: ${namespace})`);
        debug(userData);
        this.ensurePoolIndex(poolId, namespace, userId);
        this.ensureUserRegistration(poolId, namespace, userId, userData);
    }

    deleteSync(poolId, userId, namespace) {
        debug(`deleteSync(${poolId}, ${userId}, ${namespace})`);
        const poolIndex = this.loadPoolIndex(poolId, namespace);
        const userIndex = poolIndex.findIndex(JsonRegistrations.userEntryPredicate(poolId, namespace, userId));
        const userRegs = this.loadUserRegistrations(userId);
        const regIndex = userRegs.findIndex(JsonRegistrations.poolEntryPredicate(poolId, namespace));
        if (userIndex < 0 || regIndex < 0) {
            throw utils.makeError(404, 'Not found');
        }
        // Both are valid now
        poolIndex.splice(userIndex, 1);
        userRegs.splice(regIndex, 1);
        this.savePoolIndex(poolId, namespace, poolIndex);
        this.saveUserRegistrations(userId, userRegs);
    }
}

module.exports = JsonRegistrations;