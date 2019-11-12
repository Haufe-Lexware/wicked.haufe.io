'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { IdentityProvider, IdpOptions, GithubIdpConfig, ExpressHandler, AuthResponse, EndpointDefinition, AuthRequest, CheckRefreshDecision } from '../common/types';
import { OidcProfile, Callback, WickedApi } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:github');
const Router = require('express').Router;

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

const request = require('request');
const passport = require('passport');
const GithubStrategy = require('passport-github2');

interface EMailData {
    email: string,
    verified: boolean
};

/**
 * Github IdP implementation.
 */
export class GithubIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: GithubIdpConfig;
    private options: IdpOptions;

    private authenticateWithGithub: ExpressHandler;
    private authenticateCallback: ExpressHandler;

    constructor(basePath: string, authMethodId: string, authMethodConfig: GithubIdpConfig, options: IdpOptions) {
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.basePath = basePath;
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;

        // Verify configuration
        if (!authMethodConfig.clientId)
            throw new Error(`Github auth method "${authMethodId}": In auth method configuration, property "config", the property "clientId" is missing.`);
        if (!authMethodConfig.clientSecret)
            throw new Error(`Github auth method "${authMethodId}": In auth-server configuration, property "config", the property "clientSecret" is missing.`);

        // Assemble the callback URL
        const callbackUrl = `${options.externalUrlBase}/${authMethodId}/callback`;
        info(`Github Authentication: Expected callback URL: ${callbackUrl}`);

        // ========================
        // PASSPORT INITIALIZATION
        // ========================

        // Use the authMethodId as passport "name"; which is subsequently used below
        // to identify the strategy to use for a specific end point (see passport.authenticate)
        passport.use(authMethodId, new GithubStrategy({
            clientID: authMethodConfig.clientId,
            clientSecret: authMethodConfig.clientSecret,
            callbackURL: callbackUrl
        }, this.verifyProfile));

        // We won't use the passport session handling; no need for that.
        const authenticateSettings = {
            session: false,
            scope: ['user:email'],
            failureRedirect: `${options.basePath}/failure`
        };

        this.authenticateWithGithub = passport.authenticate(authMethodId, authenticateSettings);
        this.authenticateCallback = passport.authenticate(authMethodId, authenticateSettings);

        this.genericFlow.initIdP(this);
    }

    public getType(): string {
        return "github";
    }

    public supportsPrompt(): boolean {
        return false;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    };

    public authorizeWithUi(req, res, next, authRequest: AuthRequest) {
        // Do your thing...
        // Redirect to the Github login page
        return this.authenticateWithGithub(req, res);
    }

    public endpoints(): EndpointDefinition[] {
        return [
            {
                method: 'get',
                uri: '/callback',
                middleware: this.authenticateCallback,
                handler: this.callbackHandler
            }
        ];
    };

    public authorizeByUserPass(user, pass, callback) {
        // Verify username and password, if possible.
        // For Github, this is not possible, so we will just return an
        // error message.
        return failOAuth(400, 'unsupported_grant_type', 'Github does not support authorizing headless with username and password', callback);
    };

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky. For Github, we will just allow it.
        return callback(null, {
            allowRefresh: true
        });
    };

    // debug(authMethodConfig);


    // ========================
    // HELPER METHODS
    // ========================

    private createAuthResponse(profile: any, accessToken: string, callback: Callback<AuthResponse>) {
        debug('createAuthResponse()');
        debug(profile);
        const instance = this;
        // Get the email addresses; they are not included in the OAuth profile directly.
        request.get({
            url: 'https://api.github.com/user/emails',
            headers: {
                'User-Agent': 'wicked Auth Server',
                'Authorization': 'Bearer ' + accessToken,
                'Accept': 'application/json'
            }
        }, (err, apiResponse, apiBody) => {
            if (err)
                return callback(err);
            debug('Github Email retrieved.');

            const nameGuess = utils.splitName(profile.displayName, profile.username);
            const email = instance.getEmailData(utils.getJson(apiBody));
            debug(email);

            const customId = `${instance.authMethodId}:${profile.id}`;

            const defaultProfile = {
                sub: customId,
                username: utils.makeUsername(nameGuess.fullName, profile.username),
                preferred_username: utils.makeUsername(nameGuess.fullName, profile.username),
                name: nameGuess.fullName,
                given_name: nameGuess.firstName,
                family_name: nameGuess.lastName,
                email: email.email,
                email_verified: email.verified,
            } as OidcProfile;

            const authResponse = {
                userId: null, // Not yet known, which is fine
                customId: customId,
                defaultGroups: [],
                defaultProfile: defaultProfile
            } as AuthResponse;
            debug(`Assembled auth response for ${customId}:`);
            debug(authResponse);

            return callback(null, authResponse);
        });
    };

    private getEmailData(emailResponse): EMailData {
        debug('getEmailData()');
        debug(emailResponse);
        const email = {
            email: null,
            verified: false
        };
        const primaryEmail = emailResponse.find(function (emailItem) { return emailItem.primary; });
        if (primaryEmail) {
            email.email = primaryEmail.email;
            email.verified = primaryEmail.verified;
            return email;
        }
        const validatedEmail = emailResponse.find(function (emailItem) { return emailItem.verified; });
        if (validatedEmail) {
            email.email = validatedEmail.email;
            email.verified = validatedEmail.verified;
            return email;
        }
        if (emailResponse.length > 0) {
            const firstEmail = emailResponse[0];
            email.email = firstEmail.email;
            email.verified = firstEmail.verified;
            return email;
        }

        return email;
    };

    // Instance function, see
    // https://github.com/Microsoft/TypeScript/wiki/%27this%27-in-TypeScript
    // This is used as a callback, this is why this is needed
    private verifyProfile = (accessToken: string, refreshToken: string, profile: any, done: Callback<AuthResponse>) => {
        debug('verifyProfile()');
        this.createAuthResponse(profile, accessToken, function (err, authResponse) {
            debug('callback normalizeProfile()');
            if (err) {
                error('normalizeProfile failed.');
                error(err);
                return done(err);
            }
            debug('Github authResponse:');
            debug(authResponse);
            done(null, authResponse);
        });
    };

    /**
     * Github callback handler; this is the endpoint which is called when Github
     * returns with a success or failure response.
     */
    private callbackHandler = (req, res, next) => {
        // Here we want to assemble the default profile and stuff.
        debug('callbackHandler()');
        // The authResponse is now in req.user (for this call), and we can pass that on as an authResponse
        // to continueAuthorizeFlow. Note the usage of "session: false", so that this data is NOT stored
        // automatically in the user session, which passport usually does by default.
        const authResponse = req.user;
        this.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
    };
}
