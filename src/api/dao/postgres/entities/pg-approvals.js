'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:approvals');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class PgApprovals {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getAll(callback) {
        debug('getAll()');
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.getBy('approvals', [], [], {}, callback);
    }

    create(approvalInfo, callback) {
        debug('create()');
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.upsert('approvals', approvalInfo, null, callback);
    }

    deleteByAppAndApi(appId, apiId, callback) {
        debug(`deleteByAppAndApi(${appId}, ${apiId})`);
        this.pgUtils.checkCallback(callback);
        return this.deleteByAppAndApiImpl(appId, apiId, callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    // Gaaa, FTS. But you don't expect to have more than just a couple
    // of approvals at once in the system. If you have, you should clean
    // them up.
    deleteByAppAndApiImpl(appId, apiId, callback) {
        debug('deleteByAppAndApiImpl()');
        const instance = this;
        this.getAll((err, approvalList) => {
            if (err) {
                return callback(err);
            }
            const approvalInfo = approvalList.find(a => a.api.id === apiId && a.application.id === appId);
            if (approvalInfo) {
                instance.pgUtils.deleteById('approvals', approvalInfo.id, callback);
            } else {
                // Not found, ignore
                debug('deleteByAppAndApiImpl() did not find any matching approvals.');
                return callback(null);
            }
        });
    }
}

module.exports = PgApprovals;
