'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { AuthRequest, EndpointDefinition, AuthResponse, IdentityProvider, IdpOptions, CheckRefreshDecision } from '../common/types';
import { Callback, WickedApi } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:idp');
const Router = require('express').Router;

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

/**
 * This is a sample of how an IdP must work to be able to integrate into
 * the generic OAuth2 workflow in generic.js
 */
export class IdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private options: IdpOptions;
    
    constructor(basePath: string, authMethodId: string, authMethodConfig: any, options: IdpOptions) {
        debug(`constructor(${basePath}, ${authMethodId},...)`);
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);

        this.basePath = basePath;
        this.authMethodId = authMethodId;
        // this.authMethodConfig = authMethodConfig;

        this.genericFlow.initIdP(this);
    }

    public getType() {
        return "idp";
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    }

    public supportsPrompt() {
        // Return true or false depending on whether the IdP supports UI-less authentications;
        // this is for example when using prompt=none for OAuth2, or is_passive for SAML2
        return false;
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
        // Do your thing...
        // Render a login mask...
        // Or redirect to a 3rd party IdP, like Google
    };

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
                method: 'post',
                uri: '/login',
                handler: this.loginHandler
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
        // Verify username and password, if possible.
        // Otherwise (for IdPs where this is not possible), return
        // an error with a reason. Use utils.failOAuth to create
        // an error which will be returned as JSON by the framework.

        // Here, we assume user and pass are OK.
        return callback(null, this.getAuthResponse());
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
     * Sample custom end point, e.g. for responding to logins; see this.endpoints()
     * for how this is hooked into the processes.
     */
    private loginHandler = (req, res, next) => {
        // When you're done with whatever (like verifying username and password,
        // or checking a callback from a 3rd party IdP), you must use the registered
        // generic flow implementation object (genericFlow from the constructor) to
        // pass back the same type of structure as in the authorizeByUserPass below.
        this.genericFlow.continueAuthorizeFlow(req, res, next, this.getAuthResponse());
    };


    // Sample implementation
    private getAuthResponse(): AuthResponse {
        // This is obviously just dummy code showing how the response
        // must look like to play nice with the 
        return {
            // The wicked database user ID, in case we already know this
            // user (this only applies for local login with username and
            // password)
            userId: null,
            // A string giving a unique user id for this IdP, usually with
            // a prefix which corresponds with the auth method name this
            // IdP is used for. This is used as a unique custom ID for the
            // wicked user in the local database.
            customId: 'idp:<user id in idp>',
            // In case you have a predefined mapping to wicked user groups,
            // E.g. from LDAP or AD groups, pass them in as strings here.
            defaultGroups: [],
            // Default OIDC profile
            defaultProfile: {
                // Fill this with the customId; it will be overridden later, but
                // may be used in case the API is a passthrough API.
                sub: "idp:<user id in idp>",
                email: "default@user.org",
                // Specify whether the user's email address is pre-verified
                // or not. I.e., whether you trust the email address of
                // the IdP or not.
                email_verified: true,
                given_name: "Default",
                family_name: "User"
                // If you want to pass in more OIDC profile parameters,
                // feel free to do so. See:
                // http://openid.net/specs/openid-connect-core-1_0.html#Claims
            }
        };
    };
}
