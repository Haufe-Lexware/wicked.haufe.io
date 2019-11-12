'use strict';

const utils = require('./utils');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:pools');
const dao = require('../dao/dao');

const pools = require('express').Router();
const users = require('./users');

// ===== ENDPOINTS =====

pools.get('/', function (req, res, next) {
    debug(`GET /`);

    try {
        const poolInfos = utils.getPools();
        return res.json(poolInfos);
    } catch (err) {
        return utils.fail(res, 500, 'Could not read registration pool information.', err);
    }
});

pools.get('/:poolId', function (req, res, next) {
    const poolId = req.params.poolId;
    debug(`GET /pools/${poolId})`);

    try {
        const poolInfo = utils.getPool(poolId);
        return res.json(poolInfo);
    } catch (err) {
        return utils.fail(res, 500, `Could not read registration pool information for pool ID ${poolId}`, err);
    }
});

// ====== ENDPOINTS NAMESPACES =======

const READ = 'read_namespaces';
const WRITE = 'write_namespaces';

const verifyReadScope = utils.verifyScope(READ);
const verifyWriteScope = utils.verifyScope(WRITE);

pools.get('/:poolId/namespaces', verifyReadScope, function (req, res, next) {
    const poolId = req.params.poolId;
    const filter = utils.getFilter(req);
    const orderBy = utils.getOrderBy(req);
    const { offset, limit } = utils.getOffsetLimit(req);
    const noCountCache = utils.getNoCountCache(req);
    debug(`GET /pools/${poolId}/namespaces`);

    getNamespaces(req, res, req.apiUserId, poolId, filter, orderBy, offset, limit, noCountCache);
});

pools.get('/:poolId/namespaces/:namespaceId', verifyReadScope, function (req, res, next) {
    const poolId = req.params.poolId;
    const namespace = req.params.namespaceId;
    debug(`GET /pools/${poolId}/namespaces/${namespace}`);

    getNamespace(req, res, req.apiUserId, poolId, namespace);
});

pools.put('/:poolId/namespaces/:namespaceId', verifyWriteScope, function (req, res, next) {
    const poolId = req.params.poolId;
    const namespace = req.params.namespaceId;
    debug(`PUT /pools/${poolId}/namespaces/${namespace}`);
    const namespaceData = req.body;

    upsertNamespace(req, res, req.apiUserId, poolId, namespace, namespaceData);
});

pools.delete('/:poolId/namespaces/:namespaceId', verifyWriteScope, function (req, res, next) {
    const poolId = req.params.poolId;
    const namespace = req.params.namespaceId;
    debug(`DELETE /pools/${poolId}/namespaces/${namespace}`);

    deleteNamespace(req, res, req.apiUserId, poolId, namespace);
});

// ===========================================

function verifyAccess(app, loggedInUserId, poolId, callback) {
    debug(`verifyAccess(${loggedInUserId})`);
    if (!loggedInUserId) {
        return callback(utils.makeError(403, 'Must be logged in to access this endpoint'));
    }
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return callback(utils.makeError(500, 'Namespaces: Could not load user.', err));
        }
        if (!userInfo) {
            return callback(utils.makeError(403, 'Namespaces: Not allowed, logged in user not found.'));
        }
        if (!userInfo.admin) {
            return callback(utils.makeError(403, 'Only admins can access namespaces. Consider using a machine user.'));
        }
        // Access rights are okay, let's check for the pool info
        if (!utils.hasPool(poolId)) {
            return callback(utils.makeError(404, `Unknown pool ${poolId}, cannot get namespaces.`));
        }
        const poolInfo = utils.getPool(poolId);
        if (!poolInfo.requiresNamespace) {
            return callback(utils.makeError(400, `Pool ${poolId} does not support namespaces, i.e. property requiresNamespaces is false or not set.`));
        }
        return callback(null, userInfo);
    });
}

function getNamespaces(req, res, loggedInUserId, poolId, filter, orderBy, offset, limit, noCountCache) {
    debug(`getNamespaces(${poolId})`);
    verifyAccess(req.app, loggedInUserId, poolId, (err, _) => {
        if (err) {
            return utils.failError(res, err);
        }
        dao.namespaces.getByPool(poolId, filter, orderBy, offset, limit, noCountCache, (err, namespaceData, countResult) => {
            if (err) {
                return utils.fail(res, 500, 'Namespaces: Loading namespaces failed (DAO)', err);
            }
            return res.json({
                items: namespaceData,
                count: countResult.count,
                count_cached: countResult.cached,
                offset: offset,
                limit: limit
            });
        });
    });
}

function getNamespace(req, res, loggedInUserId, poolId, namespace) {
    debug(`getNamespace(${poolId}, ${namespace})`);
    verifyAccess(req.app, loggedInUserId, poolId, (err, _) => {
        if (err) {
            return utils.failError(res, err);
        }
        dao.namespaces.getByPoolAndNamespace(poolId, namespace, (err, namespaceData) => {
            if (err) {
                return utils.fail(res, 500, 'Namespaces: Loading namespace failed (DAO)', err);
            }
            if (!namespaceData) {
                return res.status(404).json({ message: 'Not found.' });
            }
            return res.json(namespaceData);
        });
    });
}

function upsertNamespace(req, res, loggedInUserId, poolId, namespace, namespaceData) {
    debug(`upsertNamespace(${poolId}, ${namespace})`);
    verifyAccess(req.app, loggedInUserId, poolId, (err, _) => {
        if (err) {
            return utils.failError(res, err);
        }
        // Verify it's JSON
        if (typeof (namespaceData) !== 'object') {
            return utils.fail(res, 400, 'Received non-JSON payload. Content-Type correct?');
        }
        if (!namespaceData.description) {
            return utils.fail(res, 400, 'Property "description" is mandatory, but missing.');
        }
        if (!utils.isNamespaceValid(namespace)) {
            return utils.fail(res, 400, `Invalid namespace ID; only a-z, 0-9, - and _ are allowed`);
        }
        if (namespaceData.namespace && namespaceData.namespace !== namespace) {
            return utils.fail(res, 400, 'Mismatch in namespace name (path/body)');
        }
        if (namespaceData.poolId && namespaceData.poolId !== poolId) {
            return utils.fail(res, 400, 'Mismatch in pool ID (path/body)');
        }
        namespaceData.poolId = poolId;
        namespaceData.namespace = namespace;
        dao.namespaces.upsert(poolId, namespace, loggedInUserId, namespaceData, (err) => {
            if (err) {
                return utils.fail(res, 500, `Failed to upsert namespace ${namespace} in pool ${poolId}`, err);
            }
            return res.status(204).json({ message: 'Success.' });
        });
    });
}

function deleteNamespace(req, res, loggedInUserId, poolId, namespace) {
    debug(`upsertNamespace(${poolId}, ${namespace})`);
    verifyAccess(req.app, loggedInUserId, poolId, (err, _) => {
        if (err) {
            return utils.failError(res, err);
        }
        dao.namespaces.delete(poolId, namespace, loggedInUserId, (err) => {
            if (err) {
                return utils.fail(res, 500, `Failed to delete namespace ${namespace} from pool ${poolId}`, err);
            }
            return res.status(204).json({ message: 'Success.' });
        });
    });
}

module.exports = pools;
