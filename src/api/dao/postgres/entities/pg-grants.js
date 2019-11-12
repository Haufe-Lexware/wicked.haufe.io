'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:grants');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class PgGrants {

    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByUserApplicationAndApi(userId, applicationId, apiId, callback) {
        debug(`getByUserApplicationAndApi(${userId}, ${applicationId}, ${apiId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByUserApplicationAndApiImpl(userId, applicationId, apiId, callback);
    }

    getByUser(userId, callback) {
        debug(`getByUser(${userId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByUserImpl(userId, callback);
    }

    deleteByUser(userId, deletingUserId, callback) {
        debug(`deleteByUser(${userId})`);
        this.pgUtils.checkCallback(callback);
        return this.deleteByUserImpl(userId, deletingUserId, callback);
    }

    upsert(userId, applicationId, apiId, upsertingUserId, grantsInfo, callback) {
        debug(`upsert(${userId}, ${applicationId}, ${apiId})`);
        this.pgUtils.checkCallback(callback);
        return this.upsertImpl(userId, applicationId, apiId, upsertingUserId, grantsInfo, callback);
    }

    delete(userId, applicationId, apiId, deletingUserId, callback) {
        debug(`delete(${userId}, ${applicationId}, ${apiId})`);
        this.pgUtils.checkCallback(callback);
        return this.deleteImpl(userId, applicationId, apiId, deletingUserId, callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByUserApplicationAndApiImpl(userId, applicationId, apiId, callback) {
        debug(`getByUserApplicationAndApiImpl(${userId}, ${applicationId}, ${apiId})`);
        this.pgUtils.getSingleBy('grants', ['userId', 'applicationId', 'apiId'], [userId, applicationId, apiId], (err, data) => {
            if (err) {
                return callback(err);
            }
            if (!data) {
                return callback(utils.makeError(404, `User ${userId} does not have a grants record for API ${apiId} for application ${applicationId}`));
            }
            return callback(null, data);
        });
    }

    getByUserImpl(userId, callback) {
        debug(`getByUserImpl(${userId})`);
        const options = {
            orderBy: 'applicationId ASC'
        };
        this.pgUtils.getBy('grants', 'userId', userId, options, callback);
    }

    deleteByUserImpl(userId, deletingUserId, callback) {
        debug(`deleteByUserImpl(${userId})`);
        this.pgUtils.deleteBy('grants', 'userId', userId, callback);
    }

    upsertImpl(userId, applicationId, apiId, upsertingUserId, grantsInfo, callback) {
        debug(`upsertImpl(${userId}, ${applicationId}, ${apiId})`);

        // getSingleBy returns either exactly one record, or null (if there is no matching record)
        const instance = this;
        this.pgUtils.getSingleBy('grants', ['userId', 'applicationId', 'apiId'], [userId, applicationId, apiId], (err, prevGrants) => {
            if (err) {
                return callback(err);
            }
            let nextGrants = {
                userId: userId,
                applicationId: applicationId,
                apiId: apiId,
                grants: grantsInfo.grants
            };
            if (prevGrants) {
                nextGrants.id = prevGrants.id;
            } else {
                nextGrants.id = utils.createRandomId();
            }
            daoUtils.mergeGrantData(prevGrants, nextGrants);

            return instance.pgUtils.upsert('grants', nextGrants, upsertingUserId, callback);
        });
    }

    deleteImpl(userId, applicationId, apiId, deletingUserId, callback) {
        debug(`deleteImpl(${userId}, ${applicationId}, ${apiId})`);
        const instance = this;
        this.getByUserApplicationAndApiImpl(userId, applicationId, apiId, (err, data) => {
            if (err) {
                // This can be a 404 for example
                return callback(err);
            }
            instance.pgUtils.deleteBy('grants', ['userId', 'applicationId', 'apiId'], [userId, applicationId, apiId], callback);
        });
    }
}

module.exports = PgGrants;
