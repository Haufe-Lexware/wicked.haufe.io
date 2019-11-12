'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { IdpOptions, IdentityProvider, GoogleIdpConfig, ExpressHandler, AuthResponse, EndpointDefinition, AuthRequest, CheckRefreshDecision } from '../common/types';
import { OidcProfile, Callback, WickedApi, getAuthServer } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:google');
const Router = require('express').Router;

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

const passport = require('passport');

const GoogleStrategy = require('passport-google-oauth20').Strategy;

/**
 * Google IdP implementation.
 */
export class GoogleIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: GoogleIdpConfig;
    private options: IdpOptions;

    private baseAuthenticateSettings: any;
    // private authenticateWithGoogle: ExpressHandler;
    // private authenticateCallback: ExpressHandler;

    constructor(basePath: string, authMethodId: string, authMethodConfig: GoogleIdpConfig, options: IdpOptions) {
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.basePath = basePath;
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;
        // Verify configuration
        if (!authMethodConfig.clientId)
            throw new Error(`Google auth method "${authMethodId}": In auth method configuration, property "config", the property "clientId" is missing.`);
        if (!authMethodConfig.clientSecret)
            throw new Error(`Google auth method "${authMethodId}": In auth-server configuration, property "config", the property "clientSecret" is missing.`);

        // Assemble the callback URL
        const callbackUrl = `${options.externalUrlBase}/${authMethodId}/callback`;
        info(`Google Authentication: Expected callback URL: ${callbackUrl}`);

        this.baseAuthenticateSettings = {
            session: false,
            scope: ['profile', 'email']
        };
        const googleStrategy = new GoogleStrategy({
            clientID: authMethodConfig.clientId,
            clientSecret: authMethodConfig.clientSecret,
            callbackURL: callbackUrl
        }, this.verifyProfile);
        googleStrategy.authorizationParams = this.authorizationParams;
        // Configure passport
        passport.use(authMethodId, googleStrategy);

        // this.authenticateWithGoogle = passport.authenticate(authMethodId, authenticateSettings);
        // this.authenticateCallback = passport.authenticate(authMethodId, authenticateSettings);

        this.genericFlow.initIdP(this);
    }

    public getType() {
        return "google";
    }

    public supportsPrompt(): boolean {
        return true;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    }

    private authorizationParams = (options) => {
        debug('authorizationParams()');
        const params: any = {};
        if (options.prompt)
            params.prompt = options.prompt;
        return params;        
    }

    public authorizeWithUi(req, res, next, authRequest: AuthRequest) {
        // Do your thing...
        // Redirect to the Google login page
        // return this.authenticateWithGoogle(req, res);
        let additionalSettings: any = {};
        if (authRequest.prompt) {
            additionalSettings.prompt = authRequest.prompt;
        }
        const settings = Object.assign({}, this.baseAuthenticateSettings, additionalSettings);
        passport.authenticate(this.authMethodId, settings)(req, res, next);
    };

    public endpoints(): EndpointDefinition[] {
        return [
            {
                method: 'get',
                uri: '/callback',
                // middleware: this.authenticateCallback,
                handler: this.callbackHandler
            }
        ];
    };

    public authorizeByUserPass(user: string, pass: string, callback: Callback<AuthResponse>) {
        // Verify username and password, if possible.
        // For Google, this is not possible, so we will just return an
        // error message.
        return failOAuth(400, 'unsupported_grant_type', 'Google does not support authorizing headless with username and password', callback);
    }

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky. For Github, we will just allow it.
        return callback(null, {
            allowRefresh: true
        });
    };

    // Instance function, on purpose; this is used as a passport callback
    private verifyProfile = (accessToken, refreshToken, profile, done: Callback<AuthResponse>) => {
        debug('Google Authentication succeeded.');
        // We'll always accept Google Identities, no matter what.
        this.createAuthResponse(profile, function (err, authResponse) {
            if (err) {
                error('Google Authentication: normalizeProfile failed.');
                error(err);
                return done(err);
            }
            debug('Google normalized user profile:');
            debug(authResponse);
            done(null, authResponse);
        });
    };

    private createAuthResponse(profile, callback: Callback<AuthResponse>): void {
        debug(`createAuthResponse()`);
        const email = this.getEmail(profile);
        const email_verified = !!email;

        const customId = `${this.authMethodId}:${profile.id}`;
        const defaultProfile = {
            sub: customId,
            username: utils.makeUsername(profile.displayName, profile.username),
            preferred_username: utils.makeUsername(profile.displayName, profile.username),
            name: profile.displayName,
            given_name: profile.name.givenName,
            family_name: profile.name.familyName,
            email: email,
            email_verified: email_verified
        } as OidcProfile;
        const authResponse = {
            userId: null, // will be filled by genericFlow
            customId: customId,
            defaultGroups: [],
            defaultProfile: defaultProfile
        } as AuthResponse;
        callback(null, authResponse);
    }

    private getEmail(profile) {
        debug('getEmail()');
        if (!profile.emails)
            return null;
        if (profile.emails.length <= 0)
            return null;
        return profile.emails[0].value;
    }

    /**
     * Github callback handler; this is the endpoint which is called when Github
     * returns with a success or failure response.
     * 
     * Implemented as instance function as it's used as a callback from Passport.
     */
    private callbackHandler = (req, res, next) => {
        // Here we want to assemble the default profile and stuff.
        debug('callbackHandler()');
        const instance = this;
        // Do we have errors from the upstream IdP here?
        if (req.query && req.query.error) {
            warn(`callbackHandler detected ${req.query.error} error`);
            (async() => {
                await instance.genericFlow.failAuthorizeFlow(req, res, next, req.query.error, req.query.error_description);
            })();
            return;
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
            debug(JSON.stringify(authResponse));
            instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
        });
    }
}
