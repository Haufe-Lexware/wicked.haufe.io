'use strict';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:accesstokens');

class PgAccessTokens {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByAccessToken(accessToken, callback) {
        debug('getByAccessToken()');
        this.pgUtils.checkCallback(callback);
        return this.getByAccessTokenImpl(accessToken, callback);
    }

    getByRefreshToken(refreshToken, callback) {
        debug('getByRefreshToken()');
        this.pgUtils.checkCallback(callback);
        return this.getByRefreshTokenImpl(refreshToken, callback);
    }

    getByAuthenticatedUserId(authenticatedUserId, callback) {
        debug('getByAuthenticatedUserId()');
        this.pgUtils.checkCallback(callback);
        return this.getByAuthenticatedUserIdImpl(authenticatedUserId, callback);
    }

    getByUserId(userId, callback) {
        debug('getByUserId()');
        this.pgUtils.checkCallback(callback);
        return this.getByUserIdImpl(userId, callback);
    }

    insert(tokenData, callback) {
        debug('insert()');
        this.pgUtils.checkCallback(callback);
        return this.insertImpl(tokenData, callback);
    }

    deleteByAccessToken(accessToken, callback) {
        debug('deleteByAccessToken()');
        this.pgUtils.checkCallback(callback);
        return this.deleteByAccessTokenImpl(accessToken, callback);
    }

    deleteByRefreshToken(refreshToken, callback) {
        debug('deleteByRefreshToken()');
        this.pgUtils.checkCallback(callback);
        return this.deleteByRefreshTokenImpl(refreshToken, callback);
    }

    deleteByAuthenticatedUserId(authenticatedUserId, callback) {
        debug('deleteByAccessToken()');
        this.pgUtils.checkCallback(callback);
        return this.deleteByAuthenticatedUserIdImpl(authenticatedUserId, callback);
    }

    deleteByUserId(userId, callback) {
        debug('deleteByUserId()');
        this.pgUtils.checkCallback(callback);
        return this.deleteByUserIdImpl(userId, callback);
    }

    cleanup(callback) {
        debug('cleanup()');
        this.pgUtils.checkCallback(callback);
        return this.cleanupImpl(callback);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByAccessTokenImpl(accessToken, callback) {
        debug(`getByAccessTokenImpl(${accessToken})`);
        this.pgUtils.getBy('access_tokens', 'access_token', accessToken, { noCountCache: true }, callback);
    }

    getByRefreshTokenImpl(refreshToken, callback) {
        debug(`getByRefreshTokenImpl(${refreshToken})`);
        this.pgUtils.getBy('access_tokens', 'refresh_token', refreshToken, { noCountCache: true }, callback);
    }

    getByAuthenticatedUserIdImpl(authenticatedUserId, callback) {
        debug(`getByAuthenticatedUserIdImpl(${authenticatedUserId})`);
        this.pgUtils.getBy('access_tokens', 'authenticated_userid', authenticatedUserId, { noCountCache: true }, callback);
    }

    getByUserIdImpl(userId, callback) {
        debug(`getByUserId(${userId})`);
        this.pgUtils.getBy('access_tokens', 'users_id', userId, { noCountCache: true }, callback);
    }

    insertImpl(tokenData, callback) {
        debug(`insertImpl(${tokenData.access_token})`);
        this.pgUtils.upsert('access_tokens',  { ...tokenData, id: tokenData.access_token }, null, callback);
    }

    deleteByAccessTokenImpl(accessToken, callback) {
        debug(`deleteByAccessTokenImpl(${accessToken})`);
        this.pgUtils.deleteBy('access_tokens', 'access_token', accessToken, callback);
    }

    deleteByRefreshTokenImpl(refreshToken, callback) {
        debug(`deleteByRefreshTokenImpl(${refreshToken})`);
        this.pgUtils.deleteBy('access_tokens', 'refresh_token', refreshToken, callback);
    }

    deleteByAuthenticatedUserIdImpl(authenticatedUserId, callback) {
        debug(`deleteByAuthenticatedUserIdImpl(${authenticatedUserId})`);
        this.pgUtils.deleteBy('access_tokens', 'authenticated_userid', authenticatedUserId, callback);
    }

    deleteByUserIdImpl(userId, callback) {
        debug(`deleteByUserIdImpl(${userId})`);
        this.pgUtils.deleteBy('access_tokens', 'users_id', userId, callback);
    }

    cleanupImpl(callback) {
        // DELETE expired records by refresh_token (if set)
        // DELETE expired records by access_token (if refresh_token is not set)
        debug('cleanup()');
        const now = Date.now();
        async.series([
            callback => this.pgUtils.deleteExpired('access_tokens', 'expires', now, 'refresh_token IS NULL', callback),
            callback => this.pgUtils.deleteExpired('access_tokens', 'expires_refresh', now, 'refresh_token IS NOT NULL', callback)
        ], callback);
    }
}

module.exports = PgAccessTokens;
