'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { IdentityProvider, IdpOptions, AuthRequest, EndpointDefinition, CheckRefreshDecision, AuthResponse, DummyIdpConfig } from '../common/types';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:dummy');
import * as wicked from 'wicked-sdk';
import { Callback, WickedApi } from 'wicked-sdk';
import { utils } from '../common/utils';

export class DummyIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private authMethodConfig: DummyIdpConfig;
    private options: IdpOptions;

    constructor(basePath: string, authMethodId: string, authMethodConfig: DummyIdpConfig, options: IdpOptions) {
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);
        this.basePath = basePath;
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;
        this.options = options;

        this.genericFlow.initIdP(this);
    }

    public getType(): string {
        return "dummy";
    }

    public supportsPrompt(): boolean {
        return false;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
    }

    public authorizeWithUi(req, res, next, authRequest: AuthRequest): void {
        // Do your thing...
        // Render a login mask...
        // Or redirect to a 3rd party IdP, like Google
        this.renderLogin(req, res, null);
    };

    public endpoints(): EndpointDefinition[] {
        return [
            {
                method: 'post',
                uri: '/login',
                handler: this.loginHandler
            }
        ];
    };

    // Notice that we're using the instance function (=>) notation here,
    // to save the "this" context.
    private loginHandler = (req, res, next) => {
        // When you're done with whatever (like verifying username and password,
        // or checking a callback from a 3rd party IdP), you must use the registered
        // generic flow implementation object (genericFlow from the constructor) to
        // pass back the same type of structure as in the authorizeByUserPass below.

        //const apiId = req.params.apiId;
        debug(`POST ${this.authMethodId}/login`);

        const authResponse = this.getDummyAuthResponse();
        this.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
    }

    public authorizeByUserPass = (user, pass, callback: Callback<AuthResponse>) => {
        debug('authorizeByUserPass()');

        return callback(null, this.getDummyAuthResponse());
    };

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        debug('checkRefreshToken()');
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky.
        return callback(null, {
            allowRefresh: true
        });
    };

    private getDummyAuthResponse(): AuthResponse {
        return {
            customId: 'dummy:1234567890',
            defaultGroups: [],
            defaultProfile: {
                sub: 'dummy:1234567890',
                email: 'dummy@hello.com',
                email_verified: false,
                given_name: 'Dummy',
                family_name: 'Userson'
            }
        };
    }

    private renderLogin(req, res, flashError: string): void {
        debug('renderLogin()');
        utils.render(req, res, 'dummy', {
            title: req.app.glob.title,
            portalUrl: wicked.getExternalPortalUrl(),
            baseUrl: req.app.get('base_path'),
            errorMessage: flashError,
            loginUrl: `${this.authMethodId}/login`
        });
    }
}
