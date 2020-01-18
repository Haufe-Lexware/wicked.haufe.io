'use strict';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:auditlog');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class PgAuditlog {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }
    // =================================================
    // DAO contract
    // =================================================

    getById(auditLogId, callback) {
        debug('getById()');
        this.pgUtils.checkCallback(callback);
        return this.getByIdImpl(auditLogId, null, callback);
    }

    create(auditLogInfo, callback) {
        debug('create()');
        this.pgUtils.checkCallback(callback);
        return this.createImpl(auditLogInfo, callback);
    }

    deleteById(auditLogId, deletingUserId, callback) {
        debug(`delete(${auditLogId})`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteById('audit_log', auditLogId, callback);
    }

    getAll(filter, orderBy, offset, limit, noCountCache, callback) {
        debug('getAll()');
        this.pgUtils.checkCallback(callback);
        return this.getAllImpl(filter, orderBy, offset, limit, noCountCache, callback);
    }

    getIndex(offset, limit, callback) {
        debug('getIndex()');
        //this.pgUtils.checkCallback(callback);
        //return this.getIndexImpl(offset, limit, callback);
    }

    getCount(callback) {
        debug('getCount()');
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.count('audit_log', callback);
    }

    delete(deleteBeforeDate, deletingUserId, callback) {
        debug(`delete(${deleteBeforeDate}) deletingUser: ${deletingUserId}`);
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteBefore('audit_log', 'created_at', deleteBeforeDate, null, callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByIdImpl(auditLogId, client, callback) {
        debug(`getByIdImpl(${auditLogId})`);
        const options = client ? { client: client } : null;
        // First load the basic app information
        this.pgUtils.getById('audit_log', auditLogId, options, (err, auditLogInfo) => {
            if (err) {
                return callback(err);
            }
            if (!auditLogInfo) {
                return callback(null, null);
            }
            return callback(null, auditLogInfo);
        });
    }

    createImpl(auditLogInfo, callback) {
        debug('createImpl()');   
        this.pgUtils.upsert('audit_log', auditLogInfo, null, (err, auditLogInfo) => {
            if (err) {
                return callback(err);
            }
            return callback(null, auditLogInfo);
        });
    }
    

    getAllImpl(filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getAll(filter: ${JSON.stringify(filter)}, orderBy: ${orderBy}, offset: ${offset}, limit: ${limit})`);
        const fields = [];
        const values = [];
        const operators = [];
        const joinedFields = [
            {
                source: 'CONCAT (data->>\'action\', \' \',data->>\'entity\')',
                as: 'activity',
                alias: 'activity'
            },
            {
                source: 'data->\'data\'->\'user\'->>\'name\'',
                as: 'user',
                alias: 'user'
            },
            {
                source: 'data->\'data\'->\'user\'->>\'email\'',
                as: 'email',
                alias: 'email'
            },
            {
                source: 'data->\'data\'->>\'planId\'',
                as: 'plan',
                alias: 'plan'
            },
            {
                source: 'data->\'data\'->\'user\'->>\'role\'',
                as: 'role',
                alias: 'role'
            },
            {
                source: 'data->\'data\'->>\'apiId\'',
                as: 'api',
                alias: 'api'
            },
            {
                source: 'data->\'data\'->>\'applicationId\'',
                as: 'application',
                alias: 'application'
            },
            {
                source: 'created_at',
                as: 'created_at',
                alias: 'created_at'
            }
      
        ];
        //compensate for timestamp column
        this.pgUtils.addDateTimeFilterOptions('created_at',filter, fields, values, operators, joinedFields);
        this.pgUtils.addFilterOptions(filter, fields, values, operators, joinedFields);

        const options = {
            limit: limit,
            offset: offset,
            orderBy: orderBy ? orderBy : 'created_at DESC',
            operators: operators,
            noCountCache: noCountCache,
            joinedFields: joinedFields
        };
        return this.pgUtils.getBy('audit_log', fields, values, options, (err, rows, countResult) => {
            if (err) {
                return callback(err);
            }
            return callback(null, rows, countResult);
        });
    }
}

module.exports = PgAuditlog;