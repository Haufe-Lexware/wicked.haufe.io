'use strict';

import { utils } from './utils';
import { ExpressHandler } from './types';
import { WickedGrant, WickedCollection } from 'wicked-sdk';
import { failMessage, failError } from './utils-fail';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:grant-manager');
const Router = require('express').Router;
import * as wicked from 'wicked-sdk';
import * as async from 'async';

interface ShortInfo {
    id: string,
    name: string
}

interface ExtendedGrant extends WickedGrant {
    // userInfo: WickedUserInfo,
    apiInfo: ShortInfo,
    appInfo: ShortInfo
}

interface ExtendedGrantListCallback {
    (err, extendedGrantList?: ExtendedGrant[]): void
}

enum FlashType {
    Error = "error",
    Warning = "warning",
    Success = "success"
}

interface FlashMessage {
    type: FlashType,
    message: string
}

export class GrantManager {

    private authMethodId: string;
    private router: any;

    constructor(authMethodId: string) {
        debug(`constructor(${authMethodId})`);
        this.authMethodId = authMethodId;

        this.router = new Router();

        this.router.get('/', this.renderUserScopes);
        this.router.post('/', this.revokeUserScope);
    }

    public getRouter() {
        return this.router;
    }

    private renderUserScopes = (req, res, next) => {
        return this.renderUserScopesWithMessage(req, res, next, null);
    }

    private renderUserScopesWithMessage(req, res, next, flashMessage: FlashMessage) {
        debug(`renderUserScopes(${this.authMethodId})`);
        const instance = this;
        // If not logged in, make sure the user logs in, and the redirect back here
        if (!utils.isLoggedIn(req, this.authMethodId))
            return utils.loginAndRedirectBack(req, res, this.authMethodId);

        const authResponse = utils.getAuthResponse(req, this.authMethodId);
        const userId = authResponse.userId;

        debug(`renderUserScopes: Getting user ${userId} grant collection`);
        wicked.getUserGrants(userId, {}, function (err, userGrants) {
            if (err)
                return failError(500, err, next);
            debug(`renderUserScopes: Successfully retrieved user grants.`)

            appendAppAndApiInfo(userGrants, function (err, extendedGrantList) {
                if (err)
                    return failError(500, err, next);

                const viewModel = utils.createViewModel(req, instance.authMethodId, 'user_scopes');
                viewModel.grants = extendedGrantList;
                if (flashMessage)
                    viewModel.flashMessage = flashMessage

                utils.render(req, res, 'scope_list', viewModel);
            });
        });
    }

    private revokeUserScope: ExpressHandler = (req, res, next) => {
        debug(`revokeUserScope(${this.authMethodId})`);
        const instance = this;
        // If not logged in, redirect to this URL, but using GET
        if (!utils.isLoggedIn(req, this.authMethodId))
            return utils.loginAndRedirectBack(req, res, this.authMethodId);

        const body = req.body;
        const csrfToken = body._csrf;
        const expectedCsrfToken = utils.getAndDeleteCsrfToken(req, 'user_scopes');

        if (!csrfToken || csrfToken !== expectedCsrfToken)
            return this.renderUserScopesWithMessage(req, res, next, { type: FlashType.Error, message: 'Suspected login forging detected (CSRF protection).' });

        const authResponse = utils.getAuthResponse(req, this.authMethodId);
        const userId = authResponse.userId;

        const appId = body.revoke_app;
        const apiId = body.revoke_api;

        if (!appId || !apiId)
            return failMessage(400, 'Invalid request, revoke_app and/or revoke_api not defined.', next);

        wicked.apiDelete(`/grants/${userId}/applications/${appId}/apis/${apiId}`, null, function (err) {
            if (err && (err.status === 404 || err.statusCode === 404)) {
                // Not found
                return instance.renderUserScopesWithMessage(req, res, next, { type: FlashType.Warning, message: 'Application grant record not found.' });
            } else if (err) {
                // Some other hard error
                return failError(500, err, next);
            }

            return instance.renderUserScopesWithMessage(req, res, next, { type: FlashType.Success, message: `Access of application "${appId}" to API "${apiId}" was successfully revoked.` });
        });
    }
}

function appendAppAndApiInfo(userGrants: WickedCollection<WickedGrant>, callback: ExtendedGrantListCallback) {
    debug(`appendAppAndApiInfo()`);
    const grantList: ExtendedGrant[] = [];
    async.each(userGrants.items, (userGrant: WickedGrant, callback) => {
        async.parallel({
            appInfo: callback => wicked.getApplication(userGrant.applicationId, function (err, appInfo) {
                if (err)
                    return callback(null, { id: userGrant.applicationId, name: '(Unknown or invalid application)' })
                return callback(null, { id: userGrant.applicationId, name: appInfo.name });
            }),
            apiInfo: callback => utils.getApiInfo(userGrant.apiId, function (err, apiInfo) {
                if (err)
                    return callback(null, { id: userGrant.apiId, name: '(Unknown or invalid API)' });
                return callback(null, { id: userGrant.apiId, name: apiInfo.name });
            })
        }, function (err, results) {
            if (err)
                return failError(500, err, callback);

            const extendedGrant = {
                ...userGrant,
                apiInfo: results.apiInfo as ShortInfo,
                appInfo: results.appInfo as ShortInfo
            };
            grantList.push(extendedGrant);
            return callback(null);
        })
    }, (err) => {
        if (err)
            return failError(500, err, callback);
        return callback(null, grantList);
    });
}