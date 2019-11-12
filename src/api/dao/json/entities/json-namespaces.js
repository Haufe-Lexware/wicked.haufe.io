'use strict';

const path = require('path');
const fs = require('fs');

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:namespaces');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class JsonNamespaces {
    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByPool(poolId, filter, orderBy, offset, limit, noCountCache, callback) {
        debug(`getByPool(${poolId})`);
        this.jsonUtils.checkCallback(callback);
        let namespaces;
        try {
            namespaces = this.getByPoolSync(poolId, filter, orderBy, offset, limit);
        } catch (err) {
            return callback(err);
        }
        return callback(null, namespaces.rows, { count: namespaces.count, cached: false });
    }

    getByPoolAndNamespace(poolId, namespace, callback) {
        debug(`getByPoolAndNamespace(${poolId}, ${namespace})`);
        let namespaceData;
        try {
            namespaceData = this.getByPoolAndNamespaceSync(poolId, namespace);
        } catch (err) {
            return callback(err);
        }
        return callback(null, namespaceData);
    }

    upsert(poolId, namespace, upsertingUserId, namespaceData, callback) {
        debug(`upsert(${poolId}, ${namespace})`);
        try {
            this.upsertSync(poolId, namespace, namespaceData);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    delete(poolId, namespace, deletingUserId, callback) {
        debug(`delete(${poolId}, ${namespace})`);
        try {
            this.deleteSync(poolId, namespace);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByPoolSync(poolId, filter, orderBy, offset, limit) {
        debug(`getByPoolSync(${poolId})`);
        const ns = this.loadNamespaces(poolId);
        if (!orderBy) {
            orderBy = 'description ASC';
        }
        const { list, filterCount } = this.jsonUtils.filterAndPage(ns, filter, orderBy, offset, limit);
        // Now return the list
        return { rows: list, count: filterCount };
    }

    getByPoolAndNamespaceSync(poolId, namespace) {
        debug(`getByPoolAndNamespaceSync(${poolId}, ${namespace})`);
        const ns = this.loadNamespaces(poolId);
        const selectedNs = ns.find(n => n.namespace === namespace);
        // This may be null, mind you
        return selectedNs;
    }

    upsertSync(poolId, namespace, namespaceData) {
        debug(`upsertSync(${poolId}, ${namespace})`);
        debug(namespaceData);
        const ns = this.loadNamespaces(poolId);
        const thisIndex = ns.findIndex(n => n.namespace === namespace);
        namespaceData.poolId = poolId;
        namespaceData.namespace = namespace;
        if (thisIndex >= 0) {
            ns[thisIndex] = namespaceData;
        } else {
            ns.push(namespaceData);
        }
        this.saveNamespaces(poolId, ns);
        return;
    }

    deleteSync(poolId, namespace) {
        debug(`deleteSync(${poolId}, ${namespace})`);
        const ns = this.loadNamespaces(poolId);
        const thisIndex = ns.findIndex(n => n.namespace === namespace);
        if (thisIndex < 0) {
            debug(`deleteSync: pool ${poolId} does not have namespace ${namespace}`);
            return;
        }
        ns.splice(thisIndex, 1);
        this.saveNamespaces(poolId, ns);
    }

    // =================================================
    // Helper methods
    // =================================================

    makeNamespacesFileName(poolId) {
        const namespacesDir = path.join(this.jsonUtils.getDynamicDir(), 'namespaces');
        const namespacesFile = path.join(namespacesDir, `${poolId}.json`);
        return namespacesFile;
    }

    loadNamespaces(poolId) {
        debug(`loadNamespaces(${poolId})`);
        const fileName = this.makeNamespacesFileName(poolId);
        if (fs.existsSync(fileName)) {
            return JSON.parse(fs.readFileSync(fileName, 'utf8'));
        }
        return [];
    }

    saveNamespaces(poolId, namespaces) {
        debug(`saveNamespaces(${poolId})`);
        debug(namespaces);
        const fileName = this.makeNamespacesFileName(poolId);
        fs.writeFileSync(fileName, JSON.stringify(namespaces, null, 2), 'utf8');
    }
}

module.exports = JsonNamespaces;
