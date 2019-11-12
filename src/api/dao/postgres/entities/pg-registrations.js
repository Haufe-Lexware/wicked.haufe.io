'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:registrations');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class PgRegistrations {

    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }
    // =================================================
    // DAO contract
    // =================================================

    getByPoolAndUser(poolId, userId, callback) {
        debug(`getByPoolAndUser(${poolId}, ${userId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByPoolAndUserImpl(poolId, userId, callback);
    }

    getByPoolAndNamespace(poolId, namespace, filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getByPoolAndNamespace(${poolId}, ${namespace}, ${filter}, ${orderBy}, ${offset}, ${limit})`);
        this.pgUtils.checkCallback(callback);
        return this.getByPoolAndNamespaceImpl(poolId, namespace, filter, orderBy, offset, limit, noCountCache, callback);
    }

    getByUser(userId, callback) {
        debug(`getByUser(${userId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByUserImpl(userId, callback);
    }

    upsert(poolId, userId, upsertingUserId, userData, callback) {
        debug(`upsert(${poolId}, ${userId}, ${userData})`);
        this.pgUtils.checkCallback(callback);
        return this.upsertImpl(poolId, userId, upsertingUserId, userData, callback);
    }

    delete(poolId, userId, namespace, deletingUserId, callback) {
        debug(`delete(${poolId}, ${userId}, ${namespace})`);
        this.pgUtils.checkCallback(callback);
        return this.deleteImpl(poolId, userId, namespace, deletingUserId, callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByPoolAndUserImpl(poolId, userId, callback) {
        debug(`getByPoolAndUserImpl(${poolId}, ${userId})`);
        this.pgUtils.getBy('registrations', ['poolId', 'userId'], [poolId, userId], {}, callback);
    }

    getByPoolAndNamespaceImpl(poolId, namespace, filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getByPoolAndNamespaceImpl(${poolId}, ${namespace}, ${filter}, ${orderBy}, ${offset}, ${limit}, ${noCountCache})`);
        const fields = ['poolId'];
        const values = [poolId];
        const operators = ['='];
        if (namespace) {
            fields.push('namespace');
            values.push(namespace);
            operators.push('=');
        }
        this.pgUtils.addFilterOptions(filter, fields, values, operators);
        const options = {
            limit: limit,
            offset: offset,
            orderBy: orderBy ? orderBy : 'name ASC',
            operators: operators,
            noCountCache: noCountCache
        };
        return this.pgUtils.getBy('registrations', fields, values, options, callback);
    }

    getByUserImpl(userId, callback) {
        debug(`getByUserImpl(${userId})`);
        return this.pgUtils.getBy('registrations', 'userId', userId, {
            orderBy: 'pool_id ASC'
        }, (err, data, countResult) => {
            if (err) {
                return callback(err);
            }
            const tmp = {
                pools: {}
            };

            data.forEach(r => {
                if (tmp.pools[r.poolId]) {
                    tmp.pools[r.poolId].push(r);
                } else {
                    tmp.pools[r.poolId] = [r];
                }
            });
            return callback(null, tmp, countResult);
        });
    }

    upsertImpl(poolId, userId, upsertingUserId, userData, callback) {
        debug(`upsertImpl(${poolId}, ${userId}, ${userData})`);
        const instance = this;
        if (userData.namespace) {
            const namespace = userData.namespace;
            this.pgUtils.getBy('registrations', ['poolId', 'namespace', 'userId'], [poolId, namespace, userId], {}, (err, data) => {
                if (err) {
                    return callback(err);
                }
                if (data.length > 1) {
                    return callback(utils.makeError(500, `More than one entry in registrations for pool ${poolId}, namespace ${namespace} and user ${userId}`));
                }
                // Add the id of the previous record; it's needed here
                if (data.length === 1) {
                    userData.id = data[0].id;
                } else {
                    // new record
                    userData.id = utils.createRandomId();
                }
                return instance.pgUtils.upsert('registrations', userData, upsertingUserId, callback);
            });
        } else {
            this.pgUtils.getBy('registrations', ['poolId', 'userId'], [poolId, userId], {}, (err, data) => {
                if (err) {
                    return callback(err);
                }
                if (data.length > 1) {
                    return callback(utils.makeError(500, `More than one entry in registrations for pool ${poolId} and user ${userId}`));
                }
                // Add the id of the previous record; it's needed here
                if (data.length === 1) {
                    userData.id = data[0].id;
                } else {
                    // new record
                    userData.id = utils.createRandomId();
                }
                return instance.pgUtils.upsert('registrations', userData, upsertingUserId, callback);
            });
        }
    }

    deleteImpl(poolId, userId, namespace, deletingUserId, callback) {
        debug(`deleteImpl(${poolId}, ${userId})`);
        if (!namespace) {
            return this.pgUtils.deleteBy('registrations', ['poolId', 'userId'], [poolId, userId], callback);
        }
        return this.pgUtils.deleteBy('registrations', ['poolId', 'userId', 'namespace'], [poolId, userId, namespace], callback);
    }
}

module.exports = PgRegistrations;
