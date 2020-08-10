'use strict';

import { NumberCallback, SimpleCallback, TokenResponse, OidcProfileEx } from "./types";
import { Callback } from "wicked-sdk";

const crypto = require('crypto');
import * as wicked from 'wicked-sdk';
const { URL } = require('url');
const qs = require('querystring');

const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:profile-store');
import { redisConnection } from './redis-connection';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

export class ProfileStore {

    private _ttlSecondsMap: { [index: string]: number } = {};

    constructor() {
        debug(`constructor()`);
        // Empty
    }

    // profileStore._ttlSecondsMap = {};
    public getTtlSeconds = (apiId: string, callback: NumberCallback) => {
        debug(`getTtlSeconds(${apiId})`);
        const instance = this;
        if (this._ttlSecondsMap[apiId])
            return callback(null, this._ttlSecondsMap[apiId]);
        wicked.getApi(apiId, function (err, apiConfig) {
            if (err)
                return callback(err);
            if (!apiConfig.settings)
                return failMessage(500, `getTtlSeconds: API ${apiId} does not have a settings property.`, callback);
            if (!apiConfig.settings.token_expiration)
                return failMessage(500, `getTtlSeconds: API ${apiId} does not have a settings.token_expiration property.`, callback);
            const ttlSeconds = Number(apiConfig.settings.token_expiration); // force conversion to number
            if (ttlSeconds <= 0)
                return failMessage(500, `getTtlSeconds: API ${apiId} has a token expiration of 0 or a negative number.`, callback);
            instance._ttlSecondsMap[apiId] = ttlSeconds;
            return callback(null, ttlSeconds);
        });
    };

    public registerTokenOrCode = (tokenResponse: TokenResponse, apiId: string, profile: OidcProfileEx, callback: SimpleCallback) => {
        debug(`registerTokenOrCode(${apiId})`);
        if (tokenResponse.access_token) {
            // Easy case, it's a JSON answer
            debug(`registerTokenOrCode: Token ${tokenResponse.access_token}`);
            return this.store(tokenResponse.access_token, apiId, profile, callback);
        } else if (tokenResponse.redirect_uri) {
            // It's the answer from an implicit token, let's parse the URL
            const redir = new URL(tokenResponse.redirect_uri);
            debug(`registerTokenOrCode: Redir ${redir}`);
            if (redir.hash) {
                if (!redir.hash.startsWith('#'))
                    return failMessage(500, 'registerToken: The redirect URI fragment does not start with a hash tag', callback);
                const queryParams = qs.parse(redir.hash.substring(1)); // cut off hash
                // Now off you go
                if (queryParams.access_token)
                    return this.store(queryParams.access_token, apiId, profile, callback);
                return failMessage(500, 'registerToken: The redirect URI does not contain a fragment', callback);
            }
            // If there is no hash, we might have a code
            if (redir.searchParams && redir.searchParams.get('code'))
                return this.store(redir.searchParams.get('code'), apiId, profile, callback);

            return failMessage(500, 'registerToken: The redirect URI does not contain neither an access_token nor a code parameter', callback);
        }
    };

    public registerTokenOrCodeAsync = async (tokenResponse: TokenResponse, apiId: string, profile: OidcProfileEx): Promise<any> => {
        debug(`registerTokenOrCode(${apiId})`);
        const instance = this;
        return new Promise((resolve, reject) => {
            instance.registerTokenOrCode(tokenResponse, apiId, profile, (err) => {
                err ? reject(err) : resolve();
            });
        });
    }

    public deleteTokenOrCode(token: string, callback?: SimpleCallback) {
        debug(`deleteTokenOrCode(${token})`);
        const redis = redisConnection.getRedis();
        redis.del(token, (err) => {
            if (err) {
                debug('deleteTokenOrCode: redis.delete returned an error when deleting token ' + token);
                debug(err);
                if (callback)
                    return callback(err);
                return;
            }
            if (callback)
                return callback(null);
            return;
        });
    };

    public store = (token: string, apiId: string, profile: OidcProfileEx, callback: SimpleCallback) => {
        debug('store()');
        const instance = this;
        this.getTtlSeconds(apiId, function (err, ttlSeconds) {
            if (err)
                return callback(err);
            const profileString = JSON.stringify(profile);
            const redis = redisConnection.getRedis();
            const tokenHash = instance.hashToken(token);
            redis.set(tokenHash, profileString, 'EX', ttlSeconds, callback);
        });
    };

    public retrieve = (token: string, callback: Callback<OidcProfileEx>) => {
        debug('retrieve()');

        const redis = redisConnection.getRedis();
        const tokenHash = this.hashToken(token);
        redis.get(tokenHash, function (err, result) {
            if (err)
                return callback(err);
            const profileJson = JSON.parse(result);
            return callback(null, profileJson);
        });
    };

    public retrieveAsync = async (token: string): Promise<OidcProfileEx> => {
        return new Promise((resolve, reject) => {
            this.retrieve(token, (err, result) => {
                err ? reject(err) : resolve(result);
            });
        });
    };

    private hashToken(token: string): string {
        const sha256 = crypto.createHash('sha256');
        sha256.update(token);
        return sha256.digest('hex');
    }
};

export const profileStore = new ProfileStore();

//module.exports = ProfileStore;
