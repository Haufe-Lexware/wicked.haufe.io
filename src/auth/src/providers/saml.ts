'use strict';

import { GenericOAuth2Router } from '../common/generic-router';
import { AuthRequest, EndpointDefinition, AuthResponse, IdentityProvider, IdpOptions, SamlIdpConfig, CheckRefreshDecision, SamlAuthResponse, ErrorLink } from '../common/types';
import { OidcProfile, Callback, WickedApi } from 'wicked-sdk';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:saml');
const Router = require('express').Router;
const saml2 = require('wicked-saml2-js');
const mustache = require('mustache');
const qs = require('querystring');

import { utils } from '../common/utils';
import { failMessage, failError, failOAuth, makeError } from '../common/utils-fail';

/**
 * SAML OAuth2 Wrapper implementation
 */
export class SamlIdP implements IdentityProvider {

    private genericFlow: GenericOAuth2Router;
    private basePath: string;
    private authMethodId: string;
    private options: IdpOptions;
    private authMethodConfig: SamlIdpConfig;

    private serviceProvider: any;
    private identityProvider: any;

    constructor(basePath: string, authMethodId: string, authMethodConfig: any, options: IdpOptions) {
        debug(`constructor(${basePath}, ${authMethodId},...)`);
        this.genericFlow = new GenericOAuth2Router(basePath, authMethodId);

        this.basePath = basePath;
        this.authMethodId = authMethodId;
        this.authMethodConfig = authMethodConfig;
        this.options = options;

        if (!authMethodConfig.spOptions)
            throw new Error(`SAML Auth Method ${authMethodId}: config does not contain an "spOptions" property.`);
        if (!authMethodConfig.idpOptions)
            throw new Error(`SAML Auth Method ${authMethodId}: config does not contain an "idpOptions" property.`);
        if (!authMethodConfig.profile)
            throw new Error(`SAML Auth Method ${authMethodId}: config does not contain a "profile" property.`);
        if (!authMethodConfig.profile.sub || !authMethodConfig.profile.email)
            throw new Error(`SAML Auth Method ${authMethodId}: config of profile must contain both "sub" and "email" mappings.`);

        // Assemble the SAML endpoints
        const assertUrl = `${options.externalUrlBase}/${authMethodId}/assert`;
        info(`SAML Authentication: Assert URL: ${assertUrl}`);
        const entityUrl = `${options.externalUrlBase}/${authMethodId}/metadata.xml`;
        info(`SAML Authentication: Metadata URL: ${entityUrl}`);

        this.authMethodConfig.spOptions.assert_endpoint = assertUrl;
        this.authMethodConfig.spOptions.entity_id = entityUrl;

        this.serviceProvider = new saml2.ServiceProvider(authMethodConfig.spOptions);
        this.identityProvider = new saml2.IdentityProvider(authMethodConfig.idpOptions);

        this.genericFlow.initIdP(this);
    }

    public getType() {
        return "saml";
    }

    public supportsPrompt(): boolean {
        // This is currently not supported by saml2-js, see the following PR:
        // https://github.com/Clever/saml2/pull/135
        return true;
    }

    public getRouter() {
        return this.genericFlow.getRouter();
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
        const instance = this;
        // Do your thing...
        const options = {} as any;
        if (authRequest.prompt == 'login') {
            debug('Forcing authentication step (SAML)');
            options.force_authn = true;
        } else if (authRequest.prompt === 'none') {
            debug('Forcing non-interactive login (SAML)');
            if (!instance.options.externalUrlBase.startsWith('https')) {
                // Non-interactive login is not supported if we're not using https,
                // as the browsers ask the user whether it's okay to post a non-secure
                // form. This cannot be answered in non-interactive mode.
                error('Attempt to do non-interactive authentication over http - THIS DOES NOT WORK.');
                (async () => {
                    await instance.genericFlow.failAuthorizeFlow(req, res, next, 'invalid_request', 'SAML2 cannot answer non-interactive requests over http. Must use https.');
                })();
                return;
            }
            options.is_passive = true;
        }
        this.serviceProvider.create_login_request_url(this.identityProvider, options, function (err, loginUrl, requestId) {
            if (err)
                return failError(500, err, next);
            // Remember the request ID
            authRequest.requestId = requestId;
            res.redirect(loginUrl);
        });
    };

    /**
     * When a user logs out using the /logout endpoint, and the user has a SAML
     * session running, also log out (SSO) with the SAML IdP. We use the redirect_uri
     * from the logout as RelayState, so that we can redirect back to the /logout
     * URL, which then in turn can fire off the logoutHooks for the other IdP (or e.g.
     * for additional SAML IdPs).
     * 
     * @param redirect_uri 
     */
    public logoutHook(req, res, next, redirect_uri: string): boolean {
        debug('logoutHook()');
        if (!req.session || !req.session[this.authMethodId])
            return false; // Nothing to do, not logged in.
        debug('Trying to SAML Logout.');
        const instance = this;
        try {
            const authResponse = utils.getAuthResponse(req, instance.authMethodId) as SamlAuthResponse;
            const options: any = {
                name_id: authResponse.name_id,
                session_index: authResponse.session_index
            };

            // Check that the identityProvider is correctly configured
            if (!instance.identityProvider.sso_logout_url) {
                next(makeError('The SAML configuration does not contain an sso_logout_url.', 500));
                return true;
            }

            // Now we kill our session state.
            utils.deleteSession(req, instance.authMethodId);

            if (redirect_uri)
                options.relay_state = Buffer.from(redirect_uri).toString('base64');
            instance.serviceProvider.create_logout_request_url(
                instance.identityProvider,
                options,
                function (err, logoutUrl) {
                    if (err) {
                        error(err);
                        next(err);
                        return;
                    }
                    debug('logoutUrl:');
                    debug(logoutUrl);
                    res.redirect(logoutUrl);
                    return;
                }
            );
            // This means this method will handle returning something to res; the 
            // app.get(/logout) endpoint will not do anything more as of the first
            // IdP returning true here.
            return true;
        } catch (ex) {
            error(ex);
            // Silently just kill all sessions, or at least this one.
            return false;
        }
    }

    public getErrorLinks(): ErrorLink {
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
        return [
            {
                method: 'get',
                uri: '/metadata.xml',
                handler: this.createMetadataHandler()
            },
            {
                method: 'post',
                uri: '/assert',
                handler: this.createAssertHandler()
            },
            {
                method: 'get',
                uri: '/assert',
                handler: this.createLogoutHandler()
            }
        ];
    };

    private samlMetadata: string = null;
    private createMetadataHandler() {
        const instance = this;
        return function (req, res, next) {
            res.type('application/xml');
            if (!instance.samlMetadata) {
                instance.samlMetadata = instance.serviceProvider.create_metadata();
            }
            res.send(instance.samlMetadata);
        }
    }

    private createAssertHandler() {
        const instance = this;
        return function (req, res, next) {
            debug(`assertHandler()`);
            const authRequest = utils.getAuthRequest(req, instance.authMethodId);
            const requestId = authRequest.requestId;
            if (!requestId)
                return failMessage(400, 'Invalid state for SAML Assert: Request ID is not present', next);
            instance.assert(req, requestId, function (err, samlResponse) {
                if (err) {
                    error('SAML2 assert failed, error:');
                    error(JSON.stringify(err));
                    // Let's see if we can make some sense from this...
                    let errorMessage = 'server_error';
                    let errorDescription = err.message;
                    const responseProp = 'urn:oasis:names:tc:SAML:2.0:status:Responder'
                    if (err.extra && err.extra.status && err.extra.status[responseProp]
                        && Array.isArray(err.extra.status[responseProp])
                        && err.extra.status[responseProp].length > 0) {
                        switch (err.extra.status[responseProp][0]) {
                            case 'urn:oasis:names:tc:SAML:2.0:status:NoPassive':
                                errorMessage = 'login_required';
                                errorDescription = 'Interactive login is required'
                                break;
                            default:
                                errorDescription = err.extra.status[responseProp];
                                break;
                        }
                    }
                    (async () => {
                        await instance.genericFlow.failAuthorizeFlow(req, res, next, errorMessage, errorDescription);
                    })();
                    return;
                    //return failError(500, err, next);
                }
                debug(samlResponse);
                instance.createAuthResponse(samlResponse, function (err, authResponse) {
                    if (err)
                        return next(err);
                    return instance.genericFlow.continueAuthorizeFlow(req, res, next, authResponse);
                });
            });
        }
    }

    private createLogoutHandler() {
        const instance = this;
        return function (req, res, next) {
            debug(`logoutHandler()`);
            debug(req.query);
            const options = {
                request_body: req.query
            };
            const relay_state = req.query.RelayState;
            instance.serviceProvider.redirect_assert(instance.identityProvider, options, function (err, response) {
                if (err)
                    return next(err);
                debug(response);
                if (response.type === 'logout_request') {
                    // IdP initiated logout
                    debug('SAML: logout_request');
                    const in_response_to = response && response.response_header ? response.response_header.in_response_to : null;
                    instance.getLogoutResponseUrl(in_response_to, relay_state, function (err, redirectUrl) {
                        if (err)
                            return next(err);
                        info(redirectUrl);
                        info('Successfully logged out, deleting session state.');
                        utils.deleteSession(req, instance.authMethodId);
                        return res.redirect(redirectUrl);
                    });
                } else if (response.type === 'logout_response') {
                    // Response from our logout request
                    debug('SAML: logout_response');
                    try {
                        // Redirect back to our own /logout
                        let redirect_uri = `${instance.basePath}/logout`;
                        if (relay_state)
                            redirect_uri += '?redirect_uri=' + qs.escape((new Buffer(relay_state, 'base64')).toString());
                        return res.redirect(redirect_uri);
                    } catch (ex) {
                        return next(ex);
                    }
                }
            });
        }
    }

    private createAuthResponse(samlResponse, callback: Callback<AuthResponse>): void {
        debug(`createAuthResponse()`);
        const defaultProfile = this.buildProfile(samlResponse);
        if (!defaultProfile.sub)
            return callback(makeError('SAML Response did not contain a suitable ID (claim "sub" is missing/faulty in configuration?)', 400));
        // Map to custom ID
        const customId = `${this.authMethodId}:${defaultProfile.sub}`;
        defaultProfile.sub = customId;
        debug(defaultProfile);
        const authResponse: SamlAuthResponse = {
            userId: null,
            customId: customId,
            defaultProfile: defaultProfile,
            defaultGroups: [],
            name_id: samlResponse.user.name_id,
            session_index: samlResponse.user.session_index
        }
        return callback(null, authResponse);
    }

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
        debug('authorizeByUserPass()');
        return failOAuth(400, 'unsupported_grant_type', 'SAML does not support authorizing headless with username and password', callback);
    };

    public checkRefreshToken(tokenInfo, apiInfo: WickedApi, callback: Callback<CheckRefreshDecision>) {
        // Decide whether it's okay to refresh this token or not, e.g.
        // by checking that the user is still valid in your database or such;
        // for 3rd party IdPs, this may be tricky.
        return callback(null, {
            allowRefresh: true
        });
    };

    private getLogoutResponseUrl(inResponseTo, relayState, callback) {
        debug('getLogoutResponseUrl');
        const instance = this;
        if (!instance.identityProvider.sso_logout_url) {
            return callback(makeError('The SAML configuration (identityProvider) does not contain an sso_logout_url.', 500));
        }
        this.serviceProvider.create_logout_response_url(
            instance.identityProvider,
            { in_response_to: inResponseTo, relay_state: relayState },
            function (err, logoutResponseUrl) {
                if (err) {
                    console.error('create_logout_response_url failed.');
                    console.error(err);
                    return callback(err);
                }
                return callback(null, logoutResponseUrl);
            }
        );
    }

    private assert(req, requestId, callback) {
        debug('assert');
        if (!requestId || typeof (requestId) !== 'string')
            return callback(new Error('assert needs a requestId to verify the SAML assertion.'));

        const options = { request_body: req.body };
        this.serviceProvider.post_assert(this.identityProvider, options, function (err, samlResponse) {
            if (err) {
                error('post_assert failed.');
                return callback(err);
            }

            if (!samlResponse.response_header)
                return callback(new Error('The SAML response does not have a response_header property'));
            if (!samlResponse.response_header.in_response_to)
                return callback(new Error('The SAML response\'s response_header does not have an in_response_to property.'));
            if (samlResponse.response_header.in_response_to != requestId) {
                debug('wrong request ID in SAML response, in_response_to: ' + samlResponse.response_header.in_response_to + ', requestId: ' + requestId);
                return callback(new Error('The SAML assertion does not correspond to expected request ID. Please try again.'));
            }

            debug('samlResponse:');
            debug(JSON.stringify(samlResponse, null, 2));

            // const userInfo = {
            //     authenticated_userid: SamlIdP.findSomeId(samlResponse)
            // };
            callback(null, samlResponse);
        });
    }

    // Currently not used
    /*
    private redirectAssert(req, callback) {
        debug('redirect_assert');
        if (!req.query || !req.query.SAMLRequest)
            return callback(new Error('Request does not contain a SAMLRequest query parameter. Cannot parse.'));
        const options = { request_body: req.query };
        this.serviceProvider.redirect_assert(this.identityProvider, options, function (err, samlRequest) {
            if (err) {
                debug('redirect_assert failed.');
                debug(err);
                return callback(err);
            }

            if (!samlRequest.response_header)
                return callback(new Error('The SAML Request does not have a response_header property'));
            if (!samlRequest.response_header.id)
                return callback(new Error('The SAML Request\'s response_header does not have an id property.'));

            debug('samlResponse:');
            debug(JSON.stringify(samlRequest, null, 2));

            callback(null, samlRequest);
        });
    }
    */

    private static getAttributeNames(samlResponse) {
        const attributeNames = [];
        if (samlResponse.user && samlResponse.user.attributes) {
            for (let attributeName in samlResponse.user.attributes) {
                attributeNames.push(attributeName.toLowerCase());
            }
        }
        return attributeNames;
    }

    private static getAttributeValue(samlResponse, wantedAttribute) {
        let returnValue = null;
        if (samlResponse.user && samlResponse.user.attributes) {
            for (let attributeName in samlResponse.user.attributes) {
                if (attributeName.toLowerCase() == wantedAttribute.toLowerCase()) {
                    const attributeValues = samlResponse.user.attributes[attributeName];
                    if (Array.isArray(attributeValues) && attributeValues.length > 0) {
                        returnValue = attributeValues[0];
                        break;
                    } else if (isString(attributeValues)) {
                        returnValue = attributeValues;
                        break;
                    } else {
                        debug('Found attribute ' + wantedAttribute + ', but it\'s neither an array nor a string.');
                    }
                }
            }
        }
        return returnValue;
    }

    private buildProfile(samlResponse): OidcProfile {
        debug('buildProfile()');

        const samlConfig = this.authMethodConfig;
        const profileConfig = samlConfig.profile;

        const propNames = SamlIdP.getAttributeNames(samlResponse);
        debug('Profile property names:');
        debug(propNames);

        const profileModel = {};
        for (let i = 0; i < propNames.length; ++i) {
            const prop = propNames[i];
            profileModel[prop] = SamlIdP.getAttributeValue(samlResponse, prop);
        }

        let profile = SamlIdP.mapSamlResponseToProfile(profileConfig, profileModel);

        if (!profile.sub) {
            debug('No sub found after mapping user attributes. Trying to find attributes in user object directly')
            profile = SamlIdP.mapSamlResponseToProfile(profileConfig, samlResponse.user)
        }
        if (samlConfig.trustUsers)
            profile.email_verified = true;
        debug('Built profile:');
        debug(profile);

        return profile;
    }

    private static mapSamlResponseToProfile(profileConfig, profileModel): OidcProfile {
        // By checking that there are mappers for "sub" and "email", we can
        // be sure that we can map this to an OidcProfile.
        const profile = {} as OidcProfile;
        for (let propName in profileConfig) {
            const propConfig = profileConfig[propName];
            if (isLiteral(propConfig))
                profile[propName] = propConfig;
            else if (isString(propConfig))
                profile[propName] = mustache.render(propConfig, profileModel);
            else
                warn(`buildProfile: Unknown type for property name ${propName}, expected number, boolean or string (with mustache templates)`);
        }
        return profile;
    }
}

function isString(ob) {
    return (ob instanceof String || typeof ob === "string");
}

function isBoolean(ob) {
    return (typeof ob === 'boolean');
}

function isNumber(ob) {
    return (typeof ob === 'number');
}

function isLiteral(ob) {
    return isBoolean(ob) || isNumber(ob);
}