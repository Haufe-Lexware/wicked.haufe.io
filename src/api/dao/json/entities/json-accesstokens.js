'use strict';

const { error } = require('portal-env').Logger('portal-api:dao:json:accesstokens');

class JsonAccessTokens
{
    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByAccessToken(accessToken, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }
    
    getByRefreshToken(refreshToken, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }
    
    getByAuthenticatedUserId(authenticatedUserId, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }
    
    getByUserId(userId, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }
    
    insert(tokenData, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }
    
    deleteByAccessToken(accessToken, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }

    deleteByRefreshToken(refreshToken, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');
    }
    
    deleteByAuthenticatedUserId(authenticatedUserId, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');        
    }

    deleteByUserId(userId, callback) { // eslint-disable-line no-unused-vars
        throw new Error('This functionality is not supported by the JSON DAO (yet).');        
    }

    cleanup(callback) { // eslint-disable-line no-unused-vars 
        error('cleanup: Not implemented, ignoring.');
    }
}

module.exports = JsonAccessTokens;
