'use strict';

import * as crypto from 'crypto';
import { SimpleCallback, StringCallback, AuthRequest, TokenRequest, OAuth2Request, AccessToken, AccessTokenCallback } from '../common/types';
import { WickedApplication, WickedClientType, WickedSubscription, KongApi, WickedApi, Callback } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:oauth2');
const async = require('async');
import * as wicked from 'wicked-sdk';
const request = require('request');

import { utils } from '../common/utils';
import { kongUtils } from './kong-utils';
import { failOAuth } from '../common/utils-fail';

// We need this to accept self signed and Let's Encrypt certificates
var https = require('https');
var agentOptions = { rejectUnauthorized: false };
var sslAgent = new https.Agent(agentOptions);

// interface InputData {
//     grant_type?: string,
//     response_type?: string,
//     authenticated_userid: string,
//     auth_method: string,
//     api_id: string,
//     client_id?: string,
//     client_secret?: string,
//     refresh_token?: string,
//     code?: string,
//     scope: string[],
//     session_data?: string
// }

// interface SubscriptionInfo {
//     application: string,
//     api: string,
//     auth: string,
//     plan: string,
//     clientId: string,
//     clientSecret: string,
//     trusted: boolean
// }

// interface ApplicationInfo {
//     id: string,
//     name: string
//     redirectUri: string,
//     confidential: boolean
// }

interface ConsumerInfo {
    id: string,
    username: string,
    custom_id: string
}

interface KongOAuth2Config {
    provision_key: string,
    enable_client_credentials: boolean,
    enable_implicit_grant: boolean,
    enable_authorization_code: boolean,
    enable_password_grant: boolean
}

interface OAuthInfo {
    inputData: OAuth2Request,
    oauth2Config: KongOAuth2Config,
    provisionKey: string,
    subsInfo: WickedSubscription,
    appInfo: WickedApplication,
    consumer: ConsumerInfo,
    apiInfo: KongApi,
}

interface OAuthInfoCallback {
    (err, oauthInfo?: OAuthInfo): void
}

interface AuthorizeOAuthInfo extends OAuthInfo {
    inputData: AuthRequest,
    redirectUri?: string
}

interface TokenOAuthInfo extends OAuthInfo {
    inputData: TokenRequest,
    accessToken?: AccessToken
}

interface AuthorizeOAuthInfoCallback {
    (err, oauthInfo?: AuthorizeOAuthInfo): void
}

interface TokenOAuthInfoCallback {
    (err, oauthInfo?: TokenOAuthInfo): void
}

interface RedirectUri {
    redirect_uri: string,
    session_data?: string
}

interface RedirectUriCallback {
    (err, authorizeData?: RedirectUri): void
}

interface RequestHeaders {
    [name: string]: string
}

interface AuthorizeRequestPayload {
    url: string,
    headers: RequestHeaders,
    agent: any,
    json: boolean,
    body: object
}

interface AuthorizeRequestPayloadCallback {
    (err, authorizeRequest?: AuthorizeRequestPayload): void
}

interface TokenKongInvoker {
    (oauthInfo: OAuthInfo, callback: TokenOAuthInfoCallback): void
}

interface AuthorizeKongInvoker {
    (oauthInfo: OAuthInfo, callback: AuthorizeOAuthInfoCallback): void
}

interface TokenRequestPayload {
    url: string,
    headers: RequestHeaders,
    agent: any,
    json: boolean,
    body: object
}

interface TokenRequestPayloadCallback {
    (err, tokenRequest?: TokenRequestPayload): void
}

export const oauth2 = {
    authorize: function (inputData: AuthRequest, callback: RedirectUriCallback) {
        validateResponseType(inputData, function (err) {
            if (err)
                return callback(err);
            switch (inputData.response_type) {
                case 'token':
                    return authorizeImplicit(inputData, callback);
                case 'code':
                    return authorizeAuthorizationCode(inputData, callback);
            }
            return failOAuth(400, 'invalid_request', 'unknown error or response_type invalid.', callback);
        });
    },

    tokenAsync: function (inputData: TokenRequest): Promise<AccessToken> {
        const instance = this;
        return new Promise<AccessToken>(function (resolve, reject) {
            instance.token(inputData, function (err, accessToken) {
                err ? reject(err) : resolve(accessToken);
            })
        });
    },

    token: function (inputData: TokenRequest, callback: AccessTokenCallback) {
        validateGrantType(inputData, function (err) {
            if (err)
                return callback(err);
            function appendScopeIfNeeded(err, accessToken) {
                if (err)
                    return callback(err);
                if (inputData.scope_differs) {
                    if (!inputData.scope)
                        accessToken.scope = '';
                    else
                        accessToken.scope = inputData.scope.join(' ');
                }
                return callback(null, accessToken);
            }
            switch (inputData.grant_type) {
                case 'client_credentials':
                    return tokenClientCredentials(inputData, appendScopeIfNeeded);
                case 'authorization_code':
                    return tokenAuthorizationCode(inputData, appendScopeIfNeeded);
                case 'refresh_token':
                    return tokenRefreshToken(inputData, appendScopeIfNeeded);
                case 'password':
                    return tokenPasswordGrant(inputData, appendScopeIfNeeded);
            }
            return failOAuth(400, 'invalid_request', 'unknown error or grant_type invalid', callback);
        });
    }
};

// -----------------------------------

function validateResponseType(inputData: AuthRequest, callback: SimpleCallback) {
    debug('validateResponseType()');
    debug('responseType: ' + inputData.response_type);
    if (!inputData.response_type)
        return failOAuth(400, 'invalid_request', 'response_type is missing', callback);
    if (!inputData.auth_method)
        return failOAuth(400, 'invalid_request', 'auth_method is missing', callback);
    if (!inputData.api_id)
        return failOAuth(400, 'invalid_request', 'api_id is missing', callback);
    switch (inputData.response_type) {
        case "token":
        case "code":
            return callback(null);
    }
    return failOAuth(400, 'unsupported_response_type', `invalid response_type '${inputData.response_type}'`, callback);
}

function validateGrantType(inputData: TokenRequest, callback: SimpleCallback) {
    debug('validateGrantType()');
    debug(`grant_type: ${inputData.grant_type}`);
    if (!inputData.grant_type)
        return failOAuth(400, 'invalid_request', 'grant_type is missing', callback);
    if (!inputData.auth_method)
        return failOAuth(400, 'invalid_request', 'auth_method is missing', callback);
    if (!inputData.api_id)
        return failOAuth(400, 'invalid_request', 'api_id is missing', callback);
    switch (inputData.grant_type) {
        case 'authorization_code':
        case 'client_credentials':
        case 'refresh_token':
        case 'password':
            return callback(null);
    }
    return failOAuth(400, 'invalid_request', `invalid grant_type ${inputData.grant_type}`, callback);
}

// -----------------------------------
// IMPLICIT GRANT
// -----------------------------------

function authorizeImplicit(inputData: AuthRequest, callback: RedirectUriCallback) {
    debug('authorizeImplicit()');
    // debug(inputData);
    async.series({
        validate: function (callback) { validateImplicit(inputData, callback); },
        redirectUri: function (callback) { authorizeImplicitInternal(inputData, callback); }
    }, function (err, results) {
        if (err)
            return callback(err);

        // Fetch result of authorizeImplicitInternal
        const returnValue = {
            redirect_uri: results.redirectUri,
            session_data: null
        };
        // If session_data was provided, also return it
        if (inputData.session_data)
            returnValue.session_data = inputData.session_data;

        callback(null, returnValue);
    });
}

function validateImplicit(inputData: AuthRequest, callback: SimpleCallback) {
    debug('validateImplicit()');
    debug('authRequest: ' + JSON.stringify(inputData));
    if (!inputData.client_id)
        return failOAuth(400, 'invalid_request', 'client_id is missing', callback);
    if (inputData.client_secret)
        return failOAuth(400, 'invalid_request', 'client_secret must not be passed in', callback);
    if (!inputData.authenticated_userid)
        return failOAuth(400, 'invalid_request', 'authenticated_userid is missing', callback);
    if (inputData.scope) {
        if ((typeof (inputData.scope) !== 'string') &&
            !Array.isArray(inputData.scope))
            return failOAuth(400, 'invalid_scope', 'scope has to be either a string or a string array', callback);
    }
    callback(null);
}

function authorizeImplicitInternal(inputData: AuthRequest, callback: StringCallback) {
    debug('authorizeImplicitInternal()');
    return authorizeFlow(inputData, authorizeImplicitKong, callback);
}

function authorizeImplicitKong(oauthInfo: AuthorizeOAuthInfo, callback: AuthorizeOAuthInfoCallback) {
    debug('authorizeImplicitKong()');
    // Check that the API is configured for implicit grant
    if (!oauthInfo.oauth2Config ||
        !oauthInfo.oauth2Config.enable_implicit_grant) {
        return failOAuth(401, 'unauthorized_client', 'The API ' + oauthInfo.inputData.api_id + ' is not configured for the OAuth2 implicit grant', callback);
    }

    return authorizeWithKong(oauthInfo, 'token', callback);
}

// -----------------------------------
// AUTHORIZATION CODE GRANT - AUTHORIZE
// -----------------------------------

function authorizeAuthorizationCode(inputData: AuthRequest, callback: RedirectUriCallback) {
    debug('authorizeAuthorizationCode()');
    debug(inputData);
    async.series({
        validate: function (callback) { validateAuthorizationCode(inputData, callback); },
        redirectUri: function (callback) { authorizeAuthorizationCodeInternal(inputData, callback); }
    }, function (err, results) {
        if (err)
            return callback(err);

        // Fetch result of authorizeAuthorizationCodeInternal
        const returnValue = {
            redirect_uri: results.redirectUri,
            session_data: null
        };
        // If session_data was provided, also return it
        if (inputData.session_data)
            returnValue.session_data = inputData.session_data;

        callback(null, returnValue);
    });
}

function validateAuthorizationCode(inputData: AuthRequest, callback: SimpleCallback) {
    debug('validateAuthorizationCode()');
    debug('inputData: ' + JSON.stringify(inputData));
    if (!inputData.client_id)
        return failOAuth(400, 'invalid_request', 'client_id is missing', callback);
    if (inputData.client_secret)
        return failOAuth(400, 'invalid_request', 'client_secret must not be passed in', callback);
    if (!inputData.authenticated_userid)
        return failOAuth(400, 'invalid_request', 'authenticated_userid is missing', callback);
    if (inputData.scope) {
        if ((typeof (inputData.scope) !== 'string') &&
            !Array.isArray(inputData.scope))
            return failOAuth(400, 'invalid_scope', 'scope has to be either a string or a string array', callback);
    }
    callback(null);
}

function authorizeAuthorizationCodeInternal(inputData: AuthRequest, callback: StringCallback) {
    debug('authorizeAuthorizationCodeInternal()');
    return authorizeFlow(inputData, authorizeAuthorizationCodeKong, callback);
}

function authorizeAuthorizationCodeKong(oauthInfo: AuthorizeOAuthInfo, callback: AuthorizeOAuthInfoCallback) {
    debug('authorizeAuthorizationCodeKong()');
    // Check that the API is configured for authorization code grant
    if (!oauthInfo.oauth2Config ||
        !oauthInfo.oauth2Config.enable_authorization_code)
        return failOAuth(401, 'unauthorized_client', 'The API ' + oauthInfo.inputData.api_id + ' is not configured for the OAuth2 Authorization Code grant.', callback);

    return authorizeWithKong(oauthInfo, 'code', callback);
}

function authorizeWithKong(oauthInfo: AuthorizeOAuthInfo, responseType: string, callback: AuthorizeOAuthInfoCallback) {
    debug('authorizeWithKong()');
    async.waterfall([
        callback => createAuthorizeRequest(responseType, oauthInfo, callback),
        (authorizeRequest, callback) => postAuthorizeRequest(authorizeRequest, callback)
    ], function (err, redirectUri) {
        if (err)
            return callback(err);
        oauthInfo.redirectUri = redirectUri;
        return callback(null, oauthInfo);
    });
}

// -----------------------------------
// AUTHORIZATION CODE GRANT - TOKEN
// -----------------------------------

function tokenAuthorizationCode(inputData: TokenRequest, callback: AccessTokenCallback): void {
    debug('tokenAuthorizationCode()');
    debug(inputData);
    async.series({
        validate: function (callback) { validateTokenAuthorizationCode(inputData, callback); },
        accessToken: function (callback) { tokenAuthorizationCodeInternal(inputData, callback); }
    }, function (err, result) {
        if (err)
            return callback(err);
        return callback(null, result.accessToken);
    });
}

function validateTokenAuthorizationCode(inputData: TokenRequest, callback: SimpleCallback): void {
    debug('validateTokenAuthorizationCode()');
    if (!inputData.client_id)
        return failOAuth(400, 'invalid_request', 'client_id is missing', callback);
    if (!inputData.client_secret && !inputData.code_verifier)
        return failOAuth(400, 'invalid_request', 'client_secret or code_verifier is missing', callback);
    if (!inputData.code)
        return failOAuth(400, 'invalid_request', 'code is missing', callback);
    callback(null);
}

function tokenAuthorizationCodeInternal(inputData: TokenRequest, callback: AccessTokenCallback) {
    debug('tokenAuthorizationCodeInternal()');
    return tokenFlow(inputData, tokenAuthorizationCodeKong, callback);
}

function tokenAuthorizationCodeKong(oauthInfo: TokenOAuthInfo, callback: TokenOAuthInfoCallback) {
    debug(oauthInfo.oauth2Config);
    if (!oauthInfo.oauth2Config ||
        !oauthInfo.oauth2Config.enable_authorization_code)
        return failOAuth(401, 'unauthorized_client', 'The API ' + oauthInfo.inputData.api_id + ' is not configured for the OAuth2 authorization code grant.', callback);

    return tokenWithKong(oauthInfo, 'authorization_code', callback);
}

function tokenWithKong(oauthInfo: TokenOAuthInfo, grantType: string, callback: TokenOAuthInfoCallback) {
    async.waterfall([
        callback => createTokenRequest(grantType, oauthInfo, callback),
        (tokenRequest, callback) => postTokenRequest(tokenRequest, callback)
    ], function (err, accessToken) {
        if (err)
            return callback(err);
        oauthInfo.accessToken = accessToken;
        return callback(null, oauthInfo);
    });
}

// -----------------------------------
// CLIENT CREDENTIALS
// -----------------------------------

function tokenClientCredentials(inputData: TokenRequest, callback: AccessTokenCallback) {
    debug('tokenClientCredentials()');
    debug(inputData);
    async.series({
        validate: function (callback: SimpleCallback) { validateClientCredentials(inputData, callback); },
        accessToken: function (callback: AccessTokenCallback) { tokenClientCredentialsInternal(inputData, callback); }
    }, function (err, result) {
        if (err)
            return callback(err);
        const returnValue = result.accessToken as AccessToken;
        // If session_data was provided, also return it
        if (inputData.session_data)
            returnValue.session_data = inputData.session_data;
        return callback(null, returnValue);
    });
}

function validateClientCredentials(inputData: TokenRequest, callback: SimpleCallback) {
    debug('validateClientCredentials()');
    if (!inputData.client_id)
        return failOAuth(400, 'invalid_request', 'client_id is missing', callback);
    if (!inputData.client_secret)
        return failOAuth(400, 'invalid_request', 'client_secret is missing', callback);
    if (inputData.scope) {
        if ((typeof (inputData.scope) !== 'string') &&
            !Array.isArray(inputData.scope))
            return failOAuth(400, 'invalid_scope', 'scope has to be either a string or a string array', callback);
    }
    callback(null);
}

function tokenClientCredentialsInternal(inputData: TokenRequest, callback: AccessTokenCallback) {
    return tokenFlow(inputData, tokenClientCredentialsKong, callback);
}

function tokenClientCredentialsKong(oauthInfo: TokenOAuthInfo, callback: TokenOAuthInfoCallback) {
    debug('tokenClientCredentialsKong()');
    debug(oauthInfo.oauth2Config);
    if (!oauthInfo.oauth2Config ||
        !oauthInfo.oauth2Config.enable_client_credentials)
        return failOAuth(401, 'unauthorized_client', 'The API ' + oauthInfo.inputData.api_id + ' is not configured for the OAuth2 client credentials grant.', callback);

    return tokenWithKong(oauthInfo, 'client_credentials', callback);
}

// -----------------------------------
// RESOURCE OWNER PASSWORD GRANT
// -----------------------------------

function tokenPasswordGrant(inputData: TokenRequest, callback: AccessTokenCallback) {
    debug('tokenPasswordGrant()');
    debug(inputData);
    async.series({
        validate: function (callback) { validatePasswordGrant(inputData, callback); },
        accessToken: function (callback) { tokenPasswordGrantInternal(inputData, callback); }
    }, function (err, result) {
        if (err)
            return callback(err);
        const returnValue = result.accessToken;
        // If session_data was provided, also return it
        if (inputData.session_data)
            returnValue.session_data = inputData.session_data;
        return callback(null, returnValue);
    });
}

function validatePasswordGrant(inputData: TokenRequest, callback: SimpleCallback) {
    debug('validatePasswordGrant()');
    if (!inputData.client_id)
        return failOAuth(400, 'invalid_request', 'client_id is missing', callback);
    // client_secret validation is done in validateTokenClientCredentials.
    if (inputData.scope) {
        if ((typeof (inputData.scope) !== 'string') &&
            !Array.isArray(inputData.scope))
            return failOAuth(400, 'invalid_scope', 'scope has to be either a string or a string array', callback);
    }
    if (!inputData.authenticated_userid)
        return failOAuth(400, 'invalid_request', 'authenticated_userid is missing', callback);
    return callback(null);
}

function tokenPasswordGrantInternal(inputData: TokenRequest, callback: AccessTokenCallback) {
    debug('tokenAuthorizationCodeInternal()');
    return tokenFlow(inputData, tokenPasswordGrantKong, callback);
}

function tokenPasswordGrantKong(oauthInfo: TokenOAuthInfo, callback: TokenOAuthInfoCallback) {
    debug(oauthInfo.oauth2Config);
    // HACK_PASSTHROUGH_REFRESH: Bypass this check? Refresh Token case with passthrough scopes and users.
    if (!oauthInfo.inputData.accept_password_grant) {
        if (!oauthInfo.oauth2Config ||
            !oauthInfo.oauth2Config.enable_password_grant)
            return failOAuth(401, 'unauthorized_client', 'The API ' + oauthInfo.inputData.api_id + ' is not configured for the OAuth2 resource owner password grant.', callback);
    }
    return tokenWithKong(oauthInfo, 'password', callback);
}

// -----------------------------------
// REFRESH TOKEN
// -----------------------------------

function tokenRefreshToken(inputData: TokenRequest, callback: AccessTokenCallback) {
    debug('tokenRefreshToken()');
    debug(inputData);
    async.series({
        validate: function (callback) { validateRefreshToken(inputData, callback); },
        accessToken: function (callback) { tokenRefreshTokenInternal(inputData, callback); }
    }, function (err, result) {
        if (err)
            return callback(err);
        const returnValue = result.accessToken;
        // If session_data was provided, also return it
        if (inputData.session_data)
            returnValue.session_data = inputData.session_data;
        return callback(null, returnValue);
    });
}

function validateRefreshToken(inputData: TokenRequest, callback: SimpleCallback) {
    debug('validateRefreshToken()');
    if (!inputData.client_id)
        return failOAuth(400, 'invalid_request', 'client_id is missing', callback);
    // client_secret validation for confidential clients is done in validateTokenClientCredentials
    if (!inputData.refresh_token)
        return failOAuth(400, 'invalid_request', 'refresh_token is missing', callback);
    if (inputData.scope) {
        if ((typeof (inputData.scope) !== 'string') &&
            !Array.isArray(inputData.scope))
            return failOAuth(400, 'invalid_scope', 'scope has to be either a string or a string array', callback);
    }
    return callback(null);
}

function tokenRefreshTokenInternal(inputData: TokenRequest, callback: AccessTokenCallback) {
    debug('tokenRefreshTokenInternal()');
    return tokenFlow(inputData, tokenRefreshTokenKong, callback);
}

function tokenRefreshTokenKong(oauthInfo: TokenOAuthInfo, callback: TokenOAuthInfoCallback) {
    debug('tokenRefreshTokenKong()');
    return tokenWithKong(oauthInfo, 'refresh_token', callback);
}

// -----------------------------------
// AUTHORIZATION ENDPOINT HELPER METHODS
// -----------------------------------

function authorizeFlow(inputData: AuthRequest, authorizeKongInvoker: AuthorizeKongInvoker, callback: StringCallback) {
    debug('authorizeFlow()');
    // We'll add info to this thing along the way; this is how it will look:
    // {
    //   inputData: {
    //     authenticated_userid: (user custom ID, e.g. from 3rd party DB),
    //     api_id: (API ID)
    //     client_id: (The app's client ID, from subscription)
    //     auth_server: (optional, which auth server is calling? Used to check that API is configured to use this auth server)
    //     scope: [ list of wanted scopes ] (optional, depending on API definition)
    //   }
    //   provisionKey: ...
    //   subsInfo: {
    //     application: (app ID)
    //     api: (api ID)
    //     auth: 'oauth2',
    //     plan: (plan ID)
    //     clientId: (client ID)
    //     clientSecret: (client secret)
    //     trusted: false
    //     ...
    //   },
    //   appInfo: {
    //     id: (app ID),
    //     name: (Application friendly name),
    //     redirectUri: (App's redirect URI)   
    //     confidential: false
    //   },
    //   consumer: {
    //     id: (Kong consumer ID),
    //     username: (app id)$(api_id)
    //     custom_id: (subscription id)
    //   },
    //   apiInfo: {
    //     strip_uri: true,
    //     preserve_host: false,
    //     name: "mobile",
    //     uris : [ "/mobile/v1" ],
    //     id: "7baec4f7-131d-44e9-a746-312352cedab1",
    //     upstream_url: "https://upstream.url/api/v1",
    //     created_at: 1477320419000
    //   }
    //   redirectUri: (redirect URI including access token)
    // }
    const oauthInfo = { inputData: inputData } as AuthorizeOAuthInfo;

    async.series([
        callback => lookupSubscription(oauthInfo, callback),
        callback => getOAuth2Config(oauthInfo, callback),
        //callback => lookupConsumer(oauthInfo, callback), // What was this for?
        callback => lookupApi(oauthInfo, callback),
        callback => authorizeKongInvoker(oauthInfo, callback)
    ], function (err, results) {
        debug('authorizeFlow async series returned.');
        if (err) {
            debug('but failed.');
            return callback(err);
        }

        // Oh, wow, that worked.
        callback(null, oauthInfo.redirectUri);
    });
}

function createAuthorizeRequest(responseType: string, oauthInfo: AuthorizeOAuthInfo, callback: AuthorizeRequestPayloadCallback) {
    debug('createAuthorizeRequest()');
    const { kongUrl, headers, agent } = buildKongUrl(oauthInfo.apiInfo.uris[0], '/oauth2/authorize');
    const authorizeUrl = kongUrl.toString();;
    info(`Kong Authorize URL: ${authorizeUrl}`);

    let scope = null;
    if (oauthInfo.inputData.scope) {
        let s = oauthInfo.inputData.scope;
        if (typeof (s) === 'string')
            scope = s;
        else if (Array.isArray(s))
            scope = s.join(' ');
        else // else: what?
            return failOAuth(400, 'invalid_scope', 'unknown type of scope input parameter: ' + typeof (s), callback);
    }
    debug(`requested scope: ${scope}`);
    debug(`requested redirect_uri: ${oauthInfo.inputData.redirect_uri}`);

    const oauthBody: any = {
        response_type: responseType,
        provision_key: oauthInfo.provisionKey,
        client_id: oauthInfo.subsInfo.clientId,
        redirect_uri: oauthInfo.inputData.redirect_uri,
        authenticated_userid: oauthInfo.inputData.authenticated_userid,
    };
    if (scope)
        oauthBody.scope = scope;
    debug(oauthBody);

    const requestParameters = {
        url: authorizeUrl,
        headers: headers,
        agent: agent,
        json: true,
        body: oauthBody
    };

    return callback(null, requestParameters);
}

function postAuthorizeRequest(authorizeRequest: AuthorizeRequestPayload, callback: StringCallback) {
    debug('postAuthorizeRequest()');
    // Jetzt kommt der spannende Moment, wo der Frosch ins Wasser rennt
    request.post(authorizeRequest, function (err, res, body) {
        if (err) {
            return failOAuth(500, 'server_error', 'calling kong authorize returned an error', err, callback);
        }
        const jsonBody = utils.getJson(body);
        if (res.statusCode > 299) {
            debug('postAuthorizeRequest: Kong did not create a redirect URI, response body:');
            debug(JSON.stringify(jsonBody));
            // Kong _should_ return an RFC6479 compliant response; let's see
            const error = jsonBody.error || 'server_error';
            const message = jsonBody.error_description || 'authorize for user with Kong failed: ' + utils.getText(body);
            const statusCode = res.statusCode || 500;
            return failOAuth(statusCode, error, message, callback);
        }
        debug('Kong authorize response:');
        debug(body);
        return callback(null, jsonBody.redirect_uri);
    });
}

// -----------------------------------
// TOKEN ENDPOINT HELPER METHODS
// -----------------------------------

function tokenFlow(inputData: TokenRequest, tokenKongInvoker: TokenKongInvoker, callback: AccessTokenCallback) {
    debug('tokenFlow()');
    const oauthInfo = { inputData: inputData } as TokenOAuthInfo;

    async.series([
        callback => lookupSubscription(oauthInfo, callback),
        callback => validateTokenRequest(oauthInfo, callback),
        callback => getOAuth2Config(oauthInfo, callback),
        //callback => lookupConsumer(oauthInfo, callback), // What was this for?
        callback => lookupApi(oauthInfo, callback),
        callback => tokenKongInvoker(oauthInfo, callback),
        callback => checkClientTypeAndReturnValue(oauthInfo, callback)
    ], function (err, _) {
        debug('tokenFlow async series returned.');
        if (err) {
            debug('but failed.');
            return callback(err);
        }

        // Oh, wow, that worked.
        callback(null, oauthInfo.accessToken);
    });
}

function checkClientTypeAndReturnValue(oauthInfo: TokenOAuthInfo, callback: TokenOAuthInfoCallback): void {
    debug('checkClientTypeAndReturnValue()');
    if (oauthInfo.appInfo.confidential)
        return callback(null, oauthInfo);
    // We have a public client; take out the refresh token, if present, for the authorization code grant, and for client type "public_spa".
    if (oauthInfo.inputData.grant_type == 'authorization_code' && oauthInfo.appInfo.clientType == WickedClientType.Public_SPA) {
        if (oauthInfo.accessToken && oauthInfo.accessToken.refresh_token) {
            debug(`Application ${oauthInfo.appInfo.id} is a public client; deleting refresh_token.`);
            delete oauthInfo.accessToken.refresh_token;
        }
    }
    return callback(null, oauthInfo);
}

// Note that this is not necessary for the /authorize end point, only for the token
// end point. Maybe it might be a good idea to make this behaviour configurable.
function validateTokenRequest(oauthInfo: TokenOAuthInfo, callback: TokenOAuthInfoCallback) {
    debug('validateTokenRequest()');
    debug(oauthInfo.inputData);
    const appId = oauthInfo.appInfo.id;
    const grantType = oauthInfo.inputData.grant_type;
    switch (grantType) {
        case 'password':
        case 'refresh_token':
            // Confidential clients MUST present their client_secret, non-confidential clients
            // MUST NOT present their client_secret.
            if (!oauthInfo.appInfo.confidential) {
                if (oauthInfo.inputData.client_secret)
                    return failOAuth(401, 'unauthorized_client', `client_secret is being passed; the application ${appId} is not declared as a confidential application; it must not contain and pass its client_secret using the ${grantType} grant.`, callback);
            } else {
                if (!oauthInfo.inputData.client_secret)
                    return failOAuth(401, 'unauthorized_client', `client_secret is missing; the application ${appId} is declared as a confidential application; it must pass its client_secret using the ${grantType} grant.`, callback);
            }

            break;
        // The client credentials flow *requires* a confidential (non-public client)
        case 'client_credentials':
            if (!oauthInfo.appInfo.confidential)
                return failOAuth(401, 'unauthorized_client', `the application ${appId} is not declared as a confidential application, thus cannot request access tokens via grant ${grantType}.`, callback);
            if (!oauthInfo.inputData.client_secret)
                return failOAuth(400, 'unauthorized_client', 'client_secret is missing.', callback);
            break;
        // For the authorization code to work with a public client, PKCE must be active
        case 'authorization_code':
            if (oauthInfo.appInfo.confidential) {
                if (!oauthInfo.inputData.client_secret)
                    return failOAuth(400, 'unauthorized_client', 'client_secret is missing.', callback);
            } else {
                debug(`validateTokenRequest: Validate PKCE`)
                debug(oauthInfo.inputData);
                // Verify PKCE
                if (oauthInfo.inputData.client_secret)
                    return failOAuth(400, 'unauthorized_client', `the application ${appId} is a public client and must not pass in its client_secret (must not be part of deployed application)`, callback);
                if (!oauthInfo.inputData.code_verifier)
                    return failOAuth(400, 'invalid_request', `the application ${appId} is not declared as a confidential application, and does not pass in a code_verifier, thus cannot request access tokens via grant ${grantType}.`, callback);
                const codeVerifier = oauthInfo.inputData.code_verifier;
                if (codeVerifier.length < 43 || codeVerifier.length > 128)
                    return failOAuth(400, 'invalid_request', 'code_verifier has to be at least 43 characters and at most 128 characters', callback);
                if (!oauthInfo.inputData.code_challenge || !oauthInfo.inputData.code_challenge_method)
                    return failOAuth(400, 'invalid_request', 'the authorization code flow was started without a code_challenge, but a code_verifier was passed in.', callback);
                if (!verifyPKCE(oauthInfo.inputData))
                    return failOAuth(400, 'invalid_grant', `PKCE verification failed (method ${oauthInfo.inputData.code_challenge_method})`, callback);
                // PKCE good, let's add the client_secret so that Kong doesn't complain
                oauthInfo.inputData.client_secret = oauthInfo.subsInfo.clientSecret;
            }
            break;
    }
    return callback(null, oauthInfo);
}

function base64UrlEncode(s) {    // https://tools.ietf.org/html/rfc7636#appendix-A
    let b = s.split('=')[0];
    b = b.replace(/\+/g, '-');
    b = b.replace(/\//g, '_');
    return b;
}

function verifyPKCE(tokenRequest: TokenRequest): boolean {
    debug(`verifyPKCE(code_challenge: ${tokenRequest.code_challenge}, code_challenge_method: ${tokenRequest.code_challenge_method}, code_verifier: ${tokenRequest.code_verifier})`);
    switch (tokenRequest.code_challenge_method) {
        case "plain":
            return tokenRequest.code_challenge === tokenRequest.code_verifier;
        case "S256":
            const sha256 = crypto.createHash('sha256');
            sha256.update(tokenRequest.code_verifier);
            const codeVerifierSHA256 = sha256.digest('base64');
            if (tokenRequest.code_challenge === codeVerifierSHA256)
                return true;
            // Check base64-urlencode variants
            if (tokenRequest.code_challenge === base64UrlEncode(codeVerifierSHA256))
                return true;
            if (base64UrlEncode(tokenRequest.code_challenge) === base64UrlEncode(codeVerifierSHA256))
                return true;
    }
    error(`verifyPKCE: Unknown code_challenge_method ${tokenRequest.code_challenge_method}`);
    return false;
}

function createTokenRequest(grantType: string, oauthInfo: TokenOAuthInfo, callback: TokenRequestPayloadCallback) {
    const { kongUrl, headers, agent } = buildKongUrl(oauthInfo.apiInfo.uris[0], '/oauth2/token');
    const tokenUrl = kongUrl.toString();
    info(`Kong Token URL: ${tokenUrl}`);

    let scope = null;
    if (oauthInfo.inputData.scope) {
        let s = oauthInfo.inputData.scope;
        if (typeof (s) === 'string')
            scope = s;
        else if (Array.isArray(s))
            scope = s.join(' ');
        else // else: what?
            return failOAuth(400, 'invalid_scope', 'unknown type of scope input parameter: ' + typeof (s), callback);
    }

    let tokenBody;
    switch (grantType) {
        case 'client_credentials':
            tokenBody = {
                grant_type: grantType,
                client_id: oauthInfo.inputData.client_id,
                client_secret: oauthInfo.inputData.client_secret,
                scope: scope
            };
            break;
        case 'authorization_code':
            tokenBody = {
                grant_type: grantType,
                client_id: oauthInfo.inputData.client_id,
                client_secret: oauthInfo.inputData.client_secret,
                code: oauthInfo.inputData.code,
                redirect_uri: oauthInfo.appInfo.redirectUri
            };
            break;
        case 'password':
            tokenBody = {
                grant_type: grantType,
                client_id: oauthInfo.inputData.client_id,
                client_secret: oauthInfo.subsInfo.clientSecret, // On purpose! These aren't always here.
                provision_key: oauthInfo.provisionKey,
                authenticated_userid: oauthInfo.inputData.authenticated_userid,
                scope: scope
            };
            break;
        case 'refresh_token':
            tokenBody = {
                grant_type: grantType,
                client_id: oauthInfo.inputData.client_id,
                client_secret: oauthInfo.subsInfo.clientSecret, // On purpose! These aren't always here.
                refresh_token: oauthInfo.inputData.refresh_token
            };
            break;
        default:
            return failOAuth(400, 'invalid_request', `invalid grant_type ${grantType}`, callback);
    }

    // Kong is very picky about this
    if (!scope && tokenBody.hasOwnProperty('scope'))
        delete tokenBody.scope;

    const tokenRequest = {
        url: tokenUrl,
        headers: headers,
        agent: agent,
        json: true,
        body: tokenBody
    } as TokenRequestPayload;

    debug(JSON.stringify(tokenRequest.body, null, 2));

    return callback(null, tokenRequest);
}

function postTokenRequest(tokenRequest: TokenRequestPayload, callback: AccessTokenCallback) {
    request.post(tokenRequest, function (err, res, body) {
        if (err)
            return failOAuth(500, 'server_error', 'calling kong token endpoint returned an error', err, callback);
        const jsonBody = utils.getJson(body);
        // jsonBody is now either of AccessToken type, or it contains an error
        // and an error_description
        if (res.statusCode > 299) {
            debug('postTokenRequest: Kong did not create a token, response body:');
            debug(JSON.stringify(jsonBody));
            // Kong _should_ return an RFC6479 compliant response; let's see
            const error = jsonBody.error || 'server_error';
            const message = jsonBody.error_description || 'Get auth code for user with Kong failed: ' + utils.getText(body);
            const statusCode = res.statusCode || 500;
            return failOAuth(statusCode, error, message, callback);
        }
        debug('Kong authorize response:');
        debug(JSON.stringify(jsonBody));
        return callback(null, jsonBody);
    });
}

// -----------------------------------
// GENERIC HELPER METHODS
// -----------------------------------

function lookupSubscription(oauthInfo: OAuthInfo, callback: OAuthInfoCallback) {
    debug('lookupSubscription()');
    wicked.getSubscriptionByClientId(oauthInfo.inputData.client_id, oauthInfo.inputData.api_id, function (err, subscription) {
        if (err)
            return failOAuth(401, 'unauthorized_client', 'invalid client_id', err, callback);

        const subsInfo = subscription.subscription;
        debug('subsInfo:');
        debug(subsInfo);
        const appInfo = subscription.application;
        debug('appInfo:');
        debug(appInfo);
        // Validate that the subscription is for the correct API
        if (oauthInfo.inputData.api_id !== subsInfo.api) {
            debug('inputData:');
            debug(oauthInfo.inputData);
            debug('subInfo:');
            debug(subsInfo);
            return failOAuth(401, 'unauthorized_client', 'subscription does not match client_id, or invalid api_id', callback);
        }
        oauthInfo.subsInfo = subsInfo;
        oauthInfo.appInfo = appInfo;
        return callback(null, oauthInfo);
    });
}

const _oauth2Configs = {};
function getOAuth2Config(oauthInfo: OAuthInfo, callback: OAuthInfoCallback) {
    debug('getOAuth2Config() for ' + oauthInfo.inputData.api_id);
    const apiId = oauthInfo.inputData.api_id;
    if (_oauth2Configs[apiId]) {
        oauthInfo.oauth2Config = _oauth2Configs[apiId];
        oauthInfo.provisionKey = oauthInfo.oauth2Config.provision_key;
        return callback(null, oauthInfo);
    }

    // We haven't seen this API yet, get it from le Kong.
    kongUtils.kongGetApiOAuth2Plugins(apiId, function (err, body) {
        if (err)
            return failOAuth(500, 'server_error', 'could not retrieve oauth2 plugins from Kong', err, callback);
        if (body.data.length <= 0)
            return failOAuth(500, 'server_error', `api ${apiId} is not configured for use with oauth2`, callback);
        const oauth2Plugin = body.data[0] as any;
        if (!oauth2Plugin.config.provision_key)
            return failOAuth(500, 'server_error', `api ${apiId} does not have a valid provision_key`, callback);
        // Looks good, remember dat thing
        oauthInfo.oauth2Config = oauth2Plugin.config;
        oauthInfo.provisionKey = oauth2Plugin.config.provision_key;
        _oauth2Configs[apiId] = oauth2Plugin.config;
        callback(null, oauthInfo);
    });
}

// This is a really interesting little function, but I just don't get anymore what it
// was needed for. I think it actually *isn't* needed. But let's keep it in here for
// a little while and see whether the need pops up again...
// 
// function lookupConsumer(oauthInfo, callback) {
//     const customId = oauthInfo.subsInfo.id;
//     debug('lookupConsumer() for subscription ' + customId);
//
//     kongUtils.kongGet('consumers?custom_id=' + qs.escape(customId), function (err, consumer) {
//         if (err) {
//             return failOAuth(500, 'server_error', `could not retrieve consumer for custom id ${customId}`, err, callback);
//         }
//
//         debug('Found these consumers for subscription ' + customId);
//         debug(consumer);
//
//         if (!consumer.total ||
//             consumer.total <= 0 ||
//             !consumer.data ||
//             consumer.data.length <= 0) {
//             return failOAuth(500, 'server_error', `list of consumers for custom id ${customId} either not returned or empty`, callback);
//         }
//
//         oauthInfo.consumer = consumer.data[0];
//         callback(null, oauthInfo);
//     });
// }

const _kongApis: { [apiId: string]: KongApi } = {};
function getKongApi(apiId: string, callback: Callback<KongApi>) {
    debug(`getKongApi(${apiId})`);
    if (_kongApis[apiId])
        return callback(null, _kongApis[apiId]);
    kongUtils.kongGetApi(apiId, function (err, apiData) {
        if (err)
            return callback(err);
        _kongApis[apiId] = apiData;
        return callback(null, apiData);
    });
}

const _wickedApis: { [apiId: string]: WickedApi } = {};
function getWickedApi(apiId, callback: Callback<WickedApi>): void {
    debug(`getWickedApi(${apiId})`);
    if (_wickedApis[apiId])
        return callback(null, _wickedApis[apiId]);
    wicked.getApi(apiId, function (err, apiData) {
        if (err)
            return callback(err);
        _wickedApis[apiId] = apiData;
        return callback(null, apiData);
    });
}

function lookupApi(oauthInfo: OAuthInfo, callback: OAuthInfoCallback): void {
    const apiId = oauthInfo.subsInfo.api;
    debug('lookupApi() for API ' + apiId);
    async.parallel({
        kongApi: callback => getKongApi(apiId, callback),
        wickedApi: callback => getWickedApi(apiId, callback)
    }, function (err, results) {
        if (err) {
            return failOAuth(500, 'server_error', 'could not retrieve API information from API or kong', err, callback);
        }
        const apiInfo = results.kongApi as KongApi;
        const wickedApiInfo = results.wickedApi as WickedApi;

        if (!apiInfo.uris) {
            return failOAuth(500, 'server_error', `api ${apiId} does not have a valid uris setting`, callback);
        }

        // We will have a specified auth_method, as it's mandatory, now check which auth methods are
        // allowed for the API. This is mandatory for the API.
        if (!wickedApiInfo.authMethods)
            return failOAuth(500, 'server_error', `api ${apiId} does not have any authMethods configured`, callback);
        const authMethod = oauthInfo.inputData.auth_method;
        debug(`lookupApi: Matching auth method ${authMethod} against API ${apiId}`);
        const foundMethod = wickedApiInfo.authMethods.find(m => m === authMethod);
        if (!foundMethod)
            return failOAuth(500, 'unauthorized_client', `auth method ${authMethod} is not allowed for api ${apiId}`, callback);
        debug(`lookupApi: Auth method ${authMethod} is fine`);

        oauthInfo.apiInfo = apiInfo;
        return callback(null, oauthInfo);
    });
}

function buildKongUrl(requestPath: string, additionalPath: string): { kongUrl: URL, headers: RequestHeaders, agent: any } {
    const globs = wicked.getGlobals();
    let hostUrl = wicked.getExternalApiUrl();
    if (globs.network && globs.network.kongProxyUrl) {
        // Prefer to use the internal proxy URL
        hostUrl = wicked.getInternalKongProxyUrl();
    }

    let reqPath = requestPath;
    let addPath = additionalPath;
    if (!hostUrl.endsWith('/'))
        hostUrl = hostUrl + '/';
    if (reqPath.startsWith('/'))
        reqPath = reqPath.substring(1); // cut leading /
    if (!reqPath.endsWith('/'))
        reqPath = reqPath + '/';
    if (addPath.startsWith('/'))
        addPath = addPath.substring(1); // cut leading /

    const kongUrl = new URL(hostUrl + reqPath + addPath);

    let headers: RequestHeaders = null;
    let agent = null;

    // Depending on the type of protocol, we need additional settings:
    if ('http:' === kongUrl.protocol) {
        // We are accessing Kong via the internal, unencrypted port; this is the default,
        // but Kong needs to know that it's safe to do this. In production environments,
        // the proxy port must be behind a TLS terminating load balancer, which by default
        // already introduces this header.
        headers = { 'X-Forwarded-Proto': 'https' };
    } else if ('https:' === kongUrl.protocol) {
        // Make sure we accept self signed certs.
        agent = sslAgent;
    }
    
    return {
        kongUrl,
        headers,
        agent
    };
}

// module.exports = oauth2;
