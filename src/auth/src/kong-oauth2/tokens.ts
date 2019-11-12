'use strict';

import { TokenInfoCallback, SimpleCallback, TokenInfo, KongTokenInfo } from "../common/types";

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:tokens');
const qs = require('querystring');
const fs = require('fs');

import { utils } from '../common/utils';
import { kongUtils }  from './kong-utils';
import { failOAuth, failJson } from '../common/utils-fail';

export const tokens = {
    getTokenDataByAccessTokenAsync: async function (accessToken: string): Promise<TokenInfo> {
        return new Promise<TokenInfo>(function (resolve, reject) {
            tokens.getTokenDataByAccessToken(accessToken, function (err, data) {
                err ? reject(err) : resolve(data);
            });
        })
    },

    getTokenDataByAccessToken: function (accessToken: string, callback: TokenInfoCallback) {
        debug('getTokenDataByAccessToken()');
        return tokens.getTokenData(accessToken, null, callback);
    },

    getTokenDataByRefreshTokenAsync: async function (refreshToken: string): Promise<TokenInfo> {
        return new Promise<TokenInfo>(function (resolve, reject) {
            tokens.getTokenDataByRefreshToken(refreshToken, function (err, data) {
                err ? reject(err) : resolve(data);
            });
        });
    },

    getTokenDataByRefreshToken: function (refreshToken: string, callback: TokenInfoCallback) {
        debug('getTokenDataByRefreshToken()');
        return tokens.getTokenData(null, refreshToken, callback);
    },

    getTokenData: function (accessToken: string, refreshToken: string, callback: TokenInfoCallback) {
        debug('getTokenData(), access_token = ' + accessToken + ', refresh_token = ' + refreshToken);
        let tokenUrl = 'oauth2_tokens?';
        if (accessToken)
            tokenUrl = tokenUrl + 'access_token=' + qs.escape(accessToken);
        else if (refreshToken)
            tokenUrl = tokenUrl + 'refresh_token=' + qs.escape(refreshToken);
        kongUtils.kongGet(tokenUrl, function (err, resultList) {
            if (err) {
                return failJson(500, 'could not retrieve token information from Kong', err, callback);
            }

            if (resultList.total <= 0 || !resultList.data || resultList.data.length <= 0) {
                return failJson(404, 'not found', callback);
            }

            return callback(null, resultList.data[0]);
        });
    },

    deleteTokensByAccessToken: function (accessToken: string, callback: SimpleCallback) {
        debug('deleteTokensByAccessToken()');
        tokens.deleteTokens(accessToken, null, callback);
    },

    deleteTokensByAuthenticatedUserId: function (authenticatedUserId: string, callback: SimpleCallback) {
        debug('deleteTokensByAuthenticatedUserId()');
        tokens.deleteTokens(null, authenticatedUserId, callback);
    },

    deleteTokens: function (accessToken: string, authenticatedUserId: string, callback: SimpleCallback) {
        debug('deleteTokens(), accessToken = ' + accessToken + ', authenticatedUserId = ' + authenticatedUserId);

        // This function is called below with a list of access tokens, depending on how
        // the tokens are gathered (either directly, a single token, or by a user id)
        const kongDeleteTokens = function (tokenList: string[]) {
            async.mapSeries(tokenList, function (token: string, callback: SimpleCallback) {
                kongUtils.kongDelete('oauth2_tokens/' + qs.escape(token), callback);
            }, function (err, results) {
                if (err) {
                    return failJson(500, 'Deleting tokens failed. See log for details.', callback);
                }

                return callback(null); // Success
            });
        };

        if (accessToken) {
            // Delete single token mode
            return kongDeleteTokens([accessToken]);
        } else if (authenticatedUserId) {
            // First get the list of access tokens by user id
            kongUtils.kongGet('oauth2_tokens?authenticated_userid=' + qs.escape(authenticatedUserId), function (err, result: KongTokenInfo) {
                if (err) {
                    return failJson(500, 'Kong did not return desired access tokens.', callback);
                }
                if (!result.data || !Array.isArray(result.data)) {
                    return failJson(500, 'Kong returned an invalid result (data is not present or not an array).', callback);
                }
                const tokenList = [];
                for (let i = 0; i < result.data.length; ++i) {
                    tokenList.push(result.data[i].access_token);
                }
                return kongDeleteTokens(tokenList);
            });
        } else {
            return failJson(400, 'Bad request. Needs either access_token or authenticated_userid.', callback);
        }
    }
};

// module.exports = tokens;
