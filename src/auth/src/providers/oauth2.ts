'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { AuthRequest, EndpointDefinition, AuthResponse, IdentityProvider, IdpOptions, OAuth2IdpConfig, ExpressHandler, CheckRefreshDecision, ErrorLink, LogoutHookResponse, RedirectURIValidationResponse, RedirectURIValidationRequest } from '../common/types';
import { OidcProfile, Callback, WickedApi } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:oauth2');

const Router = require('express').Router;
const request = require('request');
const passport = require('passport');
const { Issuer } = require('openid-client');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var jwt = require('jsonwebtoken');

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';
import async = require('async');

/**
 * This is a sample of how an IdP must work to be able to integrate into
 * the generic OAuth2 workflow in generic.js
 */
export class OAuth2IdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private options: IdpOptions;
    private authMethodConfig: OAuth2IdpConfig;

    // private authenticateWithOAuth2: ExpressHandler;
    private authenticateCallback: ExpressHandler;
    private baseAuthenticateSettings: any;

    constructor(basePath: string, authMethodId: string, authMethodConfig: any, options: IdpOptions) {
        debug(`constructor(${basePath}, ${authMethodId},...)`);
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);

        this.basePath = basePath;
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;

        // Verify configuration
        if (!authMethodConfig.clientId)
            throw new Error(`OAuth2 auth method "${authMethodId}": In auth method configuration, property "config", the property "clientId" is missing.`);
        if (!authMethodConfig.clientSecret)
            throw new Error(`OAuth2 auth method "${authMethodId}": In auth-server configuration, property "config", the property "clientSecret" is missing.`);

        if (!authMethodConfig.endpoints)
            throw new Error(`OAuth2 auth method ${authMethodId}: In auth method configuration, property, config, the property "endpoints" is missing.`);
        if (!authMethodConfig.endpoints.authorizeEndpoint)
            throw new Error(`OAuth2 auth method ${authMethodId}: In auth method configuration, property, config, the property "endpoints.authorizeEndpoint" is missing.`);
        if (!authMethodConfig.endpoints.tokenEndpoint)
            throw new Error(`OAuth2 auth method ${authMethodId}: In auth method configuration, property, config, the property "endpoints.tokenEndpoint" is missing.`);

        // Assemble the callback URL
        const callbackUrl = `${options.externalUrlBase}/${authMethodId}/callback`;
        info(`OAuth2 Authentication: Expected callback URL: ${callbackUrl}`);

        const oauthStrategy = new OAuth2Strategy({
            authorizationURL: authMethodConfig.endpoints.authorizeEndpoint,
            tokenURL: authMethodConfig.endpoints.tokenEndpoint,
            clientID: authMethodConfig.clientId,
            clientSecret: authMethodConfig.clientSecret,
            callbackURL: callbackUrl,
            passReqToCallback: true,
        }, this.verifyProfile);

        // The authorization parameters can differ for each authorization
        // request; it cannot be static (e.g. due to "prompt" or "prefill_username"
        // parameters).
        oauthStrategy.authorizationParams = this.authorizationParams;

        oauthStrategy.userProfile = function (accessToken, done) {
            debug(`userProfile(${this.authMethodId})`);
            if (authMethodConfig.retrieveProfile) {
                debug(`userProfile(${this.authMethodId}): Retrieve userProfile from profileEndpoint`);
                let issuer = new Issuer({
                    issuer: "IdP Issuer",
                    authorization_endpoint: authMethodConfig.endpoints.authorizeEndpoint,
                    token_endpoint: authMethodConfig.endpoints.tokenEndpoint,
                    userinfo_endpoint: authMethodConfig.endpoints.profileEndpoint
                });
                let client = new issuer.Client({
                    client_id: authMethodConfig.clientId,
                    client_secret: authMethodConfig.clientSecret,
                    redirect_uris: [callbackUrl],
                    response_types: ['code']
                });
                client.userinfo(accessToken)
                    .then(function (userInfo) {
                        debug(`retrieveUserProfileCallback: Successfully retrieved profile from endpoint`);
                        done(null, userInfo);
                    })

            } else {
                done(null, accessToken);
            }
        };

        passport.use(authMethodId, oauthStrategy);

        let scope: string[] = null;
        if (authMethodConfig.endpoints.authorizeScope) {
            scope = authMethodConfig.endpoints.authorizeScope.split(' ');
        }
        this.baseAuthenticateSettings = {
            session: false,
            scope: scope,
        };

        this.genericFlow.initIdP(this);
    }

    /**
     * When a user logs out using the /logout endpoint, and the user has an oAuth2
     * session running, send the redirect_uri to a hook service to validate it 
     * against an accepted redirect URLs list, thus prevent open redirect attacks.
     * 
     * @param redirect_uri 
     */
    public async logoutHook(req, res, next, redirect_uri: string): Promise<LogoutHookResponse> {
        debug('logoutHook()');
        if (!req.session || !req.session[this.authMethodId])
            // Nothing to do, not logged in.
            return {
                hasHandledRequest: false,
                isRedirectUriAccepted: true
            };
        debug('Validating redirect_uri');
        const instance = this;
        try {
            // Check that the redirect_uri valiodation service is configured
            if (!instance.authMethodConfig.endpoints.redirectURIValidationEndpoint) {
                next(makeError('The redirectURIValidationEndpoint configuration is not set', 500));
                return {
                    hasHandledRequest: false,
                    isRedirectUriAccepted: true
                };
            }

            const redirUriValidationResponse: RedirectURIValidationResponse =
                await this.validateRedirectURIAsync(redirect_uri, 
                        utils.getProfile(req, this.authMethodId),
                        instance.authMethodConfig.endpoints.redirectURIValidationEndpoint)

            if(redirUriValidationResponse) {
                return {
                    hasHandledRequest: false,
                    isRedirectUriAccepted: redirUriValidationResponse.isRedirectUriAccepted
                }
            }
            
            return {
                hasHandledRequest: false,
                isRedirectUriAccepted: true
            }
        } catch (ex) {
            error(ex);
            // Silently just kill all sessions, or at least this one.
            return {
                hasHandledRequest: false,
                isRedirectUriAccepted: true
            };
        }
    }

    private validateRedirectURIAsync = async (scope: any, profile: OidcProfile, url: string): Promise<RedirectURIValidationResponse> => {
        const instance = this;
        return new Promise<RedirectURIValidationResponse>(function (resolve, reject) {
            instance.validateRedirectURI(scope, profile, url, function (err, result) {
                err ? reject(err) : resolve(result);
            });
        })
    }

    private validateRedirectURI(redirectUri: string, profile: OidcProfile ,url: string, callback: Callback<RedirectURIValidationResponse>): void {
        debug(`validateRedirectURI()`);
        const validateURIRequest: RedirectURIValidationRequest = {
            redirectUri,
            profile
        };
        debug(JSON.stringify(validateURIRequest));
        async.retry({
            times: this.getRouter().EXTERNAL_URL_RETRIES | 10,
            interval: this.getRouter().EXTERNAL_URL_INTERVAL | 500
        }, function (callback) {
            debug(`validateRedirectURI: Attempting to validate redirect URL ${redirectUri} at ${url}`);
            request.post({
                url: url,
                body: validateURIRequest,
                json: true,
                timeout: 5000
            }, (err, res, body) => {
                if (err)
                    return callback(err);
                if (res.statusCode < 200 || res.statusCode > 299)
                    return callback(makeError('Redirect URI validation via external service failed with unexpected status code.', res.statusCode));
                const redirectUriValidationResponse = utils.getJson(body) as RedirectURIValidationResponse;
                return callback(null, redirectUriValidationResponse)
            });
        }, function (err, redirectUriValidationResponse) {
            if (err)
                return callback(err);
            return callback(null, redirectUriValidationResponse);
        });
    }

    public getType() {
        return "oauth2";
    }

    public supportsPrompt(): boolean {
        const promptSupported = this.authMethodConfig.doesNotSupportPrompt ? false : true;
        debug(`supportsPrompt(): ${promptSupported}`);
        return promptSupported;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    }

    private verifyProfile = (req, accessToken, refreshTokenNotUsed, tokenResponse, profile, done) => {
        debug(`verifyProfile(${this.authMethodId})`);
        debug(`- tokenResponse: ${JSON.stringify(tokenResponse)}`);

        let hopefullyJwtToken = accessToken;

        if (!this.authMethodConfig.retrieveProfile) {
            // Special case for OpenID Connect; if the scope contains "openid", and there is a "id_token" property in the tokenResponse,
            // use the id_token as the JWT token.
            if (tokenResponse && tokenResponse.scope && tokenResponse.id_token) {
                if (tokenResponse.scope.indexOf('openid') >= 0) {
                    debug(`- detected OpenID id_token; using that`)
                    hopefullyJwtToken = tokenResponse.id_token;
                }
            }
            // Verify signing?
            try {
                profile = this.verifyJWT(hopefullyJwtToken);
                debug(`verifyProfile(${this.authMethodId}): Decoded JWT Profile:`);
            } catch (ex) {
                error(`verifyProfile(${this.authMethodId}): JWT decode/verification failed.`);
                return done(null, false, { message: ex });
            }
        }
        debug(`verifyProfile(${this.authMethodId}): Retrieved Profile:`);
        debug(profile);

        try {
            const authResponse = this.createAuthResponse(profile, tokenResponse);
            debug(`authResponse: ${JSON.stringify(authResponse)}`);
            return done(null, authResponse);
        } catch (err) {
            return done(null, false, { message: err });
        }
    }

    private verifyJWT = (accessToken) => {
        if (this.authMethodConfig.certificate) {
            // Decode Oauth token and verify that it has been signed by the given public cert
            debug(`verifyJWT(${this.authMethodId}): Verifying JWT signature and decoding profile`);
            return jwt.verify(accessToken, this.authMethodConfig.certificate);
        } else {
            // Do not check signing, just decode
            warn(`verifyJWT(${this.authMethodId}): Decoding JWT signature, NOT verifying signature, "certificate" not specified`)
            return jwt.decode(accessToken);
        }
    }

    private authorizationParams = (options) => {
        debug(`authorizationParams(): ${JSON.stringify(options)}`);
        let params: any = {};
        if (this.authMethodConfig.resource || this.authMethodConfig.params) {
            if (this.authMethodConfig.params)
                params = Object.assign({}, this.authMethodConfig.params);
            if (this.authMethodConfig.resource)
                params.resource = this.authMethodConfig.resource;
        }
        if (options.prefill_username) {
            params.prefill_username = options.prefill_username;
        }
        if (options.prompt) {
            params.prompt = options.prompt;
        }
        if (options.state) {
            params.state = options.state;
        }
        return params;
    }

    /**
     * In case the user isn't already authenticated, this method will
     * be called from the generic flow implementation. It is assumed to
     * initiate an authentication of the user by whatever means is
     * suitable, depending on the actual Identity Provider implementation.
     * 
     * If you need additional end points responding to any of your workflows,
     * register them with the `endpoints()` method below.
     * 
     * `authRequest` contains information on the authorization request,
     * in case those are needed (such as for displaying information on the API
     * or similar).
     */
    public authorizeWithUi(req, res, next, authRequest: AuthRequest) {
        debug('authorizeWithUi()');
        debug(`authRequest: ${JSON.stringify(authRequest)}`)
        // Do your thing...
        const additionalSettings: any = {};
        // Propagate additional parameters; the settings object is combined with these
        // additionalSettings, and this is passed in to the authorizationParams method
        // above, so that we can take them out again. A little complicated, but it works.
        if (authRequest.prompt) {
            additionalSettings.prompt = authRequest.prompt;
        }
        if (authRequest.prefill_username) {
            additionalSettings.prefill_username = authRequest.prefill_username;
        }
        if (this.authMethodConfig.forwardState && authRequest.state) {
            additionalSettings.state = authRequest.state;
        }
        const settings = Object.assign({}, this.baseAuthenticateSettings, additionalSettings);
        passport.authenticate(this.authMethodId, settings)(req, res, next);
    };

    public getErrorLinks(): ErrorLink {
        if (this.authMethodConfig.errorLink && this.authMethodConfig.errorLinkDescription) {
            return {
                url: this.authMethodConfig.errorLink,
                description: this.authMethodConfig.errorLinkDescription
            };
        }
        return null;
    }

    /**
     * In case you need additional end points to be registered, pass them
     * back to the generic flow implementation here; they will be registered
     * as "/<authMethodName>/<uri>", and then request will be passed into
     * the handler function, which is assumed to be of the signature
     * `function (req, res, next)` (the standard Express signature)
     */
    public endpoints(): EndpointDefinition[] {
        // This is just a sample endpoint; usually this will be like "callback",
        // e.g. for OAuth2 callbacks or similar.
        return [
            {
                method: 'get',
                uri: '/callback',
                handler: this.callbackHandler
            }
        ];
    };

    /**
     * Verify username and password and return the data on the user, like
     * when authorizing via some 3rd party. If this identity provider cannot
     * authenticate via username and password, an error will be returned.
     * 
     * @param {*} user Username
     * @param {*} pass Password
     * @param {*} callback Callback method, `function(err, authenticationData)`
     */
    public authorizeByUserPass(user: string, pass: string, callback: Callback<AuthResponse>) {
        const postBody = {
            grant_type: "password",
            username: user,
            password: pass,
            client_id: this.authMethodConfig.clientId,
            client_secret: this.authMethodConfig.clientSecret,
            scope: this.authMethodConfig.endpoints.authorizeScope
        };
        const config = utils.getJson(this.authMethodConfig);
        if (config.params) {
            Object.keys(config.params).map((key) => {
                postBody[key] = config.params[key];
            });
        }
        const uri = this.authMethodConfig.endpoints.tokenEndpoint;
        const instance = this;
        const postBodyParams = Object.keys(postBody).map((key) => {
            return `${encodeURIComponent(key)}=${encodeURIComponent(postBody[key])}`;
        }).join('&');

        request.post({
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            uri,
            body: postBodyParams
        }, function (err, res, responseBody) {
            try {
                const jsonResponse = utils.getJson(responseBody);
                if (res.statusCode !== 200 || jsonResponse.error) {
                    const err = makeError(`External IDP ${instance.authMethodId} returned an error or an unexpected status code (${res.statusCode})`, res.statusCode);
                    if (jsonResponse.error)
                        err.internalError = new Error(`Error: ${jsonResponse.error}, description. ${jsonResponse.error_description || '<no description>'}`);
                    return callback(err);
                }
                return instance.verifyProfile(null, jsonResponse.access_token, null, jsonResponse, null, callback);
            } catch (err) {
                error(err);
                return callback(err);
            }
        });
    };

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky.
        return callback(null, {
            allowRefresh: true
        });
    };

    /**
     * Callback handler; this is the endpoint which is called when the OAuth2 provider
     * returns with a success or failure response.
     */
    private callbackHandler = (req, res, next) => {
        // Here we want to assemble the default profile and stuff.
        debug('callbackHandler()');
        const instance = this;
        // Do we have errors from the upstream IdP here?
        if (req.query && req.query.error) {
            warn(`${instance.authMethodId}.callbackHandler detected ${req.query.error} error`);
            // Super special case: We get an unsolicited callback *with an error*. In this case,
            // we can only display an HTML error message. Otherwise (if we know which client initiated
            // the authorization request) we will redirect back to the calling client with
            // the error and error_description we received here.
            let authRequest;
            try {
                authRequest = utils.getAuthRequest(req, instance.authMethodId);
            } catch (err) {
                warn(`${instance.authMethodId}.callbackHandler: Invalid state: No authRequest in session`);
                warn(err.stack);
            }

            if (authRequest) {
                // This is the normal case - we get an upstream IdP error which we will forward to
                // the downstream client.
                (async () => {
                    await instance.genericFlow.failAuthorizeFlow(req, res, next, req.query.error, req.query.error_description);
                })();
                return;
            } else {
                // We have no idea where this callback actually came from, so we'll resort to displaying
                // an error message instead (as HTML).
                return failMessage(400, `Unexpected callback; identity provider returned error: ${req.query.error} (${req.query.error_description})`, next);
            }
        }

        // We don't have any explicit and direct errors, so we will probably have
        // an authorization code. Delegate this to passport again, and then continue
        // from there when passport calls the "next" function, which is passed inline
        // here.
        passport.authenticate(this.authMethodId, this.baseAuthenticateSettings)(req, res, function (err) {
            if (err)
                return next(err);
            // The authResponse is now in req.user (for this call), and we can pass that on as an authResponse
            // to continueAuthorizeFlow. Note the usage of "session: false", so that this data is NOT stored
            // automatically in the user session, which passport usually does by default.
            debug('Successfully authenticated via passport.');
            const authResponse = req.user;
            instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
        });
    };

    // HELPER METHODS
    private createAuthResponse(profile: any, tokenResponse: any): AuthResponse {
        debug(`createAuthResponse(${this.authMethodId})`);

        const defaultProfile = this.createDefaultProfile(profile);
        const defaultGroups = this.createDefaultGroups(profile);
        const customId = defaultProfile.sub;

        return {
            userId: null,
            customId: customId,
            defaultGroups: defaultGroups,
            defaultProfile: defaultProfile,
            data: tokenResponse
        };
    }

    private createDefaultProfile(profile): OidcProfile {
        debug(`createDefaultProfile(${this.authMethodId}`);

        let customIdField = this.authMethodConfig.customIdField ? this.authMethodConfig.customIdField : 'upn';
        let nameField = this.authMethodConfig.nameField ? this.authMethodConfig.nameField : 'name';
        let firstNameField = this.authMethodConfig.firstNameField ? this.authMethodConfig.firstNameField : 'given_name';
        let lastNameField = this.authMethodConfig.lastNameField ? this.authMethodConfig.lastNameField : 'family_name';
        let emailField = this.authMethodConfig.emailField ? this.authMethodConfig.emailField : 'email';

        if (!profile[emailField])
            throw makeError('Profile must contain a valid email address.', 400);
        if (!profile[customIdField])
            throw makeError('Profile must contain a unique identifier field (custom ID field, UPN or similar)', 400);

        const customId = `${this.authMethodId}:${profile[customIdField]}`;
        const defaultProfile: OidcProfile = {
            sub: customId,
            email: profile[emailField],
            email_verified: !!this.authMethodConfig.trustUsers
        };
        const name = profile[nameField];
        const firstName = profile[firstNameField];
        const lastName = profile[lastNameField];

        if (name)
            defaultProfile.name = name;
        else
            defaultProfile.name = utils.makeFullName(lastName, firstName);
        if (firstName)
            defaultProfile.given_name = firstName;
        if (lastName)
            defaultProfile.family_name = lastName;

        // Iterate over the rest of the claims as well and return them
        for (let key in profile) {
            // Claim already present?
            if (defaultProfile.hasOwnProperty(key))
                continue;
            const value = profile[key];
            switch (typeof (value)) {
                case "string":
                case "number":
                    defaultProfile[key] = value;
                    break;
                default:
                    debug(`createAuthResponse(${this.authMethodId}: Skipping non-string/non-number profile key ${key}`);
                    break;
            }
        }

        return defaultProfile;
    }

    private createDefaultGroups(profile: any): string[] {
        debug(`createDefaultGroups(${this.authMethodId})`);
        if (!this.authMethodConfig.defaultGroups)
            return [];
        const groupField = this.authMethodConfig.groupField ? this.authMethodConfig.groupField : 'group';
        if (!profile[groupField])
            return [];
        const groups = profile[groupField];
        if (!Array.isArray(groups)) {
            warn(`createDefaultGroups(${this.authMethodId}): When creating profile, field ${groupField} is not a string array, defaulting to no groups.`);
            return [];
        }
        const defaultGroups = [];
        const groupMap = this.authMethodConfig.defaultGroups;
        for (let i = 0; i < groups.length; ++i) {
            const g = groups[i];
            if (groupMap[g]) {
                const wickedGroup = groupMap[g];
                debug(`Detected matching group ${g}: ${wickedGroup}`);
                defaultGroups.push(wickedGroup);
            }
        }
        debug(`createDefaultGroups(${this.authMethodId}): ${defaultGroups}`);
        return defaultGroups;
    }
}
