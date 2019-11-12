'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:grants');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class PgNamespaces {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByPool(poolId, filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getByPool(${poolId}, ${filter}, ${orderBy}, ${offset}, ${limit}, ${noCountCache})`);
        this.pgUtils.checkCallback(callback);
        return this.getByPoolImpl(poolId, filter, orderBy, offset, limit, noCountCache, callback);
    }

    getByPoolAndNamespace(poolId, namespace, callback) {
        debug(`getByPoolAndNamespace(${poolId}, ${namespace})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.getSingleBy('namespaces', ['poolId', 'namespace'], [poolId, namespace], {}, callback);
    }

    upsert(poolId, namespace, upsertingUserId, namespaceData, callback) {
        debug(`upsert(${poolId}, ${namespace})`);
        this.pgUtils.checkCallback(callback);
        return this.upsertImpl(poolId, namespace, upsertingUserId, namespaceData, callback);
    }

    delete(poolId, namespace, deletingUserId, callback) {
        debug(`delete(${poolId}, ${namespace})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteBy('namespaces', ['poolId', 'namespace'], [poolId, namespace], callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByPoolImpl(poolId, filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getByPoolImpl(${poolId}, ${filter}, ${orderBy}, ${offset}, ${limit}, ${noCountCache})`);
        const fields = ['poolId'];
        const values = [poolId];
        const operators = ['='];
        this.pgUtils.addFilterOptions(filter, fields, values, operators);
        const options = {
            limit: limit,
            offset: offset,
            orderBy: orderBy ? orderBy : 'description ASC',
            operators: operators,
            noCountCache: noCountCache
        };
        return this.pgUtils.getBy('namespaces', fields, values, options, callback);
    }

    upsertImpl(poolId, namespace, upsertingUserId, namespaceData, callback) {
        debug(`upsert(${poolId}, ${namespace})`);
        const instance = this;
        this.pgUtils.getBy('namespaces', ['poolId', 'namespace'], [poolId, namespace], {}, (err, data) => {
            if (err) {
                return callback(err);
            }
            if (data.length > 1) {
                return callback(utils.makeError(500, `More than one entry in namespaces for pool ${poolId} and namespace ${namespace}`));
            }
            // Add the id of the previous record; it's needed here
            if (data.length === 1) {
                namespaceData.id = data[0].id;
            } else {
                // new record
                namespaceData.id = utils.createRandomId();
            }
            return instance.pgUtils.upsert('namespaces', namespaceData, upsertingUserId, callback);
        });
    }
}

module.exports = PgNamespaces;
