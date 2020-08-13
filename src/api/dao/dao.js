'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao');
const PgDao = require('./postgres/pg-dao');
const JsonDao = require('./json/json-dao');
const utils = require('../routes/utils');
const daoUtils = require('./dao-utils');

const dao = () => { };

dao._impl = null;
dao._isReady = false;
dao.init = (app) => {
    debug('initialize()');

    // Make sure we have all the right signatures in place for the DAOs;
    // this has been a source of extremely subtle problems in the past.
    // TypeScript would presumably have helped tons here.
    const functionList = daoUtils.listParameters(dao);
    const jsonDao = new JsonDao();
    daoUtils.checkParameters('JSON DAO', jsonDao, functionList);
    const pgDao = new PgDao();
    daoUtils.checkParameters('Postgres DAO', pgDao, functionList);

    // This is defined in the globals.json storage property
    const glob = utils.loadGlobals();
    let storageType = 'json';
    if (glob.storage && glob.storage.type) {
        storageType = glob.storage.type;
    }
    if (storageType === 'postgres') {
        // Postgres storage backend
        debug('DAO uses Postgres backing storage');
        dao._impl = pgDao;
    } else {
        // JSON backing files
        debug('JSON backing storage');
        dao._impl = jsonDao;
    }
};

dao.isReady = () => {
    return dao._isReady;
};

dao.initFinished = () => {
    dao._isReady = true;
};

dao.meta = {
    getInitChecks: () => { return dao._impl.meta.getInitChecks(); },
    wipe: (callback) => { return dao._impl.meta.wipe(callback); },
    isLegacyData: () => { return dao._impl.meta.isLegacyData(); },
    getMetadata: (propName, callback) => { return dao._impl.meta.getMetadata(propName, callback); },
    setMetadata: (propName, propValue, callback) => { return dao._impl.meta.setMetadata(propName, propValue, callback); }
};

dao.users = {
    getById: (userId, callback) => { dao._impl.users.getById(userId, callback); },
    getByEmail: (email, callback) => { dao._impl.users.getByEmail(email, callback); },
    // getByCustomId: (customId, callback) => { dao._impl.users.getByCustomId(customId, callback); }, // Not used/needed

    getShortInfoByEmail: (email, callback) => { dao._impl.users.getShortInfoByEmail(email, callback); },
    getShortInfoByCustomId: (customId, callback) => { dao._impl.users.getShortInfoByCustomId(customId, callback); },

    create: (userCreateInfo, callback) => { dao._impl.users.create(userCreateInfo, callback); },
    save: (userInfo, savingUserId, callback) => { dao._impl.users.save(userInfo, savingUserId, callback); },
    // patch:             (userId, userInfo, patchingUserId, callback) => { dao._impl.users.patch(userId, userInfo, patchingUserId, callback); },
    delete: (userId, deletingUserId, callback) => { dao._impl.users.delete(userId, deletingUserId, callback); },

    getIndex: (offset, limit, callback) => { dao._impl.users.getIndex(offset, limit, callback); },
    getCount: (callback) => { dao._impl.users.getCount(callback); }
};

dao.applications = {
    getById: (appId, callback) => { dao._impl.applications.getById(appId, callback); },

    create: (appCreateInfo, creatingUserId, callback) => { dao._impl.applications.create(appCreateInfo, creatingUserId, callback); },
    save: (appInfo, savingUserId, callback) => { dao._impl.applications.save(appInfo, savingUserId, callback); },
    // patch:             (appInfo, patchingUserId, callback) => { dao._impl.applications.patch(appInfo, patchingUserId, callback); },
    delete: (appId, deletingUserId, callback) => { dao._impl.applications.delete(appId, deletingUserId, callback); },

    getAll: (filter, orderBy, offset, limit, noCountCache, callback) => { dao._impl.applications.getAll(filter, orderBy, offset, limit, noCountCache, callback); },
    getIndex: (offset, limit, callback) => { dao._impl.applications.getIndex(offset, limit, callback); },
    getCount: (callback) => { dao._impl.applications.getCount(callback); },

    getOwners: (appId, callback) => { dao._impl.applications.getOwners(appId, callback); },
    addOwner: (appId, addUserId, role, addingUserId, callback) => { dao._impl.applications.addOwner(appId, addUserId, role, addingUserId, callback); },
    deleteOwner: (appId, deleteUserId, deletingUserId, callback) => { dao._impl.applications.deleteOwner(appId, deleteUserId, deletingUserId, callback); }
};

dao.subscriptions = {
    getByAppId: (appId, callback) => { dao._impl.subscriptions.getByAppId(appId, callback); },
    getByClientId: (clientId, callback) => { dao._impl.subscriptions.getByClientId(clientId, callback); },
    getByAppAndApi: (appId, apiId, callback) => { dao._impl.subscriptions.getByAppAndApi(appId, apiId, callback); },
    getByApi: (apiId, offset, limit, callback) => { dao._impl.subscriptions.getByApi(apiId, offset, limit, callback); },

    getAll: (filter, orderBy, offset, limit, noCountCache, callback) => { dao._impl.subscriptions.getAll(filter, orderBy, offset, limit, noCountCache, callback); },
    getIndex: (offset, limit, callback) => { dao._impl.subscriptions.getIndex(offset, limit, callback); },
    getCount: (callback) => { dao._impl.subscriptions.getCount(callback); },

    create: (newSubscription, creatingUserId, callback) => { dao._impl.subscriptions.create(newSubscription, creatingUserId, callback); },
    delete: (appId, apiId, subscriptionId, callback) => { dao._impl.subscriptions.delete(appId, apiId, subscriptionId, callback); },
    patch: (appId, subsInfo, patchingUserId, callback) => { dao._impl.subscriptions.patch(appId, subsInfo, patchingUserId, callback); },

    // Legacy functionality
    legacyWriteSubsIndex: (app, subs) => { dao._impl.subscriptions.legacyWriteSubsIndex(app, subs); },
    legacySaveSubscriptionApiIndex: (apiId, subs) => { dao._impl.subscriptions.legacySaveSubscriptionApiIndex(apiId, subs); }
};

dao.approvals = {
    getAll: (callback) => { dao._impl.approvals.getAll(callback); },
    create: (approvalInfo, callback) => { dao._impl.approvals.create(approvalInfo, callback); },
    // This is only needed inside the JSON DAO, not for all DAOs.
    // deleteByApp: (appId, callback) => { dao._impl.approvals.deleteByApp(appId, callback); },
    deleteByAppAndApi: (appId, apiId, callback) => { dao._impl.approvals.deleteByAppAndApi(appId, apiId, callback); }
};

dao.auditlog = {
    getById: (auditLogId, callback) => { dao._impl.auditlog.getById(auditLogId, callback); },
    getAll: (filter, orderBy, offset, limit, noCountCache, callback) => { dao._impl.auditlog.getAll(filter, orderBy, offset, limit, noCountCache, callback); },
    getIndex: (offset, limit, callback) => { dao._impl.auditlog.getIndex(offset, limit, callback); },
    getCount: (callback) => { dao._impl.auditlog.getCount(callback); },
 
    create: (auditLogInfo, callback) => { dao._impl.auditlog.create(auditLogInfo, callback); },
    delete: (deleteBeforeDate, deletingUserId, callback) => { dao._impl.auditlog.delete(deleteBeforeDate, deletingUserId, callback); },
    deleteById: (auditLogId, deletingUserId, callback) => { dao._impl.auditlog.deleteById(auditLogId, deletingUserId, callback); },
};

dao.verifications = {
    getAll: (callback) => { dao._impl.verifications.getAll(callback); },
    getById: (verificationId, callback) => { dao._impl.verifications.getById(verificationId, callback); },

    create: (verifInfo, callback) => { dao._impl.verifications.create(verifInfo, callback); },
    delete: (verificationId, callback) => { dao._impl.verifications.delete(verificationId, callback); },

    reconcile: (expirySeconds, callback) => { dao._impl.verifications.reconcile(expirySeconds, callback); },
};

dao.webhooks = {
    listeners: {
        getAll: (callback) => { dao._impl.webhooks.listeners.getAll(callback); },
        getById: (listenerId, callback) => { dao._impl.webhooks.listeners.getById(listenerId, callback); },

        upsert: (listenerInfo, callback) => { dao._impl.webhooks.listeners.upsert(listenerInfo, callback); },
        delete: (listenerId, callback) => { dao._impl.webhooks.listeners.delete(listenerId, callback); },
    },

    events: {
        hookListeners: (dispatchEvents, callback) => { dao._impl.webhooks.events.hookListeners(dispatchEvents, callback); },

        getByListener: (listenerId, callback) => { dao._impl.webhooks.events.getByListener(listenerId, callback); },
        //getTotalCount: (callback) => { dao._impl.webhooks.events.getTotalCount(callback); },

        create: (eventData, callback) => { dao._impl.webhooks.events.create(eventData, callback); },
        delete: (listenerId, eventId, callback) => { dao._impl.webhooks.events.delete(listenerId, eventId, callback); },

        flush: (listenerId, callback) => { dao._impl.webhooks.events.flush(listenerId, callback); },
    }
};

dao.registrations = {
    getByPoolAndUser: (poolId, userId, callback) => { dao._impl.registrations.getByPoolAndUser(poolId, userId, callback); },
    getByPoolAndNamespace: (poolId, namespace, filter, orderBy, offset, limit, noCountCache, callback) => { dao._impl.registrations.getByPoolAndNamespace(poolId, namespace, filter, orderBy, offset, limit, noCountCache, callback); },
    getByUser: (userId, callback) => { dao._impl.registrations.getByUser(userId, callback); },

    upsert: (poolId, userId, upsertingUserId, userData, callback) => { dao._impl.registrations.upsert(poolId, userId, upsertingUserId, userData, callback); },
    delete: (poolId, userId, namespace, deletingUserId, callback) => { dao._impl.registrations.delete(poolId, userId, namespace, deletingUserId, callback); }
};

dao.grants = {
    getByUserApplicationAndApi: (userId, applicationId, apiId, callback) => { dao._impl.grants.getByUserApplicationAndApi(userId, applicationId, apiId, callback); },
    getByUser: (userId, callback) => { dao._impl.grants.getByUser(userId, callback); },
    deleteByUser: (userId, deletingUserId, callback) => { dao._impl.grants.deleteByUser(userId, deletingUserId, callback); },

    upsert: (userId, applicationId, apiId, upsertingUserId, grantsInfo, callback) => { dao._impl.grants.upsert(userId, applicationId, apiId, upsertingUserId, grantsInfo, callback); },
    delete: (userId, applicationId, apiId, deletingUserId, callback) => { dao._impl.grants.delete(userId, applicationId, apiId, deletingUserId, callback); }
};

dao.namespaces = {
    getByPool: (poolId, filter, orderBy, offset, limit, noCountCache, callback) => { dao._impl.namespaces.getByPool(poolId, filter, orderBy, offset, limit, noCountCache, callback); },
    getByPoolAndNamespace: (poolId, namespace, callback) => { dao._impl.namespaces.getByPoolAndNamespace(poolId, namespace, callback); },
    upsert: (poolId, namespace, upsertingUserId, namespaceData, callback) => { dao._impl.namespaces.upsert(poolId, namespace, upsertingUserId, namespaceData, callback); },
    delete: (poolId, namespace, deletingUserId, callback) => { dao._impl.namespaces.delete(poolId, namespace, deletingUserId, callback); }
};

dao.accessTokens = {
    getByAccessToken: (accessToken, callback) => { dao._impl.accessTokens.getByAccessToken(accessToken, callback); },
    getByRefreshToken: (refreshToken, callback) => { dao._impl.accessTokens.getByRefreshToken(refreshToken, callback); },
    getByAuthenticatedUserId: (authenticatedUserId, callback) => { dao._impl.accessTokens.getByAuthenticatedUserId(authenticatedUserId, callback); },
    getByUserId: (userId, callback) => { dao._impl.accessTokens.getByUserId(userId, callback); },

    insert: (tokenData, callback) => { dao._impl.accessTokens.insert(tokenData, callback); },
    deleteByAccessToken: (accessToken, callback) => { dao._impl.accessTokens.deleteByAccessToken(accessToken, callback); },
    deleteByRefreshToken: (refreshToken, callback) => { dao._impl.accessTokens.deleteByRefreshToken(refreshToken, callback); },
    deleteByAuthenticatedUserId: (authenticatedUserId, callback) => { dao._impl.accessTokens.deleteByAuthenticatedUserId(authenticatedUserId, callback); },
    deleteByUserId: (userId, callback) => { dao._impl.accessTokens.deleteByUserId(userId, callback); },

    cleanup: (callback) => { dao._impl.accessTokens.cleanup(callback); }
};

module.exports = dao;
