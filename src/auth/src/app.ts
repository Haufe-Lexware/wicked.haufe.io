'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:app');
const prometheusMiddleware = require('portal-env').PrometheusMiddleware;
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('morgan');
import * as wicked from 'wicked-sdk';
import * as nocache from 'nocache';
const passport = require('passport');

const session = require('express-session');
// const FileStore = require('session-file-store')(session);
import { redisConnection } from './common/redis-connection';

import { LocalIdP } from './providers/local';
import { DummyIdP } from './providers/dummy';
import { GithubIdP } from './providers/github';
import { GoogleIdP } from './providers/google';
import { TwitterIdP } from './providers/twitter';
import { OAuth2IdP } from './providers/oauth2';
// import { FacebookIdP } from './providers/facebook';
import { SamlIdP } from './providers/saml';
import { ExternalIdP } from './providers/external';
import { LdapIdP } from './providers/ldap';

import { StatusError } from './common/utils-fail';
import { SimpleCallback } from './common/types';
import { WickedAuthServer } from 'wicked-sdk';

import { utils } from './common/utils';
import { utilsOAuth2 } from './common/utils-oauth2';

// Use default options, see https://www.npmjs.com/package/session-file-store
const sessionStoreOptions = {};

const SECRET = 'ThisIsASecret';

let sessionMinutes = 60;
if (process.env.AUTH_SERVER_SESSION_MINUTES) {
    info('Using session duration specified in env var AUTH_SERVER_SESSION_MINUTES.');
    sessionMinutes = Number(process.env.AUTH_SERVER_SESSION_MINUTES);
}
debug('Session duration: ' + sessionMinutes + ' minutes.');

export const app: any = express();

function rejectFromKong(req, res, next) {
    const via = req.get('via');
    if (via && via.toLowerCase().indexOf('kong') > 0) {
        res.status(403).json({ code: 403, message: 'Not allowed from outside network.' });
        return;
    }
    return next();
}

app.initApp = function (authServerConfig: WickedAuthServer, callback: SimpleCallback) {
    // Store auth Config with application
    app.authConfig = authServerConfig;
    app.initialized = true;

    if (!wicked.isDevelopmentMode()) {
        app.set('trust proxy', 1);
        // TODO: This is not deal-breaking, as we're in a quite secure surrounding anyway,
        // but currently Kong sends 'X-Forwarded-Proto: http', which is plain wrong. And that
        // prevents the securing of the cookies. We know it's okay right now, so we do it
        // anyway - the Auth Server is SSL terminated at HAproxy, and the rest is http but
        // in the internal network of Docker.

        //sessionArgs.cookie.secure = true;
        info("Running in PRODUCTION MODE.");
    } else {
        warn("=============================");
        warn(" Running in DEVELOPMENT MODE");
        warn("=============================");
        warn("If you see this in your production logs, you're doing something wrong.");
    }

    const basePath = app.get('base_path');

    app._startupSeconds = utils.getUtc();

    app.use(prometheusMiddleware.middleware('wicked_auth'));

    function answerPing(req, res, next) {
        debug('/ping');
        const health = {
            name: 'auth',
            message: 'Up and running',
            uptime: (utils.getUtc() - app._startupSeconds),
            healthy: 1,
            pingUrl: '/ping',
            version: utils.getVersion(),
            error: null,
            gitLastCommit: utils.getGitLastCommit(),
            gitBranch: utils.getGitBranch(),
            buildDate: utils.getBuildDate()
        };
        if (!app.initialized) {
            health.healthy = 2;
            health.message = 'Initializing - Waiting for API';
            res.status(503);
        } else if (app.lastErr) {
            health.healthy = 0;
            health.message = app.lastErr.message;
            health.error = JSON.stringify(app.lastErr, null, 2);
            res.status(500);
        }
        res.json(health);
    }

    app.use(basePath + '/bootstrap', express.static(path.join(__dirname, 'assets/bootstrap/dist')));
    app.use(basePath + '/jquery', express.static(path.join(__dirname, 'assets/jquery/dist')));

    const serveStaticContent = express.Router();
    serveStaticContent.get('/*', function (req, res, next) {
        debug('serveStaticContent ' + req.path);
        if (utils.isPublic(req.path)) {
            return utils.pipe(req, res, 'content' + req.path);
        }
        res.status(404).json({ message: 'Not found.' });
    });
    app.use(basePath + '/content', serveStaticContent);

    app.use(wicked.correlationIdHandler());

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');

    logger.token('correlation-id', function (req, res) {
        return req.correlationId;
    });
    app.use(logger('{"date":":date[clf]","method":":method","url":":url","remote-addr":":remote-addr","version":":http-version","status":":status","content-length":":res[content-length]","referrer":":referrer","response-time":":response-time","correlation-id":":correlation-id"}'));

    app.get('/metrics', rejectFromKong, prometheusMiddleware.metrics);

    app.get('/ping', answerPing);
    app.get(basePath + '/ping', answerPing);

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    // Set up the cookie parser
    app.use(cookieParser(SECRET));
    // Specify the session arguments. Used for configuring the session component.
    var sessionArgs = {
        name: 'portal-auth.cookie.sid',
        store: redisConnection.createSessionStore(session),
        secret: SECRET,
        saveUninitialized: true,
        resave: false,
        cookie: {
            maxAge: sessionMinutes * 60 * 1000
        }
    };

    // And session management
    app.use(session(sessionArgs));
    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // =======================
    // Actual implementation
    // =======================

    app.idpMap = {};

    // Here: Read from Auth Methods configuration in default.json
    for (let i = 0; i < authServerConfig.authMethods.length; ++i) {
        const authMethod = authServerConfig.authMethods[i];
        const authUri = `${basePath}/${authMethod.name}`;
        let enabled = true;
        if (authMethod.hasOwnProperty("enabled"))
            enabled = utils.parseBool(authMethod.enabled);
        if (!enabled) {
            info(`Skipping disabled auth method ${authMethod.name}.`);
            continue;
        }
        const options = {
            externalUrlBase: app.get('external_url'),
            basePath: app.get('base_path')
        };
        info(`Activating auth method ${authMethod.name} with type ${authMethod.type}, at ${authUri}.`);
        let idp = null;
        switch (authMethod.type) {
            case "local":
                idp = new LocalIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "external":
                idp = new ExternalIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "dummy":
                idp = new DummyIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "github":
                idp = new GithubIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "google":
                idp = new GoogleIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "twitter":
                idp = new TwitterIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "oauth2":
                idp = new OAuth2IdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "adfs":
                idp = new OAuth2IdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "saml":
                idp = new SamlIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            case "ldap":
                idp = new LdapIdP(basePath, authMethod.name, authMethod.config, options);
                break;
            default:
                error('ERROR: Unknown authMethod type ' + authMethod.type);
                break;
        }
        if (idp) {
            app.idpMap[authMethod.name] = idp;
            app.use(authUri, idp.getRouter());
        }
    }

    app.get(basePath + '/profile', nocache(), utilsOAuth2.getProfile);
    app.get(basePath + '/userinfo', nocache(), utilsOAuth2.getProfile);
    app.post(basePath + '/userinfo', nocache(), utilsOAuth2.getProfile);

    app.get(basePath + '/logout', nocache(), function (req, res, next) {
        debug(basePath + '/logout');

        const redirect_uri = req.query && req.query.redirect_uri ? req.query.redirect_uri : null;
        // Iterate over the IdPs and see if they need to do a logout hook
        for (let authMethodId in app.idpMap) {
            const idp = app.idpMap[authMethodId];
            if (idp.logoutHook) {
                const hasHandledRequest = idp.logoutHook(req, res, next, redirect_uri);
                if (!hasHandledRequest) {
                    // Then just delete the session data for this auth Method
                    utils.deleteSession(req, authMethodId);
                } else {
                    // One IDP has taken over; let's quit here. The IdP must make
                    // sure that this end point is called again after it is done
                    // with whatever it does when logging out. Plus it must delete
                    // its own session state. The reason why it's not done here yet
                    // is that the IdP may need the session data to be able to correctly
                    // log the user out (e.g. user_id and session_index for SAML).
                    debug(`IdP ${authMethodId} has taken over, quitting /logout`);
                    return;
                }
            }
        }

        // Successfully logged out.
        info('Successfully logged a user out.');
        req.session.destroy();

        if (redirect_uri)
            return res.redirect(req.query.redirect_uri);
        utils.render(req, res, 'logout', {
            title: 'Logged out',
            portalUrl: wicked.getExternalPortalUrl(),
            baseUrl: req.app.get('base_path'),
            correlationId: req.correlationId,
        });
    });

    app.get(basePath + '/failure', nocache(), function (req, res, next) {
        debug(basePath + '/failure');

        let redirectUri = null;
        if (req.session && req.session.redirectUri)
            redirectUri = req.session.redirectUri;

        utils.render(req, res, 'failure', {
            title: 'Failure',
            portalUrl: wicked.getExternalPortalUrl(),
            baseUrl: req.app.get('base_path'),
            correlationId: req.correlationId,
            returnUrl: redirectUri
        });
    });

    // =======================

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        const err = new StatusError(404, 'Not Found');
        next(err);
    });

    // production error handler
    // no stacktraces leaked to user
    app.use(function (err, req, res, next) {
        if (err.status !== 404) {
            error(err);
        }
        if (err.status === 302) {
            // Issue as redirect
            res.redirect(`${err.redirectUri}?error=${err.oauthError}&error_description=${err.message}`);
            return;
        }
        res.status(err.status || 500);
        // From failJson?
        if (err.issueAsJson) {
            res.json({
                status: err.status || 500,
                message: err.message,
                internal_error: err.internalError
            });
        } else if (err.oauthError) {
            // From failOAuth
            // RFC 6749 compatible JSON error
            res.json({
                error: err.oauthError,
                error_description: err.message
            });
        } else {
            utils.render(req, res, 'error', {
                title: 'Error',
                portalUrl: wicked.getExternalPortalUrl(),
                baseUrl: req.app.get('base_path'),
                correlationId: req.correlationId,
                message: err.message,
                status: err.status
            });
        }
    });

    callback(null);
};
