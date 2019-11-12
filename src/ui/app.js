'use strict';

/* global app, __dirname */

const express = require('express');
const { debug, info, warn, error } = require('portal-env').Logger('portal:app');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const index = require('./routes/index');
const apis = require('./routes/apis');
const applications = require('./routes/applications');
const content = require('./routes/content');
const users = require('./routes/users');
const admin = require('./routes/admin');
const swaggerUi = require('./routes/swaggerUi');
const ping = require('./routes/ping');
const help = require('./routes/help');
const kill = require('./routes/kill');
const utils = require('./routes/utils');
const portalGlobals = require('./portalGlobals');
const wicked = require('wicked-sdk');
const correlationIdHandler = wicked.correlationIdHandler();

const fs = require('fs');
const session = require('express-session');

const app = express(); // jshint ignore:line
app.initialized = false;
app.initState = 'Starting up...';
app.isProduction = true;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Correlation ID
app.use(correlationIdHandler);

// Configure logger; log in JSON format.
logger.token('user-id', function (req, res) {
    const userId = utils.getLoggedInUserId(req);
    return userId ? userId : '-';
});
logger.token('user-email', function (req, res) {
    const email = utils.getLoggedInUserEmail(req);
    return email ? email : '-';
});
logger.token('correlation-id', function (req, res) {
    return req.correlationId;
});

app.use(logger('{"date":":date[clf]","method":":method","url":":url","remote-addr":":remote-addr","user-id":":user-id","user-email":":user-email","version":":http-version","status":":status","content-length":":res[content-length]","referrer":":referrer","user-agent":":user-agent","response-time":":response-time","correlation-id":":correlation-id"}'));

// We want to serve static content and "ping" without using a session.
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/assets/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/assets/jsgrid', express.static(path.join(__dirname, 'node_modules/jsgrid/dist')));
app.use('/assets/highlight', express.static(path.join(__dirname, 'node_modules/highlight.js/lib')));
app.use('/assets/highlight/css', express.static(path.join(__dirname, 'node_modules/highlight.js/styles')));
app.use('/assets/marked', express.static(path.join(__dirname, 'node_modules/marked')));

// Initializing state
app.use('/ping', ping);
app.use(function (req, res, next) {
    if (app.initialized)
        return next();
    res.status(503).render('ready_in_a_second', { state: app.initState });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// This will be called as soon as the globals are present.
// Some settings rely on things we read from the globals.json,
// which needs to be served by the API first. This is why the
// the rest of the initialization is deferred like this.
app.initialize = function (done) {
    debug('initialize()');

    // The session type is configured via the globals.json sessionStore property,
    // This is why this has to go in here instead of in the above initialization.
    const sessionStore = require('./sessionstore')(app.portalGlobals, session);
    const SECRET = 'ThisIsASecret';

    // Session: 45 minutes
    const sessionArgs = {
        name: 'portal.cookie.sid',
        store: sessionStore,
        secret: SECRET,
        saveUninitialized: true,
        resave: false,
        cookie: {
            maxAge: 45 * 60 * 1000
        }
    };

    if (!wicked.isDevelopmentMode()) {
        app.isProduction = true;
        app.set('trust proxy', 1);
        sessionArgs.cookie.secure = true;
    } else {
        warn('*************************************');
        warn('*************************************');
        warn('PORTAL IS RUNNING IN DEVELOPMENT MODE');
        warn('If you see this in your production');
        warn('logs, you have done something wrong.');
        warn('*************************************');
        warn('*************************************');
        app.isProduction = false;
    }

    app.portalGlobals.isProduction = app.isProduction;
    // Once for the really static content
    app.use('/content', content);

    app.use(cookieParser(SECRET));
    app.use(session(sessionArgs));
    // Session checker middleware
    app.use(function (req, res, next) {
        if (!req.session) {
            const err = new Error('Session not found (redis not available?)');
            err.status = 500;
            return next(err);
        }
        if (req.session && req.session.user && req.session.user.profile) {
            debug(req.user);
            req.user = req.session.user.profile;
        }
        next(); // otherwise continue
    });
    app.disable('x-powered-by'); // Remove powered by Express

    // "production" mode sanity checking. If we're on "production" mode,
    // we will have set (see above) cookie.secure to true, and thus cookies
    // will not be sent to the backend in case the protocol in the front end
    // is not https. This will result in super strange behaviour, like not
    // being able to log in, and creating new sessions for each http request.
    app.use(function (req, res, next) {
        if (app.isProduction &&
            !req.path.startsWith('/swagger-ui') &&
            req.get('x-forwarded-proto') != 'https')
            if (portalGlobals.glob.network.forceRedirectToHttps === true)
                return res.redirect(301, 'https://' + req.headers.host + req.url);
            else
                return next(new Error(`Configuration error: The environment configuration (API NODE_ENV "${portalGlobals.glob.environment}") is configured to run on https, but this is not the case. If you intend to work in development mode, make sure that network.schema equals "http" in globals.json for this environment. Otherwise make sure that this page is served via https. You can also use the network.forceRedirectToHttps option for this (in globals.json).`));
        next();
    });

    app.use(function (req, res, next) {
        const hostHeader = req.get('Host');
        const network = app.portalGlobals.network;
        let correctHost = network.portalHost;
        if (req.path.startsWith('/swagger-ui'))
            correctHost = network.apiHost;
        if (correctHost !== hostHeader) {
            debug('Host header: ' + hostHeader + ' -- MISMATCH, redirecting to ' + correctHost);
            return res.redirect(`${network.schema}://${correctHost}${req.url}`);
        }
        return next();
    });

    app.get('/', index);
    app.use('/apis', apis);
    app.use('/applications', applications);

    app.get('/contact', function (req, res, next) { res.redirect('/content/contact'); });
    app.use('/content', content);
    app.use('/users', users);
    app.use('/admin', admin);
    app.use('/swagger-ui', swaggerUi);
    app.use('/swagger-ui', express.static(path.join(__dirname, 'node_modules/swagger-ui-dist')));

    app.use('/help', help);
    app.use('/kill', kill);

    // Late loading as it requires things from portalGlobals!
    const login = require('./routes/login');
    app.use('/login', login);
    app.use('/signup', function (req, res, next) { res.redirect('/login'); });

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        const err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // error handlers

    // production error handler
    app.use(function (err, req, res, next) {
        // 403 and not logged in? And not an API/JSON user?
        if (err.status &&
            (403 === err.status || 403 === err.statusCode) &&
            !utils.getLoggedInUserId(req) &&
            !utils.acceptJson(req)) {
            res.redirect('/login?redirect=' + encodeURIComponent(req.url));
        } else {
            error(err);
            const status = err.status || 500;
            // Will print stacktrace if in development mode
            const displayError = wicked.isDevelopmentMode() ? err : { status: status };
            res.status(status);
            if (!utils.acceptJson(req)) {
                let errorTemplate = 'error'; // default error template

                switch (status) {
                    case 403: errorTemplate = 'error_403'; break;
                    case 404: errorTemplate = 'error_404'; break;
                    case 428: errorTemplate = 'error_428'; break;
                }

                res.render(errorTemplate, {
                    authUser: req.user,
                    title: 'Error',
                    glob: app.portalGlobals,
                    message: err.message,
                    error: displayError,
                    correlationId: req.correlationId
                });
            } else {
                res.json({
                    statusCode: res.statusCode,
                    message: err.message,
                    error: displayError,
                    correlationId: req.correlationId
                });
            }
        }
    });
    if (done)
        done();
};

module.exports = app;
