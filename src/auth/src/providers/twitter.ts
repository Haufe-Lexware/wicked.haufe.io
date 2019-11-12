'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { IdpOptions, ExpressHandler, EmailMissingHandler, TwitterIdpConfig, IdentityProvider, AuthRequest, EndpointDefinition, CheckRefreshDecision, AuthResponse } from '../common/types';
import { OidcProfile, Callback, WickedApi } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:twitter');
const Router = require('express').Router;

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

const request = require('request');
const passport = require('passport');
const Twitter = require('twitter');

const TwitterStrategy = require('passport-twitter');

/**
 * Twitter IdP implementation.
 */
export class TwitterIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: TwitterIdpConfig;
    private options: IdpOptions;

    private authenticateWithTwitter: ExpressHandler;
    private authenticateCallback: ExpressHandler;
    private emailMissingHandler: EmailMissingHandler;

    constructor(basePath: string, authMethodId: string, authMethodConfig: TwitterIdpConfig, options: IdpOptions) {
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.basePath = basePath;
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;

        // Verify configuration
        if (!authMethodConfig.consumerKey)
            throw new Error(`Twitter auth method "${authMethodId}": In auth method configuration, property "config", the property "consumerKey" is missing.`);
        if (!authMethodConfig.consumerSecret)
            throw new Error(`Twitter auth method "${authMethodId}": In auth-server configuration, property "config", the property "consumerSecret" is missing.`);
        // Assemble the callback URL
        const callbackUrl = `${options.externalUrlBase}/${authMethodId}/callback`;
        info(`Twitter Authentication: Expected callback URL: ${callbackUrl}`);

        // ========================
        // PASSPORT INITIALIZATION
        // ========================

        // Use the authMethodId as passport "name"; which is subsequently used below
        // to identify the strategy to use for a specific end point (see passport.authenticate)

        const authenticateSettings = {
            session: false,
            failureRedirect: '/auth-server/failure'
        };

        passport.use(new TwitterStrategy({
            consumerKey: authMethodConfig.consumerKey,
            consumerSecret: authMethodConfig.consumerSecret,
            callbackURL: callbackUrl
        }, this.verifyProfile));

        this.authenticateWithTwitter = passport.authenticate(authMethodId, authenticateSettings);
        this.authenticateCallback = passport.authenticate(authMethodId, authenticateSettings);

        // Various other handlers

        // The email missing handler will be called if we do not get an email address back from
        // Twitter, which may happen. It may be that we still already have the email address, in case
        // the user already exists. This is checked in the createEmailMissingHandler.
        this.emailMissingHandler = this.genericFlow.createEmailMissingHandler(authMethodId, this.continueAuthenticate);

        this.genericFlow.initIdP(this);
    }

    public getType() {
        return "twitter";
    }

    public supportsPrompt(): boolean {
        return false;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    };

    public authorizeWithUi(req, res, next, authRequest: AuthRequest) {
        // Do your thing...
        // Redirect to the Twitter login page
        return this.authenticateWithTwitter(req, res);
    };

    public endpoints(): EndpointDefinition[] {
        return [
            {
                method: 'get',
                uri: '/callback',
                middleware: this.authenticateCallback,
                handler: this.callbackHandler
            },
            {
                method: 'post',
                uri: '/emailmissing',
                handler: this.genericFlow.createEmailMissingPostHandler(this.authMethodId, this.continueAuthenticate)
            }
        ];
    };

    public authorizeByUserPass(user: string, pass: string, callback: Callback<AuthResponse>) {
        // Verify username and password, if possible.
        // For Twitter, this is not possible, so we will just return an
        // error message.
        return failOAuth(400, 'unsupported_grant_type', 'Twitter does not support authorizing headless with username and password', callback);
    }

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky. For Twitter, we will just allow it.
        return callback(null, {
            allowRefresh: true
        });
    }

    // ========================
    // HELPER METHODS
    // ========================

    // Instance function, on purpose; this is used as a passport callback
    private verifyProfile = (token, tokenSecret, profile, done: Callback<AuthResponse>) => {
        debug('Twitter Authentication succeeded.');
        this.createAuthResponse(profile, token, tokenSecret, function (err, authResponse) {
            if (err) {
                error('createAuthResponse failed.');
                error(err);
                return done(err);
            }
            debug('Twitter authResponse:');
            debug(authResponse);
            done(null, authResponse);
        });
    };

    private createAuthResponse(profile, token: string, tokenSecret: string, callback: Callback<AuthResponse>): void {
        debug('normalizeProfile()');

        const nameGuess = utils.splitName(profile.displayName, profile.username);
        const email = null; // We don't get email addresses from Twitter as a default
        const email_verified = false;

        const customId = `${this.authMethodId}:${profile.id}`;
        debug(`Twitter token: ${token}`);
        debug(`Twitter tokenSecret: ${tokenSecret}`);
        //debug('Twitter raw profile:');
        //debug(profile);

        const defaultProfile = {
            sub: customId,
            username: utils.makeUsername(nameGuess.fullName, profile.username),
            preferred_username: utils.makeUsername(nameGuess.fullName, profile.username),
            name: nameGuess.fullName,
            given_name: nameGuess.firstName,
            family_name: nameGuess.lastName,
            email: email,
            email_verified: email_verified
        } as OidcProfile;

        // To read the email address, we need the twitter client. Twitter requires
        // signing all requests, and thus it's easier to use a library for that rather
        // than trying to roll our own signing...
        const twitterClient = new Twitter({
            consumer_key: this.authMethodConfig.consumerKey,
            consumer_secret: this.authMethodConfig.consumerSecret,
            access_token_key: token,
            access_token_secret: tokenSecret
        });

        // See https://developer.twitter.com/en/docs/accounts-and-users/manage-account-settings/api-reference/get-account-verify_credentials
        const twitterParams = { include_email: false };
        debug('Attempting to verify Twitter credentials...');
        twitterClient.get('account/verify_credentials', twitterParams, (err, extendedProfile, response) => {
            if (err)
                return callback(err);
            debug('Successfully verified Twitter credentials, here are the results:');
            debug(extendedProfile);

            const jsonBody = utils.getJson(extendedProfile);

            if (jsonBody.email) {
                // If we have an email address, Twitter assures it's already verified.
                defaultProfile.email = jsonBody.email;
                defaultProfile.email_verified = true;
            }

            const authResponse = {
                userId: null,
                customId: customId,
                defaultGroups: [],
                defaultProfile: defaultProfile
            };
            debug('Twitter authResponse:');
            debug(authResponse);

            callback(null, authResponse);
        });
    };

    // We will be called back (hopefully) on this end point via the emailMissingPostHandler (in utils.js)
    // It's a callback -> use the => notation to keep the correct "this" reference.
    private continueAuthenticate = (req, res, next, email) => {
        debug(`continueAuthenticate(${this.authMethodId})`);

        const session = utils.getSession(req, this.authMethodId);

        if (!session ||
            !session.tmpAuthResponse) {
            return failMessage(500, 'Invalid state: Was expecting a temporary auth response.', next);
        }
        const authResponse = session.tmpAuthResponse;
        delete session.tmpAuthResponse;

        authResponse.defaultProfile.email = email;
        authResponse.defaultProfile.email_verified = false;

        return this.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
    };

    /**
     * Twitter callback handler; this is the endpoint which is called when Twitter
     * returns with a success or failure response.
     * 
     * The instance function notation (=>) is on purpose, as this is a callback function.
     */
    private callbackHandler = (req, res, next) => {
        // Here we want to assemble the default profile and stuff.
        debug('callbackHandler()');
        // The authResponse is now in req.user (for this call), and we can pass that on as an authResponse
        // to continueAuthorizeFlow. Note the usage of "session: false", so that this data is NOT stored
        // automatically in the user session, which passport usually does by default.
        const authResponse = req.user;

        // Now we have to check whether we received an email adress from Twitter; if not, we need to ask
        // the user for one.
        if (authResponse.defaultProfile &&
            authResponse.defaultProfile.email) {
            // Yes, all is good, we can go back to the generic router
            return this.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
        }

        // No email from Twitter, let's ask for one, but we must store the temporary authResponse for later
        // usage, in the session. It may be that emailMissingHandler is able to retrieve the email address
        // from wicked, if the user is already registered. Otherwise the user will be asked.
        utils.getSession(req, this.authMethodId).tmpAuthResponse = authResponse;

        return this.emailMissingHandler(req, res, next, authResponse.customId);
    };
}
