'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:accesstokens');
const utils = require('./utils');
const dao = require('../dao/dao');

const accessTokens = require('express').Router();

// ===== SCOPES =====

const ACCESS_TOKENS = 'access_tokens';
const verifyAccessTokensScope = utils.verifyScope(ACCESS_TOKENS);

// ===== INITIALIZATION =====

const ACCESSTOKEN_CLEANUP_INTERVAL = 600; //seconds (10 minutes)

accessTokens.setup = function (users) {
    accessTokens._usersModule = users;
};

accessTokens.initialize = () => {
    debug('initialize()');
    if (!dao.isReady()) {
        debug('auditlog Dao not ready yet: initialize()');
        setTimeout(accessTokens.initialize, 500);
        return;
    }
    cleanAccessTokens();
    setInterval(cleanAccessTokens, ACCESSTOKEN_CLEANUP_INTERVAL * 1000);
};

function cleanAccessTokens() {
    debug('cleanAccessTokens(): Delete expired access tokens');
    dao.accessTokens.cleanup((err) => {
        if (err) {
            error('cleanAccessTokens(): Cleanup of access tokens failed.');
            error(err.stack);
        } else {
            debug('cleanAccessTokens(): Finished successfully.');
        }
    });
}

// ===== ENDPOINTS =====

accessTokens.get('/', verifyAccessTokensScope, function (req, res, next) {
    debug('GET /accesstoken');
    const { access_token, refresh_token, authenticated_userid } = req.query;
    if (!access_token && !refresh_token && !authenticated_userid) {
        return utils.fail(res, 400, 'Either access_token, refresh_token or authenticated_userid must be passed as a query parameter');
    }
    const paramCount = (access_token ? 1 : 0) + (refresh_token ? 1 : 0) + (authenticated_userid ? 1 : 0);
    if (paramCount !== 1) {
        return utils.fail(res, 400, 'Only one of access_token, refresh_token or authenticated_userid can be passed as a query parameter');
    }
    accessTokens.getAccessTokens(res, accessTokens._usersModule, req.apiUserId, access_token, refresh_token, authenticated_userid);
});

accessTokens.delete('/', verifyAccessTokensScope, function (req, res, next) {
    debug('DELETE /accesstoken');
    const { access_token, refresh_token, authenticated_userid } = req.query;
    if (!access_token && !refresh_token && !authenticated_userid) {
        return utils.fail(res, 400, 'Either access_token, refresh_token or authenticated_userid must be passed as a query parameter');
    }
    const paramCount = (access_token ? 1 : 0) + (refresh_token ? 1 : 0) + (authenticated_userid ? 1 : 0);
    if (paramCount !== 1) {
        return utils.fail(res, 400, 'Only one of access_token, refresh_token or authenticated_userid can be passed as a query parameter');
    }
    accessTokens.deleteAccessTokens(res, accessTokens._usersModule, req.apiUserId, access_token, refresh_token, authenticated_userid);
});

accessTokens.post('/', verifyAccessTokensScope, function (req, res, next) {
    debug('POST /accesstoken');
    const {
        access_token,
        expires,
        expires_in, // Informational purposes only; expires is the index
        refresh_token,
        expires_refresh,
        authenticated_userid,
        scope,
        users_id,
        api_id,
        plan_id,
        application_id,
        profile,
        auth_method,
        grant_type,
        token_type,
        client_id,
    } = req.body;
    if (!access_token || !expires) {
        return utils.fail(res, 400, 'access_token and expires are mandatory properties');
    }
    if (!api_id || !plan_id || !application_id) {
        return utils.fail(res, 400, 'api_id, plan_id, application_id and subscription_id are mandatory properties');
    }
    if (refresh_token && !expires_refresh) {
        return utils.fail(res, 400, 'If refresh_token is passed in, expires_refresh is required');
    }
    accessTokens.addAccessToken(res, accessTokens._usersModule, req.apiUserId, {
        access_token,
        expires,
        expires_in,
        refresh_token,
        expires_refresh,
        authenticated_userid,
        scope,
        users_id,
        api_id,
        plan_id,
        application_id,
        profile,
        auth_method,
        grant_type,
        token_type,
        client_id
    });
});

// ===== IMPLEMENTATION =====

accessTokens.getAccessTokens = function (res, users, loggedInUserId, access_token, refresh_token, authenticated_userid) {
    debug(`getAccessTokens(${loggedInUserId}, ${access_token}, ${refresh_token}, ${authenticated_userid})`);
    let method = null;
    let parameter = null;
    if (access_token) {
        method = 'getByAccessToken';
        parameter = access_token;
    }
    if (refresh_token) {
        method = 'getByRefreshToken';
        parameter = refresh_token;
    }
    if (authenticated_userid) {
        method = 'getByAuthenticatedUserId';
        parameter = authenticated_userid;
    }
    users.loadUser(null, loggedInUserId, function (err, userInfo) {
        if (err) {
            error(`getAccessTokens: Could not load user ${loggedInUserId}`);
            error(err.stack);
            return utils.fail(res, 500, 'Internal Server Error: Could not load user.');
        }
        if (!userInfo || !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. User invalid or not an Admin.');
        }
        dao.accessTokens[method](parameter, function (err, accessTokenRows, countResult) {
            if (err) {
                error('GET: DAO returned an unexpected error.');
                error(err.stack);
                return utils.fail(res, 500, 'Internal Server Error: DAO could not retrieve access tokens.');
            }
            res.json({
                items: accessTokenRows.map(at => { delete at.id; return at; }),
                count: Number(countResult.count),
                count_cached: countResult.cached,
                offset: 0,
                limit: Number(countResult.count)
            });
        });
    });
};

accessTokens.addAccessToken = function (res, users, loggedInUserId, tokenData) {
    users.loadUser(null, loggedInUserId, function (err, userInfo) {
        if (err) {
            error(`addAccessToken: Could not load user ${loggedInUserId}`);
            error(err.stack);
            return utils.fail(res, 500, 'Internal Server Error: Could not load user.');
        }
        if (!userInfo || !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. User invalid or not an Admin.');
        }
        dao.accessTokens.insert(tokenData, function (err) {
            if (err) {
                error('POST: Failed to insert access token!');
                error(err.stack);
                return utils.fail(res, 500, 'Failed to insert access token. See logs for more details');
            }
            return res.status(201).json({ message: 'Inserted.' });
        });
    });
};

accessTokens.deleteAccessTokens = function (res, users, loggedInUserId, access_token, refresh_token, authenticated_userid) {
    debug(`deleteAccessTokens(${loggedInUserId}, ${access_token}, ${refresh_token}, ${authenticated_userid})`);
    let method = null;
    let parameter = null;
    if (access_token) {
        method = 'deleteByAccessToken';
        parameter = access_token;
    }
    if (refresh_token) {
        method = 'deleteByRefreshToken';
        parameter = refresh_token;
    }
    if (authenticated_userid) {
        method = 'deleteByAuthenticatedUserId';
        parameter = authenticated_userid;
    }
    users.loadUser(null, loggedInUserId, function (err, userInfo) {
        if (err) {
            error(`deleteAccessTokens: Could not load user ${loggedInUserId}`);
            error(err.stack);
            return utils.fail(res, 500, 'Internal Server Error: Could not load user.');
        }
        if (!userInfo || !userInfo.admin) {
            return utils.fail(res, 403, 'Not allowed. User invalid or not an Admin.');
        }
        dao.accessTokens[method](parameter, function (err) {
            if (err) {
                error('GET: DAO returned an unexpected error.');
                error(err.stack);
                return utils.fail(res, 500, 'Internal Server Error: DAO could not retrieve access tokens.');
            }
            res.status(204).json({ message: 'Accepted delete request.' });
        });
    });

};

module.exports = accessTokens;
