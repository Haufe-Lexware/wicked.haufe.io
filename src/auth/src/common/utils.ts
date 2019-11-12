'use strict';

const cors = require('cors');
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:utils');
const passwordValidator = require('portal-env').PasswordValidator;
import * as wicked from 'wicked-sdk';
const crypto = require('crypto');
const url = require('url');
const fs = require('fs');
const path = require('path');
const request = require('request');
const qs = require('querystring');

import { failMessage, failError, failOAuth, makeError } from './utils-fail';
import { NameSpec, StringCallback, SimpleCallback, AuthRequest, AuthResponse, AuthSession } from './types';
import { OidcProfile, WickedApi, WickedPool, Callback, WickedUserShortInfo, WickedError, WickedPasswordStrategy, WickedGrant } from 'wicked-sdk';

export const utils = {

    app: null,

    init: function (app) {
        debug('init()');
        utils.app = app;
    },

    getUtc: function () {
        return Math.floor((new Date()).getTime() / 1000);
    },

    createRandomId: function () {
        return crypto.randomBytes(20).toString('hex');
    },

    clone: function (o): object {
        // Ahem.
        return JSON.parse(JSON.stringify(o));
    },

    jsonError: function (res, message: string, status: number): void {
        debug('Error ' + status + ': ' + message);
        res.status(status).json({ message: message });
    },

    getJson: function (ob): any {
        if (typeof ob === "string")
            return JSON.parse(ob);
        return ob;
    },

    getText: function (ob: any) {
        if (ob instanceof String || typeof ob === "string")
            return ob;
        return JSON.stringify(ob, null, 2);
    },

    delay: async function (ms) {
        return new Promise(function (resolve) {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    },

    // https://stackoverflow.com/questions/263965/how-can-i-convert-a-string-to-boolean-in-javascript
    parseBool: function (str: any): boolean {
        debug(`parseBool(${str})`);
        if (str == null)
            return false;

        if (typeof (str) === 'boolean')
            return (str === true);

        if (typeof (str) === 'string') {
            if (str == "")
                return false;

            str = str.replace(/^\s+|\s+$/g, '');
            if (str.toLowerCase() == 'true' || str.toLowerCase() == 'yes')
                return true;

            str = str.replace(/,/g, '.');
            str = str.replace(/^\s*\-\s*/g, '-');
        }

        if (!isNaN(str))
            return (parseFloat(str) != 0);

        return false;
    },

    isPublic: function (uriName: string): boolean {
        return uriName.endsWith('jpg') ||
            uriName.endsWith('jpeg') ||
            uriName.endsWith('png') ||
            uriName.endsWith('gif') ||
            uriName.endsWith('css');
    },

    pipe: function (req, res, uri: string): void {
        let apiUrl = wicked.getInternalApiUrl();
        if (!apiUrl.endsWith('/'))
            apiUrl += '/';
        apiUrl += uri;
        request.get({
            url: apiUrl,
            headers: { 'X-Authenticated-Scope': 'read_content' }
        }).pipe(res);
    },

    getExternalUrl: function (): string {
        debug(`getExternalUrl()`);
        return utils.app.get('external_url');
    },

    splitName: function (fullName: string, username: string): NameSpec {
        debug('splitName(): fullName = ' + fullName + ', username = ' + username);
        var name = {
            firstName: '',
            lastName: fullName,
            fullName: fullName
        };
        if (!fullName) {
            if (username) {
                name.lastName = '';
                name.fullName = username;
            } else {
                name.lastName = '';
                name.fullName = 'Unknown';
            }
        } else {
            var spaceIndex = fullName.indexOf(' ');
            if (spaceIndex < 0)
                return name;
            name.firstName = fullName.substring(0, spaceIndex);
            name.lastName = fullName.substring(spaceIndex + 1);
        }
        debug(name);
        return name;
    },

    makeFullName: function (familyName, givenName): string {
        if (familyName && givenName)
            return givenName + ' ' + familyName;
        if (familyName)
            return familyName;
        if (givenName)
            return givenName;
        return 'Unknown Username';
    },

    makeUsername: function (fullName, username): string {
        debug('makeUsername(): fullName = ' + fullName + ', username = ' + username);
        if (username)
            return username;
        return fullName;
    },

    normalizeRedirectUri(s: string): string {
        let tmp = s;
        if (tmp.endsWith('/'))
            tmp = tmp.substring(0, s.length - 1);
        if (tmp.indexOf('?') >= 0)
            tmp = tmp.substring(0, tmp.indexOf('?'));
        return tmp;
    },

    cors: function () {
        const optionsDelegate = (req, callback) => {
            const origin = req.header('Origin');
            debug('in CORS options delegate. req.headers = ');
            debug(req.headers);
            if (isCorsHostValid(origin))
                callback(null, _allowOptions); // Mirror origin, it's okay
            else
                callback(null, _denyOptions);
        };
        return cors(optionsDelegate);
    },

    _packageVersion: "",
    getVersion: function () {
        if (!utils._packageVersion) {
            const packageFile = path.join(__dirname, '..', '..', 'package.json');
            if (fs.existsSync(packageFile)) {
                try {
                    const packageInfo = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                    if (packageInfo.version)
                        utils._packageVersion = packageInfo.version;
                } catch (ex) {
                    error(ex);
                }
            }
            if (!utils._packageVersion) // something went wrong
                utils._packageVersion = "0.0.0";
        }
        return utils._packageVersion;
    },

    _apiInfoMap: {} as { [apiId: string]: { success: boolean, data?: WickedApi } },

    getApiInfo: function (apiId: string, callback: Callback<WickedApi>): void {
        debug(`getApiInfo(${apiId})`);
        if (utils._apiInfoMap[apiId] && utils._apiInfoMap[apiId].success)
            return callback(null, utils._apiInfoMap[apiId].data);
        wicked.getApi(apiId, (err, apiInfo) => {
            if (err) {
                utils._apiInfoMap[apiId] = {
                    success: false
                };
                return callback(err);
            }
            utils._apiInfoMap[apiId] = {
                data: apiInfo,
                success: true
            };
            return callback(null, apiInfo);
        });
    },

    getApiInfoAsync: async function (apiId: string) {
        debug(`getApiInfo(${apiId})`);
        if (utils._apiInfoMap[apiId] && utils._apiInfoMap[apiId].success)
            return utils._apiInfoMap[apiId].data;
        try {
            const apiInfo = await wicked.getApi(apiId) as WickedApi
            utils._apiInfoMap[apiId] = {
                data: apiInfo,
                success: true
            };
            return apiInfo;
        } catch (err) {
            utils._apiInfoMap[apiId] = {
                success: false
            };
            throw (err);
        }
    },

    getApiRegistrationPoolAsync: async (apiId: string): Promise<string> => {
        debug(`getApiRegistrationPoolAsync(${apiId})`);
        const apiInfo = await utils.getApiInfoAsync(apiId);
        let poolId = apiInfo.registrationPool;
        if (!poolId)
            debug(`API ${apiId} does not have a registration pool setting`);
        // Yes, poolId can be null or undefined here
        return poolId;
    },

    getApiRegistrationPool: function (apiId: string, callback: StringCallback) {
        debug(`getApiRegistrationPool(${apiId})`);
        (async () => {
            try {
                const poolId = await this.getApiRegistrationPoolAsync(apiId);
                return callback(null, poolId);
            } catch (err) {
                return callback(err);
            }
        })();
    },

    _poolInfoMap: {} as { [poolId: string]: { success: boolean, data?: WickedPool } },

    getPoolInfo: function (poolId: string, callback: Callback<WickedPool>): void {
        const instance = this;
        (async () => {
            try {
                const poolInfo = await instance.getPoolInfoAsync(poolId);
                return callback(null, poolInfo);
            } catch (err) {
                return callback(err);
            }
        })();
    },

    getPoolInfoAsync: async function (poolId: string): Promise<WickedPool> {
        debug(`getPoolInfo(${poolId})`);
        if (utils._poolInfoMap[poolId] && utils._poolInfoMap[poolId].success)
            return utils._poolInfoMap[poolId].data;
        try {
            const poolInfo = await wicked.getRegistrationPool(poolId);
            utils._poolInfoMap[poolId] = {
                data: poolInfo,
                success: true
            };
            return poolInfo;
        } catch (err) {
            utils._poolInfoMap[poolId] = {
                success: false
            };
            throw err;
        }
    },

    getPoolInfoByApi: function (apiId: string, callback: Callback<WickedPool>) {
        debug(`getPoolInfoByApi(${apiId})`);
        utils.getApiRegistrationPool(apiId, (err, poolId) => {
            if (err)
                return callback(err);
            if (!poolId)
                return callback(makeError(`API ${apiId} does not have a registration pool`, 500));
            utils.getPoolInfo(poolId, callback);
        });
    },

    verifyRecaptcha: function (req, callback) {
        if (req.app.glob.recaptcha && req.app.glob.recaptcha.useRecaptcha) {
            var secretKey = req.app.glob.recaptcha.secretKey;
            var recaptchaResponse = req.body['g-recaptcha-response'];
            request.post({
                url: 'https://www.google.com/recaptcha/api/siteverify',
                formData: {
                    secret: secretKey,
                    response: recaptchaResponse
                }
            }, function (err, apiResponse, apiBody) {
                if (err)
                    return callback(err);
                var recaptchaBody = utils.getJson(apiBody);
                if (!recaptchaBody.success) {
                    return failMessage(401, 'ReCAPTCHA response invalid - Please try again', callback);
                }

                callback(null);
            });
        } else {
            callback(null);
        }
    },

    createVerificationRequest: function (trustUsers: boolean, authMethodId: string, email: string, callback: SimpleCallback) {
        debug(`createVerificationRequest(${authMethodId}, ${email})`);

        if (trustUsers) {
            debug('not creating verification requests, users are implicitly trusted');
            return callback(null);
        }

        // Assemble the link to the verification page:
        // const globals = wicked.getGlobals();
        const authUrl = utils.getExternalUrl();
        const verificationLink = `${authUrl}/${authMethodId}/verify/{{id}}`;

        // Now we need to create a verification request with the wicked API (as the machine user)
        const verifBody = {
            type: 'email',
            email: email,
            link: verificationLink
        };
        wicked.apiPost('/verifications', verifBody, null, callback);
    },

    createViewModel: function (req, authMethodId: string, csrfSource?: string): any {
        if (!csrfSource)
            csrfSource = 'generic';
        const csrfToken = `${csrfSource}-${utils.createRandomId()}`;
        req.session.csrfToken = csrfToken;
        return {
            title: req.app.glob.title,
            portalUrl: wicked.getExternalPortalUrl(),
            baseUrl: req.app.get('base_path'),
            csrfToken: csrfToken,
            loginUrl: `${authMethodId}/login`,
            logoutUrl: `logout`,
            signupUrl: `${authMethodId}/signup`,
            registerUrl: `${authMethodId}/register`,
            forgotPasswordUrl: `${authMethodId}/forgotpassword`,
            verifyEmailUrl: `${authMethodId}/verifyemail`,
            verifyPostUrl: `${authMethodId}/verify`,
            emailMissingUrl: `${authMethodId}/emailmissing`,
            grantUrl: `${authMethodId}/grant`,
            manageGrantsUrl: `${authMethodId}/grants`,
            selectNamespaceUrl: `${authMethodId}/selectnamespace`,
            recaptcha: req.app.glob.recaptcha,
            changePasswordUrl: `${authMethodId}/changepassword`
        };
    },

    getAndDeleteCsrfToken: function (req, csrfSource?: string): string {
        debug('getAndDeleteCsrfToken()');
        if (!csrfSource)
            csrfSource = 'generic';
        const csrfToken = req.session.csrfToken;
        delete req.session.csrfToken;
        if (!csrfToken || !csrfToken.startsWith(csrfSource)) {
            error(`getAndDeleteCsrfToken: Either no CSRF token is present, or the source mismatches: ${csrfToken} (source ${csrfSource})`)
            return "<invalid csrf source or csrf not present>";
        }
        return csrfToken;
    },

    hasSession(req, authMethodId: string): boolean {
        return req.session && req.session[authMethodId];
    },

    getSession(req, authMethodId: string): AuthSession {
        if (!req.session || !req.session[authMethodId])
            throw new WickedError('Invalid session state, not using a browser?', 400);
        return req.session[authMethodId];
    },

    deleteSession(req, authMethodId): void {
        debug(`deleteSession(${authMethodId})`);
        if (!req.session || !req.session[authMethodId])
            return;
        delete req.session[authMethodId];
    },

    hasAuthRequest: function (req, authMethodId: string): boolean {
        return (req.session && req.session[authMethodId] && req.session[authMethodId].authRequest);
    },

    getAuthRequest: function (req, authMethodId: string): AuthRequest {
        if (!req.session || !req.session[authMethodId])
            throw new WickedError('Invalid session state, not using a browser?', 400);
        return req.session[authMethodId].authRequest;
    },

    setAuthRequest: function (req, authMethodId: string, authRequest: AuthRequest): void {
        if (!req.session || !req.session[authMethodId])
            throw new WickedError('Invalid session state, not using a browser?', 400);
        req.session[authMethodId].authRequest = authRequest;
    },

    getAuthResponse: function (req, authMethodId: string): AuthResponse {
        if (!req.session || !req.session[authMethodId])
            throw new WickedError('Invalid session state, not using a browser?', 400);
        return req.session[authMethodId].authResponse;
    },

    setAuthResponse: function (req, authMethodId: string, authResponse: AuthResponse): void {
        if (!req.session || !req.session[authMethodId])
            throw new WickedError('Invalid session state, not using a browser?', 400);
        req.session[authMethodId].authResponse = authResponse;
    },

    /**
     * Checks for a user by custom ID.
     * 
     * @param {*} customId custom ID to check a user for; if there is a user
     * with this custom ID in the wicked database, the user will already have
     * an email address, and thus the IdP would not have to ask for one, in
     * case it doesn't provide one (e.g. Twitter).
     */
    getUserByCustomId: async function (customId: string): Promise<WickedUserShortInfo> {
        debug(`getUserByCustomId(${customId})`);
        try {
            const shortInfoList = await wicked.getUserByCustomId(customId);
            // Now we should have the user ID here:
            if (!Array.isArray(shortInfoList) || shortInfoList.length <= 0 || !shortInfoList[0].id)
                throw new Error('getUserByCustomId: Get user short info by email did not return a user id');
            return shortInfoList[0];
        } catch (err) {
            if (err.statusCode == 404) {
                // Not found
                return null;
            }
            // Unexpected error
            throw err;
        }
    },

    /**
     * Returns `true` if the user has an established session with the given `authMethodId`. The function
     * also checks whether the user has a "profile, which is required if the user is truly logged in.
     * 
     * @param {*} req The incoming request
     * @param {*} authMethodId The auth method id this request applies to
     */
    isLoggedIn: function (req, authMethodId: string): boolean {
        let isLoggedIn = false;
        if (req.session &&
            req.session[authMethodId] &&
            req.session[authMethodId].authResponse &&
            req.session[authMethodId].authResponse.profile)
            isLoggedIn = true;
        debug(`isLoggedIn(${authMethodId}): ${isLoggedIn}`);
        return isLoggedIn;
    },

    /**
     * Returns the associated user OIDC profile if the user is logged in; otherwise an Error is thrown.
     * 
     * @param {*} req 
     * @param {*} authMethodId 
     */
    getProfile: function (req, authMethodId: string): OidcProfile {
        if (!utils.isLoggedIn(req, authMethodId))
            throw new Error('Cannot get profile if not logged in');
        return utils.getAuthResponse(req, authMethodId).profile;
    },

    /**
     * Makes sure a user is logged in, and then redirects back to the original URL as per
     * the given req object.
     */
    loginAndRedirectBack: function (req, res, authMethodId: string): void {
        const thisUri = req.originalUrl;
        const redirectUri = `${req.app.get('base_path')}/${authMethodId}/login?redirect_uri=${qs.escape(thisUri)}`;
        return res.redirect(redirectUri);
    },

    decodeBase64: function (s) {
        const decoded = Buffer.from(s, 'base64').toString();
        // Verify it's really a base64 string
        const encoded = Buffer.from(decoded).toString('base64');
        if (s !== encoded)
            throw new Error('Input string is not a valid base64 encoded string');
        return decoded;
    },

    render(req, res, template: string, viewModel, authRequest?: AuthRequest): void {
        if (process.env.ALLOW_RENDER_JSON) {
            const accept = req.get('accept');
            if (accept && accept.toLowerCase() === 'application/json') {
                viewModel.would_be_html = true;
                viewModel.template = template;
                return res.json(viewModel);
            }
        }

        viewModel.app_name = viewModel.title;
        if (authRequest) {
            if (authRequest.app_name && authRequest.app_id && authRequest.app_id !== '__portal')
                viewModel.app_name = authRequest.app_name;
            if (authRequest.app_url)
                viewModel.portalUrl = authRequest.app_url;
        }
        viewModel.i18n = getI18n(req, template);
        debug(viewModel);
        res.render(template, viewModel);
    },

    getUserGrantAsync: async function (userId: string, applicationId: string, apiId): Promise<WickedGrant> {
        try {
            const userGrant = await wicked.getUserGrant(userId, applicationId, apiId);
            return userGrant;
        } catch (err) {
            if (err.status === 404 || err.statusCode === 404) {
                return {
                    grants: []
                };
            }
            throw err;
        }
    },

    _gitLastCommit: null,
    getGitLastCommit() {
        if (!utils._gitLastCommit) {
            const lastCommitFile = path.join(__dirname, '..', '..', 'git_last_commit');
            if (fs.existsSync(lastCommitFile))
                utils._gitLastCommit = fs.readFileSync(lastCommitFile, 'utf8');
            else
                utils._gitLastCommit = '(no last git commit found - running locally?)';
        }
        return utils._gitLastCommit;
    },

    _gitBranch: null,
    getGitBranch() {
        if (!utils._gitBranch) {
            const gitBranchFile = path.join(__dirname, '..', '..', 'git_branch');
            if (fs.existsSync(gitBranchFile))
                utils._gitBranch = fs.readFileSync(gitBranchFile, 'utf8');
            else
                utils._gitBranch = '(unknown)';
        }
        return utils._gitBranch;
    },

    _buildDate: null,
    getBuildDate() {
        if (!utils._buildDate) {
            const buildDateFile = path.join(__dirname, '..', '..', 'build_date');
            if (fs.existsSync(buildDateFile))
                utils._buildDate = fs.readFileSync(buildDateFile, 'utf8');
            else
                utils._buildDate = '(unknown build date)';
        }
        return utils._buildDate;
    }
};

let _globalI18n = {};
function loadGlobalI18n(desiredLanguage) {
    if (_globalI18n[desiredLanguage])
        return _globalI18n[desiredLanguage];
    const fileName = path.join(__dirname, '..', 'views', `password_validation.${desiredLanguage}.json`);
    const strategyName = wicked.getPasswordStrategy();
    const passwordStrategy = passwordValidator.getStrategy(strategyName) as WickedPasswordStrategy;
    const i18n = JSON.parse(fs.readFileSync(fileName));

    const translations = {
        password_rules: i18n[strategyName],
        password_regex: passwordStrategy.regex
    };
    _globalI18n[desiredLanguage] = translations;
    return translations;
}

function mergeGlobalI18n(i18n, desiredLanguage) {
    const globalI18n = loadGlobalI18n(desiredLanguage);
    for (let k in globalI18n)
        i18n[k] = globalI18n[k];
}

const _i18nMap = new Map<string, object>();
function getI18n(req, template: string): object {
    debug(`getI18n(${template})`);

    let desiredLanguage = req.acceptsLanguages('en', 'de');
    if (!desiredLanguage)
        desiredLanguage = 'en';
    const key = `${template}:${desiredLanguage}`;

    if (_i18nMap.has(key))
        return _i18nMap.get(key);
    let i18nFile = path.join(__dirname, '..', 'views', `${template}.${desiredLanguage}.json`);
    if (!fs.existsSync(i18nFile))
        i18nFile = path.join(__dirname, '..', 'views', `${template}.en.json`);
    if (!fs.existsSync(i18nFile)) {
        debug(`getI18n(): No translation file found for template ${template}.`);
        _i18nMap.set(key, {});
        return {}
    }
    const i18n = JSON.parse(fs.readFileSync(i18nFile, 'utf8'));
    mergeGlobalI18n(i18n, desiredLanguage);
    console.log(`Template: ${template}`);
    console.log(i18n);
    _i18nMap.set(key, i18n);
    return i18n;
}

// ==============================
// HELPER METHODS
// ==============================

const _validCorsHosts = {};
function storeRedirectUriForCors(uri) {
    debug('storeRedirectUriForCors() ' + uri);
    try {
        const parsedUri = url.parse(uri);
        const host = parsedUri.protocol + '//' + parsedUri.host;
        _validCorsHosts[host] = true;
        debug(_validCorsHosts);
    } catch (ex) {
        error('storeRedirectUriForCors() - Invalid URI: ' + uri);
    }
}

function isCorsHostValid(host) {
    debug('isCorsHostValid(): ' + host);
    if (_validCorsHosts[host]) {
        debug('Yes, ' + host + ' is valid.');
        return true;
    }
    debug('*** ' + host + ' is not a valid CORS origin.');
    return false;
}

const _allowOptions = {
    origin: true,
    credentials: true,
    allowedHeaders: [
        'Accept',
        'Accept-Encoding',
        'Connection',
        'User-Agent',
        'Content-Type',
        'Cookie',
        'Host',
        'Origin',
        'Referer'
    ]
};

const _denyOptions = {
    origin: false
};


// module.exports = utils;
