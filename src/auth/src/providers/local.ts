'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { AuthRequest, AuthResponse, IdentityProvider, EndpointDefinition, IdpOptions, LocalIdpConfig, CheckRefreshDecision, BooleanCallback } from '../common/types';
import { OidcProfile, WickedUserInfo, Callback, WickedApi } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:local');
import * as wicked from 'wicked-sdk';
const Router = require('express').Router;
const qs = require('querystring');

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

export class LocalIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: LocalIdpConfig;
    private options: IdpOptions;

    constructor(basePath: string, authMethodId: string, authMethodConfig: LocalIdpConfig, options: IdpOptions) {
        debug(`constructor(${basePath}, ${authMethodId}, ...)`);
        this.basePath = basePath;
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;
        this.options = options;

        this.genericFlow.initIdP(this);
    }

    public getType(): string {
        return "local";
    }

    public supportsPrompt(): boolean {
        // Ahem. This can be fixed with a "remember me" type of feature.
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

    public authorizeByUserPass(user, pass, callback: Callback<AuthResponse>) {
        debug('authorizeByUserPass()');

        // loginUser returns an authResponse, so we can use that to verify that the user
        // does not interactively have to change his password.
        this.loginUser(user, pass, function (err, authResponse: AuthResponse) {
            if (err)
                return callback(err);
            // Check for "mustChangePassword"; we won't allow this without the user having
            // changed the password.
            // if (authResponse.wickedUserInfo && authResponse.wickedUserInfo.mustChangePassword) {
            //     return failOAuth(400, 'invalid_request', 'Headless authentication now allowed, user must interactively update password first.', callback);
            // } else {
                return callback(null, authResponse);
            // }
        });
    }

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        debug('checkRefreshToken()');
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky.
        return callback(null, {
            allowRefresh: true
        });
    }

    public endpoints(): EndpointDefinition[] {
        return [
            {
                method: 'post',
                uri: '/login',
                handler: this.loginHandler
            },
            {
                method: 'get',
                uri: '/signup',
                handler: this.signupHandler
            },
            {
                method: 'post',
                uri: '/signup',
                handler: this.signupPostHandler
            },
            {
                method: 'get',
                uri: '/forgotpassword',
                handler: this.genericFlow.createForgotPasswordHandler(this.authMethodId)
            },
            {
                method: 'post',
                uri: '/forgotpassword',
                handler: this.genericFlow.createForgotPasswordPostHandler(this.authMethodId)
            },
            {
                method: 'post',
                uri: '/changepassword',
                handler: this.changePasswordHandler
            }
        ];
    }

    private loginHandler = (req, res, next): void => {
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

        this.loginUser(username, password, (err, authResponse) => {
            if (err) {
                debug(err);
                // Delay redisplay of login page a little
                setTimeout(() => instance.renderLogin(req, res, next, 'Username or password invalid.', username), 500);
                return;
            }

            if (authResponse.wickedUserInfo && authResponse.wickedUserInfo.mustChangePassword) {
                // Force change the password
                instance.forceChangePasswordFlow(req, res, next, authResponse);
            } else {
                // Continue as normal
                instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
            }
        });
    };

    private forceChangePasswordFlow(req, res, next, authResponse: AuthResponse): void {
        debug(`forceChangePasswordFlow()`);
        const instance = this;
        const viewModel = utils.createViewModel(req, instance.authMethodId, 'change_password');
        const authSession = utils.getSession(req, instance.authMethodId);
        authSession.tmpAuthResponse = authResponse;
        const authRequest = utils.getAuthRequest(req, instance.authMethodId);
        utils.render(req, res, 'force_change_password', viewModel, authRequest);
    }

    private changePasswordHandler = (req, res, next): void => {
        debug(`POST ${this.authMethodId}/changepassword`);

        const body = req.body;
        const csrfToken = body._csrf;
        const expectedCsrfToken = utils.getAndDeleteCsrfToken(req, 'change_password');
        const instance = this;

        if (!csrfToken || expectedCsrfToken !== csrfToken) {
            setTimeout(() => instance.renderLogin(req, res, next,'CSRF validation failed, please try again.'),  500);
            return;
        }

        // Recaptcha?
        utils.verifyRecaptcha(req, (err) => {
            if (err)
                return failError(401, err, next);

            const authSession = utils.getSession(req, instance.authMethodId);
            if (!authSession.tmpAuthResponse) {
                failMessage(400, 'Invalid session state. Forged password change request?', next);
                return;
            }

            // Sanitize input; should be okay...
            const password = body.password;
            const password2 = body.password2;

            if (!password)
                return failMessage(400, 'Password cannot be empty', next);
            if (password !== password2)
                return failMessage(400, 'Passwords do not match', next);

            const authResponse = authSession.tmpAuthResponse;
            // Take this out of the session. It will go somewhere else in the generic part (see
            // continueAuthorizeFlow()).
            delete authSession.tmpAuthResponse;
            wicked.getUser(authResponse.wickedUserInfo.id, function (err, userInfo) {
                if (err) {
                    failError(500, err, next);
                    return;
                }
                wicked.patchUser(userInfo.id, {
                    email: userInfo.email,
                    groups: userInfo.groups,
                    password: password,
                    mustChangePassword: false
                }, function (err, updatedUserInfo) {
                    if (err) {
                        failError(500, err, next);
                        return;
                    }

                    // Happy as can be, we can continue with the authorization.
                    instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
                });
            });
        });
    }

    private signupHandler = (req, res, next) => {
        debug(`GET ${this.authMethodId}/signup`);
        debug('signupHandler()');
        this.renderSignup(req, res, next, '');
    };

    private signupPostHandler = (req, res, next) => {
        debug(`POST ${this.authMethodId}/signup`);
        debug('signupPostHandler()');

        const body = req.body;
        const csrfToken = body._csrf;
        const expectedCsrfToken = utils.getAndDeleteCsrfToken(req, 'signup');
        const instance = this;

        if (!csrfToken || expectedCsrfToken !== csrfToken)
            return setTimeout(() => instance.renderSignup(req, res, next, 'CSRF validation failed, please try again.'), 500);

        const email = body.email;
        const password = body.password;
        const password2 = body.password2;

        if (!password)
            return failMessage(400, 'Password cannot be empty', next);
        if (password !== password2)
            return failMessage(400, 'Passwords do not match', next);

        // Is signup allowed for this API/auth method combination?
        const apiId = utils.getAuthRequest(req, this.authMethodId).api_id;
        this.checkSignupDisabled(apiId, (err, disableSignup) => {
            if (err)
                return failError(500, err, next);
            if (disableSignup)
                return failMessage(401, 'Signup is not allowed for this API or Authentication Method.', next);

            // Recaptcha?
            utils.verifyRecaptcha(req, (err) => {
                if (err)
                    return failError(401, err, next);
                // Let's give it a shot; wicked can still intervene here...
                const emailValidated = this.authMethodConfig.trustUsers;
                const userCreateInfo = {
                    email: email,
                    password: password,
                    groups: [],
                    validated: emailValidated
                } as WickedUserInfo;
                debug(`signupPostHandler: Attempting to create user ${email}`);
                wicked.apiPost('/users', userCreateInfo, null, (err, userInfo: WickedUserInfo) => {
                    if (err)
                        return failError(500, err, next);

                    debug(`signupPostHandler: Successfully created user ${email} with id ${userInfo.id}`);

                    // Check whether we want to verify the email address or not
                    utils.createVerificationRequest(this.authMethodConfig.trustUsers, this.authMethodId, userInfo.email, (err) => {
                        if (err)
                            return failError(500, err, next);

                        const authResponse = instance.createAuthResponse(userInfo);
                        debug(`signupPostHandler: Successfully created an authResponse`);
                        debug(authResponse);

                        // We're practically logged in now, as the new user.
                        instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
                    });
                });
            });
        });
    };

    private checkSignupDisabled(apiId: string, callback: BooleanCallback) {
        debug(`checkSignupAllowed(${apiId})`);
        const instance = this;
        // This looks complicated, but we must find out whether signing up for using
        // the API is allowed or not. This can be done in two places: On the registration
        // pool (if the API has one), or directly on the auth method (with type local, this
        // implementation).
        utils.getApiRegistrationPool(apiId, (err, poolId) => {
            if (err)
                return callback(err);
            // null is okay for poolId, then the API doesn't have a pool ID
            if (poolId) {
                // But now we have to retrieve that information as well
                utils.getPoolInfo(poolId, (err, poolInfo) => {
                    if (err)
                        return callback(err);
                    const disableSignup = !!instance.authMethodConfig.disableSignup || !!poolInfo.disableRegister;
                    return callback(null, disableSignup);
                });
            } else {
                const disableSignup = !!instance.authMethodConfig.disableSignup;
                return callback(null, disableSignup);
            }
        });
    }

    private renderLogin(req, res, next, flashMessage: string, prefillUsername?: string) {
        debug('renderLogin()');
        const authRequest = utils.getAuthRequest(req, this.authMethodId);
        const authSession = utils.getSession(req, this.authMethodId);
        authSession.tmpAuthResponse = null;
        const instance = this;

        this.checkSignupDisabled(authRequest.api_id, (err, disableSignup) => {
            if (err)
                return failError(500, err, next);
            const viewModel = utils.createViewModel(req, instance.authMethodId, 'login');
            viewModel.errorMessage = flashMessage;
            viewModel.disableSignup = disableSignup;
            if (prefillUsername)
                viewModel.prefillUsername = prefillUsername;
            utils.render(req, res, 'login', viewModel, authRequest);
        });
    }

    private makeAuthorizeUrl(req): string {
        debug(`makeAuthorizeUrl()`);

        let authRequest: AuthRequest;
        try {
            authRequest = utils.getAuthRequest(req, this.authMethodId);
        } catch (ex) {
            warn(`makeAuthorizeUrl: Could not get AuthRequest from request session`);
            return null;
        }
        if (!authRequest.api_id) {
            warn(`makeAuthorizeUrl: Auth Request does not contain an api_id`);
            return null;
        }
        if (!authRequest.client_id) {
            warn(`makeAuthorizeUrl: Auth Request does not contain a client_id`);
            return null;
        }
        if (!authRequest.response_type) {
            warn(`makeAuthorizeUrl: Auth Request does not contain a response_type`);
            return null;
        }
        if (!authRequest.redirect_uri) {
            warn(`makeAuthorizeUrl: Auth Request does not contain a redirect_uri`);
            return null;
        }
        let authorizeUrl = `${this.authMethodId}/api/${authRequest.api_id}/authorize?` +
            `client_id=${qs.escape(authRequest.client_id)}` +
            `&response_type=${authRequest.response_type}` +
            `&redirect_uri=${qs.escape(authRequest.redirect_uri)}`;
        if (authRequest.state)
            authorizeUrl += `&state=${qs.escape(authRequest.state)}`;
        if (authRequest.namespace)
            authorizeUrl += `&namespace=${qs.escape(authRequest.namespace)}`;
        return authorizeUrl;
    }

    private renderSignup(req, res, next, flashMessage: string) {
        debug('renderSignup()');

        const authRequest = utils.getAuthRequest(req, this.authMethodId);
        const instance = this;

        this.checkSignupDisabled(authRequest.api_id, (err, disableSignup) => {
            if (err)
                return failError(500, err, next);

            if (disableSignup)
                return failMessage(403, 'Signup is not allowed.', next);

            const viewModel = utils.createViewModel(req, this.authMethodId, 'signup');
            viewModel.errorMessage = flashMessage;
            viewModel.authorizeUrl = instance.makeAuthorizeUrl(req);
            utils.render(req, res, 'signup', viewModel, authRequest);
        });
    }

    private loginUser(username: string, password: string, callback: Callback<AuthResponse>) {
        debug('loginUser()');
        const instance = this;
        wicked.apiPost('login', {
            username: username,
            password: password
        }, null, function (err, userInfoList: WickedUserInfo[]) {
            if (err)
                return callback(err);
            if (!Array.isArray(userInfoList))
                return callback(makeError('loginUser: Did not return expected format (array).', 500));
            if (userInfoList.length !== 1)
                return callback(makeError(`loginUser: /login did not return user (array length ${userInfoList.length})`, 500));
            debug('loginUser: /login successful');

            const userShortInfo = userInfoList[0];
            // Load the user to get all information (e.g., groups and validated status)
            debug('userInfo: ' + JSON.stringify(userShortInfo));
            wicked.getUser(userShortInfo.id, (err, userInfo) => {
                if (err)
                    return callback(err);
                const authResponse = instance.createAuthResponse(userInfo);
                return callback(null, authResponse);
            });
        });
    }

    private createDefaultProfile(userInfo: WickedUserInfo): OidcProfile {
        debug('createDefaultProfile()');
        // For the local users, we don't have anything to put into the
        // default profile except the user ID and the email address.
        // For other IdPs, there may be other fields which can be prepopulated.
        const oidcProfile = {
            sub: userInfo.id,
            email: userInfo.email,
            email_verified: userInfo.validated,
        } as OidcProfile;
        debug(oidcProfile);
        return oidcProfile;
    }

    private createAuthResponse(userInfo: WickedUserInfo): AuthResponse {
        debug('createAuthResponse()');

        return {
            userId: userInfo.id,
            wickedUserInfo: userInfo,
            defaultGroups: userInfo.groups,
            defaultProfile: this.createDefaultProfile(userInfo)
        };
    }
}
