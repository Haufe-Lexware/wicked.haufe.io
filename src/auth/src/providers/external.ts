'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { AuthRequest, AuthResponse, IdentityProvider, EndpointDefinition, IdpOptions, CheckRefreshDecision, BooleanCallback, ExternalIdpConfig, TokenInfo, ErrorLink } from '../common/types';
import { OidcProfile, WickedUserInfo, WickedAccessToken, Callback } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:external');
import * as wicked from 'wicked-sdk';
const Router = require('express').Router;
const qs = require('querystring');
const request = require('request');

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';
import { ExternalUserPassRequest, ExternalUserPassResponse, ExternalRefreshResponse, WickedApi } from 'wicked-sdk';

export class ExternalIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: ExternalIdpConfig;
    private options: IdpOptions;

    constructor(basePath: string, authMethodId: string, authMethodConfig: ExternalIdpConfig, options: IdpOptions) {
        debug(`constructor(${basePath}, ${authMethodId}, ...)`);
        this.basePath = basePath;
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;
        this.options = options;

        this.genericFlow.initIdP(this);
    }

    public getType(): string {
        return "external";
    }

    public supportsPrompt(): boolean {
        return false;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    }

    public authorizeWithUi(req, res, next, authRequest: AuthRequest) {
        // Render a login mask...
        const prefillUsername = authRequest.prefill_username;
        this.renderLogin(req, res, next, null, prefillUsername);
    }

    public authorizeByUserPass = async (user, pass, callback: Callback<AuthResponse>) => {
        debug('authorizeByUserPass()');

        // loginUser returns an authResponse, so we can use that to verify that the user
        // does not interactively have to change his password.
        try {
            const authResponse = await this.loginUser(user, pass);
            return callback(null, authResponse);
        } catch (err) {
            return callback(err);
        }
    }

    public checkRefreshToken(tokenInfo: WickedAccessToken, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        debug('checkRefreshToken()');
        const instance = this;

        // Decide whether it's okay to refresh this token or not. Ask the external IdP whether it's okay.
        // Only do that if it's a passthrough users API; in all other cases it does not make much sense, for the
        // following reason: the authenticated_userid is a wicked userId, and not the sub from the external IdP,
        // and thus we can't expect the external IdP to know whether to allow a refresh of this user or not.
        if (!apiInfo.passthroughUsers) {
            // Here we just say it's okay.
            return callback(null, {
                allowRefresh: true
            });
        }

        // Passthrough users case - the external IdP gets an authenticated user id which it knows (by structure),
        // and thus it makes sense to ask the IdP whether a refresh is allowed.
        const postBody = {
            authenticated_userid: tokenInfo.authenticated_userid,
            authenticated_scope: tokenInfo.scope
        };
        const uri = this.authMethodConfig.allowRefreshUrl;
        request.post({
            uri,
            body: postBody,
            json: true
        }, function (err, response, responseBody) {
            if (err) {
                return callback(err);
            }
            try {
                const jsonResponse = utils.getJson(responseBody) as ExternalRefreshResponse;
                if (response.statusCode !== 200 || jsonResponse.error) {
                    const err = makeError(`External IDP ${instance.authMethodId} returned an error or an unexpected status code (${response.statusCode})`, response.statusCode);
                    if (jsonResponse.error)
                        err.internalError = new Error(`Error: ${jsonResponse.error}, description. ${jsonResponse.error_description || '<no description>'}`);
                    return callback(err);
                }
                return callback(null, {
                    allowRefresh: jsonResponse.allow_refresh || false
                });
            } catch (err) {
                error(err);
                return callback(err);
            }
        });
    }

    public getErrorLinks(): ErrorLink {
        return null;
    }

    public endpoints(): EndpointDefinition[] {
        return [
            {
                method: 'post',
                uri: '/login',
                handler: this.loginHandler
            }
        ];
    }

    private loginHandler = async (req, res, next) => {
        debug(`POST ${this.authMethodId}/login`);
        debug('loginHandler()');
        // When you're done with whatever (like verifying username and password,
        // or checking a callback from a 3rd party IdP), you must use the registered
        // generic flow implementation object (genericFlow from the constructor) to
        // pass back the same type of structure as in the authorizeByUserPass below.
        const body = req.body;
        const csrfToken = body._csrf;
        const expectedCsrfToken = utils.getAndDeleteCsrfToken(req, 'login');
        const instance = this;

        if (!csrfToken || csrfToken !== expectedCsrfToken)
            return this.renderLogin(req, res, next, 'Suspected login forging detected (CSRF protection).');

        const username = req.body.username;
        const password = req.body.password;
        debug(`username: ${username}, password: ${password}`);

        try {
            const authResponse = await this.loginUser(username, password);

            // Continue as normal
            instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
        } catch (err) {
            debug(err);
            // Delay redisplay of login page a little
            await utils.delay(500);
            instance.renderLogin(req, res, next, 'Username or password invalid.', username);
        }
    };

    private renderLogin(req, res, next, flashMessage: string, prefillUsername?: string) {
        debug('renderLogin()');
        const authRequest = utils.getAuthRequest(req, this.authMethodId);
        const authSession = utils.getSession(req, this.authMethodId);
        authSession.tmpAuthResponse = null;
        const instance = this;

        const viewModel = utils.createViewModel(req, instance.authMethodId, 'login');
        viewModel.errorMessage = flashMessage;
        viewModel.disableSignup = true;
        delete viewModel.forgotPasswordUrl;
        if (this.authMethodConfig.forgotPasswordUrl)
            viewModel.forgotPasswordUrl = this.authMethodConfig.forgotPasswordUrl;
        if (prefillUsername)
            viewModel.prefillUsername = prefillUsername;
        if (this.authMethodConfig.usernamePrompt)
            viewModel.usernamePrompt = this.authMethodConfig.usernamePrompt;
        if (this.authMethodConfig.passwordPrompt)
            viewModel.usernamePrompt = this.authMethodConfig.passwordPrompt;
        utils.render(req, res, 'login', viewModel, authRequest);
    }

    private loginUser = async (username: string, password: string): Promise<AuthResponse> => {
        const instance = this;
        return new Promise<AuthResponse>(function (resolve, reject) {
            instance.loginUser_(username, password, function (err, authResponse) {
                err ? reject(err) : resolve(authResponse);
            });
        });
    }

    private loginUser_(username: string, password: string, callback: Callback<AuthResponse>) {
        debug('loginUser()');

        // Ask the external service whether this is a good username/password combination
        const postBody: ExternalUserPassRequest = {
            username,
            password
        };
        const uri = this.authMethodConfig.validateUserPassUrl;
        const instance = this;
        request.post({
            uri,
            body: postBody,
            json: true
        }, function (err, res, responseBody) {
            if (err)
                return callback(err);
            try {
                const jsonResponse = utils.getJson(responseBody) as ExternalUserPassResponse;
                if (res.statusCode !== 200 || jsonResponse.error) {
                    const err = makeError(`External IDP ${instance.authMethodId} returned an error or an unexpected status code (${res.statusCode})`, res.statusCode);
                    if (jsonResponse.error)
                        err.internalError = new Error(`Error: ${jsonResponse.error}, description. ${jsonResponse.error_description || '<no description>'}`);
                    return callback(err);
                }
                return callback(null, instance.createAuthResponse(jsonResponse));
            } catch (err) {
                error(err);
                return callback(err);
            }
        })
    }

    private createAuthResponse(response: ExternalUserPassResponse): AuthResponse {
        if (!response.profile)
            throw makeError(`The external IdP ${this.authMethodId} did not return a profile property.`, 500);
        const profile = response.profile;
        if (!profile.sub)
            throw makeError(`The external IdP ${this.authMethodId} did not return a "sub" profile property.`, 500);
        if (!profile.email)
            throw makeError(`The external IdP ${this.authMethodId} did not return a "email" profile property.`, 500);
        return {
            userId: null,
            customId: `${this.authMethodId}:${profile.sub}`,
            defaultGroups: [],
            defaultProfile: profile
        };
    }
}
