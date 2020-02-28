'use strict';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:auditlog');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class JsonAuditlog {

    constructor(jsonUtils, jsonUsers) {
        this.jsonUtils = jsonUtils;
        this.jsonUsers = jsonUsers;
    }
    // =================================================
    // DAO contract
    // =================================================

    getById(auditLogId, callback) {
        debug('getById()');
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    create(auditLogInfo, callback) {
        debug('create()');
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    delete(deleteBeforeDate, deletingUserId, callback) {
        debug(`delete(${deleteBeforeDate})`);
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    deleteById(auditLogId, deletingUserId, callback) {
        debug(`delete(${auditLogId})`);
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    getAll(filter, orderBy, offset, limit, noCountCache, callback) {
        debug('getAll()');
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    getIndex(offset, limit, callback) {
        debug('getIndex()');
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

    getCount(callback) {
        debug('getCount()');
        return callback(utils.makeError(501, 'This functionality is not implemented for the JSON data store. Please use Postgres if it is needed.'));
    }

}

module.exports = JsonAuditlog;    