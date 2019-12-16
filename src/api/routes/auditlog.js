'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:auditlog');
const utils = require('./utils');
const dao = require('../dao/dao');
const daoUtils = require('../dao/dao-utils');
const async = require('async');

const auditlog = require('express').Router();
const READ_AUDITLOG = 'read_auditlog';
const verifyAuditLogReadScope = utils.verifyScope(READ_AUDITLOG);
const WRITE_AUDITLOG = 'write_auditlog';
const verifyAuditLogWriteScope = utils.verifyScope(WRITE_AUDITLOG);

auditlog.setup = function (users) {
    auditlog._usersModule = users;
};

// ===== ENDPOINTS =====
auditlog.get('/', verifyAuditLogReadScope, function (req, res, next) {
    const { offset, limit } = utils.getOffsetLimit(req);
    const filter = utils.getFilter(req);
    const orderBy = utils.getOrderBy(req);
    const noCountCache = utils.getNoCountCache(req);
    const embed = utils.getEmbed(req);
    auditlog.getAllAuditlog(req.app, auditlog._usersModule, res, req.apiUserId, filter, orderBy, offset, limit, noCountCache, embed);
});

auditlog.delete('/:deleteBeforeDate', verifyAuditLogWriteScope, function (req, res, next) {
    auditlog.deleteAuditLog(req.app, auditlog._usersModule, res, req.apiUserId, req.params.deleteBeforeDate);
});

auditlog.deleteAuditLog = function (app, users, res, loggedInUserId, deleteBeforeDate ) {
    debug(`deleteAuditLog() userid: ${loggedInUserId} deleteBeforeDate: ${deleteBeforeDate}`);
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'deleteAuditLog: Could not load user.', err);
        }
        if (!userInfo || !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. User invalid or not an Admin.');
        }
        dao.auditlog.delete( deleteBeforeDate, loggedInUserId, (err, result) => {
            if (err) {
                return utils.fail(res, 500, 'deleteAuditLog: DAO deleteBefore failed', err);
            }
            res.json(result);
        });
    });
};


auditlog.getAllAuditlog = function (app, users, res, loggedInUserId, filter, orderBy, offset, limit, noCountCache, embed) {
    debug('getAllAuditlog()');
    users.loadUser(app, loggedInUserId, (err, userInfo) => {
        if (err) {
            return utils.fail(res, 500, 'getAllAuditlog: Could not load user.', err);
        }
        if (!userInfo) {
            return utils.fail(res, 403, 'Not allowed.');
        }
        if (!userInfo.admin ) {
            return utils.fail(res, 403, 'Not allowed. This is admin land.');
        }
      
        if (embed) {
            dao.auditlog.getAll(filter, orderBy, offset, limit, noCountCache, (err, auditlogIndex, countResult) => {
                if (err) {
                    return utils.fail(res, 500, 'getAllAuditlog: getAll failed', err);
                }
                res.json({
                    items: auditlogIndex,
                    count: countResult.count,
                    count_cached: countResult.cached,
                    offset: offset,
                    limit: limit
                });
            });
        } else {
            dao.auditlog.getIndex(offset, limit, (err, auditlogIndex, countResult) => {
                if (err) {
                    return utils.fail(res, 500, 'getAllAuditlog: getIndex failed', err);
                }
                res.json({
                    items: auditlogIndex,
                    count: countResult.count,
                    count_cached: countResult.cached,
                    offset: offset,
                    limit: limit
                });
            });
        }
    });
};

function retryAuditLog(app, triesLeft, eventData, callback) {
    debug('retryAuditLog(), triesLeft: ' + triesLeft);
    dao.auditlog.create(eventData, (err) => {
        if (err) {
            // Retries left?
            if (triesLeft > 0) {
                // Call ourselves again in around 100 milliseconds. Note the currying
                // of the arguments of setTimeout, which are passed into retryLog.
                setTimeout(retryAuditLog, 100, app, triesLeft - 1, eventData, callback);
            } else {
                callback(err);
            }
        } else {
            // Woo hoo.
            callback(null);
        }
    });
}

function populateUserInfo(userId) {
    return new Promise(function(resolve, reject) {
        async.parallel({
            getUser: callback => dao.users.getById(userId, callback),
            getRegistration: callback =>  dao.registrations.getByPoolAndUser("wicked", userId, callback) //hardcode "wicked"?
        }, function (err, results) {
            if (err) {
                reject(err);
            }
            let userInfo = results.getUser;
            let userRegInfo = results.getRegistration;
            userRegInfo = userRegInfo[0];
            userRegInfo = Array.isArray(userRegInfo) ? userRegInfo[0]: userRegInfo;  //pick first...lame
            if (userInfo) {
                let role = daoUtils.isUserApprover(userInfo) ? "Approver" : "User";
                role = daoUtils.isUserAdmin(userInfo) ? "Admin" :  role;
                resolve({ role: role,
                    email: userInfo.email,
                    name: (userRegInfo && userRegInfo.name) ? userRegInfo.name : ""
                });
            }
        }); 
    });
}

async function populateUsersInfo(eventData) {
    let user, updatedUser;
    user = await populateUserInfo(eventData.data.userId);
    if (eventData.data.addedUserId) {
        updatedUser = await populateUserInfo(eventData.data.addedUserId);
    }
    if (eventData.data.deletedUserId) {
        updatedUser = await populateUserInfo(eventData.data.deletedUserId);
    }
    if (eventData.data.updatedUserId) {
        updatedUser = await populateUserInfo(eventData.data.updatedUserId);
    }
    return { user: user,
        updatedUser: updatedUser
    };
}

auditlog.logEvent = function (app, eventData, callback) {
    debug('auditlog.logEvent()');
    const glob = utils.loadGlobals();
    if (glob.auditlog && glob.auditlog.useAuditlog) {
        populateUsersInfo(eventData).then(function(result) {
            eventData.data.user = result.user;
            eventData.data['updatedUser'] = result.updatedUser;
            setTimeout(retryAuditLog, 0, app, 5, eventData, function (err) {
                debug('retryAuditLog() called back');
                // We have no results, we just want to check for errors
                if (err) {
                    debug(err);
                    error(err);
                }
                if (callback) {
                    return callback(err);
                }
            });
        }); 
    } else {
        debug('auditlog Turned OFF');
    }   
};

module.exports = auditlog;