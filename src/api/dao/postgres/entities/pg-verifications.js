'use strict';

const async = require('async');

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:verifications');
const utils = require('../../../routes/utils');

class PgVerifications {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    create(verifInfo, callback) {
        debug(`create(${verifInfo.id})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.upsert('verifications', verifInfo, null, callback);
    }

    getAll(callback) {
        debug('getAll()');
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.getBy('verifications', [], [], {}, callback);
    }

    getById(verificationId, callback) {
        debug(`getById(${verificationId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.getById('verifications', verificationId, callback);
    }

    delete(verificationId, callback) {
        debug(`delete(${verificationId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteById('verifications', verificationId, callback);
    }

    reconcile(expirySeconds, callback) {
        debug('reconcile()');
        this.pgUtils.checkCallback(callback);
        return this.reconcileImpl(expirySeconds, callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    reconcileImpl(expirySeconds, callback) {
        debug(`reconcileImpl()`);
        info(`Running verification record reconciliation.`);

        // Not so nice, this is a FTS, but we don't expect tons of records in here anyway
        const instance = this;
        instance.getAll((err, verifInfos, countResult) => {
            if (err) {
                return callback(err);
            }
            debug(`reconcileImpl(): Found ${countResult.count} verifications.`);
            const idsToDelete = [];
            const nowUtc = utils.getUtc();
            for (let i = 0; i < verifInfos.length; ++i) {
                const v = verifInfos[i];
                if (nowUtc - v.utc > expirySeconds) {
                    idsToDelete.push(v.id);
                }
            }
            if (idsToDelete.length > 0) {
                info(`Verification reconciliation: Pruning ${idsToDelete.length} verification records (older than ${expirySeconds} seconds).`);
                async.eachSeries(idsToDelete, (id, callback) => instance.delete(id, callback), callback);
            }
        });
    }
}

module.exports = PgVerifications;
