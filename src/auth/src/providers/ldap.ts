'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { AuthRequest, AuthResponse, IdentityProvider, EndpointDefinition, IdpOptions, CheckRefreshDecision, BooleanCallback, LdapIdpConfig, TokenInfo } from '../common/types';
import { OidcProfile, WickedUserInfo, Callback } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:ldap');
import * as wicked from 'wicked-sdk';
const Router = require('express').Router;
const qs = require('querystring');
const request = require('request');
import { LdapClient } from './ldap-client';

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';
import { WickedApi } from 'wicked-sdk';
import { profileStore } from '../common/profile-store';

export class LdapIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: LdapIdpConfig;
    private ldapAttributes: string[];
    private options: IdpOptions;

    constructor(basePath: string, authMethodId: string, authMethodConfig: LdapIdpConfig, options: IdpOptions) {
        debug(`constructor(${basePath}, ${authMethodId}, ...)`);
        this.basePath = basePath;
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;
        this.checkConfig();
        this.options = options;

        this.genericFlow.initIdP(this);
    }

    private checkConfig(): void {
        const config = this.authMethodConfig;
        if (!config.profile)
            throw new Error('LDAP configuration: profile property is empty; must contain mapping of OIDC property to LDAP attribute');
        if (!config.profile.sub)
            throw new Error('LDAP Configuration: profile property must contain "sub" mapping');
        if (!config.profile.email)
            throw new Error('LDAP Configuration: profile property must contain "email" mapping');

        if (!config.url)
            throw new Error('LDAP Configuration: url not specified');
        if (!config.filter || (config.filter.indexOf('%username%') < 0))
            throw new Error('LDAP Configuration: filter not specified, or does not contain "%username%"');

        // We always need the distinguished name, no matter what is in the profile mapping
        const attributes = {
            'dn': true
        };
        for (let profileAttribute in config.profile) {
            const ldapAttribute = config.profile[profileAttribute];
            attributes[ldapAttribute] = true;
        }
        const attributeList = [];
        for (let ldapAttribute in attributes) {
            attributeList.push(ldapAttribute);
        }
        this.ldapAttributes = attributeList;
    }

    public getType(): string {
        return "ldap";
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
            debug('loginUser() successfully returned.');
            debug(authResponse);
            return callback(null, authResponse);
        } catch (err) {
            error('loginUser() failed:' + err.message);
            return callback(err);
        }
    }

    public checkRefreshToken(tokenInfo: TokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        debug('checkRefreshToken()');
        const instance = this;

        // TODO: How to decide whether a user is allowed to refresh over LDAP or not?
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
        debug(`username: ${username}, password: ***`);

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

    private async loginUser(username: string, password: string): Promise<AuthResponse> {
        const instance = this;

        // Validate username; check that we don't have any wildcards or such in it
        if (!/^[a-zA-Z0-9\-_@\.+]+$/.test(username)) {
            warn('An invalid username (invalid characters, regex not passing) was passed in. Rejecting.');
            throw new Error('loginUser(): Username contains invalid characters.');
        }
        let ldapClient: LdapClient;
        try {
            const config = instance.authMethodConfig;
            ldapClient = new LdapClient({
                url: config.url
            });
            await ldapClient.connect(config.ldapUser, config.ldapPassword);
            const filter = config.filter.replace('%username%', username);
            const userList = await ldapClient.search(
                instance.authMethodConfig.base,
                instance.ldapAttributes,
                filter);
            if (userList.length <= 0) {
                warn(`Unknown username: ${username}`)
                throw new Error('Username not known');
            } else if (userList.length > 1) {
                error(`LDAP search return multiple results; this should not be possible. Quitting. ${userList.length} results returned.`);
                throw new Error('Ambigous user search; internal server error.');
            }
            const user = userList[0];
            const userDN = user.dn;
            if (!userDN)
                throw new Error('LDAP: Successfully retrieved user, but it does not contain "dn" attribute');
            debug(`Successfully retrieved DN "${userDN}"`);
            // Now check whether the password is correct; this will throw if not correct
            await ldapClient.checkDNPass(userDN, password);
            debug('checkDNPass returned, so it has to have been successful');

            // Yay, now convert the user to a profile.
            return instance.createAuthResponse(user);
        } finally {
            if (ldapClient) {
                debug('Destroying ldapClient.')
                await ldapClient.destroy();
                debug('Destroyed ldapClient.')
            }
        }
    }

    private createAuthResponse(user: any): AuthResponse {
        debug('createAuthResponse()');
        const profile = this.createProfile(user);
        return {
            userId: null,
            customId: `${this.authMethodId}:${profile.sub}`,
            defaultGroups: [],
            defaultProfile: profile
        };
    }

    private createProfile(user: any): OidcProfile {
        debug('createProfile()');
        debug(JSON.stringify(user));
        const profileConfig = this.authMethodConfig.profile;
        const profile: OidcProfile = {
            sub: null
        };
        for (let profileAttribute in profileConfig) {
            profile[profileAttribute] = user[profileConfig[profileAttribute]];
        }
        if (!profile.sub) {
            throw new Error('LDAP: Retrieved profile could not resolve a "sub" property correctly. Is undefined or empty.');
        }
        if (!profile.email) {
            throw new Error('LDAP: Retrieved profile could not resolve a "email" property correctly. Is undefined or empty.');
        }
        if (this.authMethodConfig.trustUsers) {
            profile.email_verified = true;
        }
        debug('createProfile(): ' + JSON.stringify(profile));
        return profile;
    }
}
