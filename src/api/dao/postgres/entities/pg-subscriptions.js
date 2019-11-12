'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:subscriptions');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class PgSubscriptions {

    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByAppId(appId, callback) {
        debug(`getByAppId(${appId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByAppIdImpl(appId, callback);
    }

    getByClientId(clientId, callback) {
        debug(`getByClientId(${clientId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByClientIdImpl(clientId, callback);
    }

    getByAppAndApi(appId, apiId, callback) {
        debug(`getByAppAndApi(${appId}, ${apiId})`);
        this.pgUtils.checkCallback(callback);
        return this.getByAppAndApiImpl(appId, apiId, callback);
    }

    getByApi(apiId, offset, limit, callback) {
        debug(`getByApi(${apiId}, offset: ${offset}, limit: ${limit})`);
        this.pgUtils.checkCallback(callback);
        return this.getByApiImpl(apiId, offset, limit, callback);
    }

    getAll(filter, orderBy, offset, limit, noCountCache, callback) {
        debug('getAll()');
        this.pgUtils.checkCallback(callback);
        return this.getAllImpl(filter, orderBy, offset, limit, noCountCache, callback);
    }

    getIndex(offset, limit, callback) {
        debug('getIndex()');
        this.pgUtils.checkCallback(callback);
        return this.getIndexImpl(offset, limit, callback);
    }

    getCount(callback) {
        debug('getCount()');
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.count('subscriptions', callback);
    }

    create(newSubscription, creatingUserId, callback) {
        debug(`create(${newSubscription.id})`);
        this.pgUtils.checkCallback(callback);
        return this.createImpl(newSubscription, creatingUserId, callback);
    }

    delete(appId, apiId, subscriptionId, callback) {
        debug(`delete(${appId}, ${apiId}, ${subscriptionId})`);
        // Note: appId and apiId aren't used for this DAO, as the subscription ID
        // is already unique.
        this.pgUtils.checkCallback(callback);
        return this.pgUtils.deleteById('subscriptions', subscriptionId, callback);
    }

    patch(appId, subsInfo, patchingUserId, callback) {
        debug(`patch(${appId}, ${subsInfo.id})`);
        this.pgUtils.checkCallback(callback);
        return this.patchImpl(appId, subsInfo, patchingUserId, callback);
    }

    // Legacy functionality which is used in the initializer; it's not possible
    // to take this out, but this does not have to be re-implemented for future
    // DAOs (actually, MUST not)

    legacyWriteSubsIndex(app, subs) { }
    legacySaveSubscriptionApiIndex(apiId, subs) { }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByAppIdImpl(appId, callback) {
        debug('getByAppIdImpl()');
        this.pgUtils.getBy('subscriptions', ['applications_id'], [appId], {}, (err, subsList) => {
            if (err) {
                return callback(err);
            }
            daoUtils.decryptApiCredentials(subsList);
            return callback(null, subsList);
        });
    }

    getAllImpl(filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getAll(filter: ${filter}, orderBy: ${orderBy}, offset: ${offset}, limit: ${limit})`);
        const fields = [];
        const values = [];
        const operators = [];
        const joinedFields = [
            {
                source: 'b.data->>\'name\'',
                as: 'application_name',
                alias: 'application_name'
            },
            {
                source: 'e.owner',
                as: 'owner',
                alias: 'owner'
            },
            {
                source: 'e.user',
                as: 'user',
                alias: 'user'
            },
            {
                source: '(SELECT to_json(array_agg(row_to_json(tmp))) ' +
                    ' FROM ( SELECT o.applications_id as applications_id, o.users_id as users_id, o.data->>\'role\' as role, o.data->>\'email\' as email, r.name' +
                    '        FROM wicked.owners o INNER JOIN wicked.registrations r ON r.users_id = o.users_id ' +
                    '        WHERE r.pool_id = \'wicked\') tmp ' +
                    ' WHERE tmp.applications_id = b.id)',
                as: 'owner_data',
                alias: 'owner_data'
            }
        ];

        this.pgUtils.addFilterOptions(filter, fields, values, operators, joinedFields);
        const options = {
            limit: limit,
            offset: offset,
            orderBy: orderBy ? orderBy : 'id ASC',
            operators: operators,
            noCountCache: noCountCache,
            joinedFields: joinedFields,
            joinClause: 'INNER JOIN wicked.applications b ON b.id = a.applications_id '+
                        'INNER JOIN (SELECT c.applications_id as applications_id, string_agg(c.data->>\'email\',\' \') as owner, string_agg(d.name,\' \') as user '+
                        'FROM wicked.owners c, wicked.registrations d WHERE c.users_id = d.users_id GROUP BY applications_id) e on e.applications_id = b.id '
        };

        return this.pgUtils.getBy('subscriptions', fields, values, options, (err, subsList, countResult) => {
            if (err) {
                return callback(err);
            }
            daoUtils.decryptApiCredentials(subsList);
            return callback(null, subsList, countResult);
        });
    }


    getIndexImpl(offset, limit, callback) {
        debug(`getIndex(offset: ${offset}, limit: ${limit})`);
        this.pgUtils.getBy('subscriptions', [], [], { orderBy: 'id ASC' }, (err, subsList, countResult) => {
            if (err) {
                return callback(err);
            }
            const subIdList = subsList.map(sub => { return { id: sub.id }; });
            return callback(null, subIdList, countResult);
        });
    }

    getByApiImpl(apiId, offset, limit, callback) {
        debug('getByApiImpl()');
        this.pgUtils.getBy('subscriptions', ['api_id'], [apiId], { offset: offset, limit: limit }, (err, subsList, countResult) => {
            if (err) {
                return callback(err);
            }
            daoUtils.decryptApiCredentials(subsList);
            return callback(null, subsList, countResult);
        });
    }

    returnSingleSubs(callback) {
        return function (err, subsInfo) {
            if (err) {
                return callback(err);
            }
            if (!subsInfo) {
                return callback(null, null);
            }
            daoUtils.decryptApiCredentials([subsInfo]);
            return callback(null, subsInfo);
        };
    }

    getByClientIdImpl(clientId, callback) {
        debug('getByClientIdImpl()');
        this.pgUtils.getSingleBy(
            'subscriptions',
            'client_id',
            clientId,
            this.returnSingleSubs(callback));
    }

    getByAppAndApiImpl(appId, apiId, callback) {
        debug('getByAppAndApiImpl()');
        this.pgUtils.getSingleBy(
            'subscriptions',
            ['applications_id', 'api_id'],
            [appId, apiId],
            this.returnSingleSubs(callback));
    }

    createImpl(newSubscription, creatingUserId, callback) {
        debug('createImpl()');
        daoUtils.encryptApiCredentials([newSubscription]);
        this.pgUtils.upsert('subscriptions', newSubscription, creatingUserId, (err) => {
            if (err) {
                return callback(err);
            }
            return callback(null, newSubscription);
        });
    }

    patchImpl(appId, subsInfo, patchingUserId, callback) {
        debug('patchSync()');
        // This is actually just save...
        daoUtils.encryptApiCredentials([subsInfo]);
        this.pgUtils.upsert('subscriptions', subsInfo, patchingUserId, (err) => {
            if (err) {
                return callback(err);
            }
            return callback(null, subsInfo);
        });
    }
}

module.exports = PgSubscriptions;
