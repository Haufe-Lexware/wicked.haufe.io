'use strict';

const express = require('express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:app');
const correlationIdHandler = require('portal-env').CorrelationIdHandler();
const prometheusMiddleware = require('portal-env').PrometheusMiddleware;
const authMiddleware = require('./auth-middleware');

const healthApi = require('./routes/health');
const users = require('./routes/users');
const applications = require('./routes/applications');
const subscriptions = require('./routes/subscriptions');
const utils = require('./routes/utils');
const apis = require('./routes/apis');
const content = require('./routes/content');
const approvals = require('./routes/approvals');
const webhooks = require('./routes/webhooks');
const verifications = require('./routes/verifications');
const registrations = require('./routes/registrations');
const grants = require('./routes/grants');
const pools = require('./routes/pools');
const systemhealth = require('./routes/systemhealth');
const templates = require('./routes/templates');
const kill = require('./routes/kill');
const authServers = require('./routes/authServers');
const versionizer = require('./routes/versionizer');
const pgUtils = require('./dao/postgres/pg-utils');

const app = express();

// Inject app to various places.
utils.init(app);

app.use(function (req, res, next) {
    if (app.shuttingDown) {
        return res.status(503).json({ message: 'Shutting down. Try again soon.' });
    }
    next();
});
app.use(correlationIdHandler);

// Combined == Apache style logs
logger.token('user-id', function (req, res) {
    const userId = req.apiUserId;
    return userId ? userId : '-';
});
logger.token('correlation-id', function (req, res) {
    return req.correlationId;
});
if (app.get('env') == 'development') {
    debug('Configuring "dev" logger.');
    app.use(logger('dev'));
} else {
    debug('Configuring logger.');
    app.use(logger('{"date":":date[clf]","method":":method","url":":url","remote-addr":":remote-addr","user-id":":user-id","version":":http-version","status":":status","content-length":":res[content-length]","referrer":":referrer","response-time":":response-time","correlation-id":":correlation-id"}'));
}

// ------- METRICS COLLECTION MIDDLEWARE -------

app.use(prometheusMiddleware.middleware('wicked_api'));

// ------- HEALTH API -------

app.use('/health', healthApi);

// ------- METRICS ---------

app.get('/metrics', authMiddleware.rejectFromKong, prometheusMiddleware.metrics);

// ------- PING -------

app.get('/ping', function (req, res, next) {
    res.json({ message: 'OK', version: utils.getVersion() });
});

// ------- BODYPARSER -------

// The /deploy end points handle their bodys themselves, as we partly
// have binary data to deal with.

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ------ VERSION CHECKING ------

app.get('/confighash', versionizer.sendConfigHash);
app.use(versionizer.checkVersions);

// ------ OAUTH2.0 VIA KONG ------

app.use(authMiddleware.fillUserId);

// ------ CACHING ------

// Turn off caching
app.disable('etag');

// ------- APIS -------

app.use('/apis', apis);

// ----- USERS -----

app.use('/users', users);
const verifyLoginScope = utils.verifyScope('login');
app.post('/login', verifyLoginScope, function (req, res, next) {
    const username = req.body.email || req.body.username;
    const password = req.body.password;
    users.getUserByEmailAndPassword(app, res, req.apiUserId, username, password);
});

// ----- SUBSCRIPTIONS -----

// This is a special case; all other subscription end points can be found
// under applications/<appId>/subscriptions, but this end point looks up an
// application/subscription by the clientId which is connected to the
// subscription, and this needs its own end point.
app.get('/subscriptions/:clientId', authMiddleware.rejectFromKong, function (req, res, next) {
    applications.getSubscriptionByClientId(req, res);
});

app.use('/subscriptions', subscriptions);

// ----- APPLICATIONS -----

app.use('/applications', applications);

// ----- CONTENT -----

app.content = content;
app.use('/content', content);

// ----- APPROVALS ------

app.use('/approvals', approvals);

// ----- WEBHOOKS ------

// Inject users module to webhooks; it's needed there.
// Not true anymore: webhooks are not allowed to be called via Kong (from outside docker)
webhooks.setup(users);
app.use('/webhooks', webhooks);

// ----- VERIFICATIONS -----

// Inject users module to verifications; it's needed there.
verifications.setup(users);
app.use('/verifications', verifications);

// ----- REGISTRATIONS -----

app.use('/registrations', registrations);

// ----- GRANTS -----

app.use('/grants', grants);

// ----- REGISTRATION POOLS -----

app.use('/pools', pools);

// ----- AUTH-SERVERS -----

app.use('/auth-servers', authServers);

app.get('/randomId', function (req, res, next) {
    res.setHeader('Content-Type', 'text/plain');
    res.send(utils.createRandomId());
});

// ------- STATIC DATA ------

const verifyPlansScope = utils.verifyScope('read_plans');
app.get('/plans', verifyPlansScope, function (req, res, next) {
    const plans = utils.loadPlans(app);
    res.json(plans);
});

const verifyGroupsScope = utils.verifyScope('read_groups');
app.get('/groups', verifyGroupsScope, function (req, res, next) {
    const groups = utils.loadGroups(app);
    res.json(groups);
});

app.get('/globals', authMiddleware.rejectFromKong, function (req, res, next) {
    const globals = utils.loadGlobals(app);
    res.json(globals);
});

// ------- SYSTEMHEALTH ------

app.get('/systemhealth', function (req, res, next) {
    systemhealth.getSystemHealth(app, res, req.apiUserId);
});

// ------- TEMPLATES -------

app.use('/templates', templates);

// ------- KILL SWITCH -------

app.use('/kill', kill);

// ------- REGULAR EVENTS -------

app.setupHooks = () => {
    // Make sure webhook notifications are set up
    webhooks.setupHooks();

    // Clean up expired verification records once a minute
    const expiryInterval = process.env.PORTAL_API_EXPIRY_INTERVAL || '60000';
    debug('Setting verification expiry check time to ' + expiryInterval);
    setInterval(verifications.checkExpiredRecords, expiryInterval, app);

    // Check system health once in a while (every 30 seconds)
    const checkHealthInterval = process.env.PORTAL_API_HEALTH_INTERVAL || '30000';
    debug('Setting system check interval to ' + checkHealthInterval);
    if (checkHealthInterval && checkHealthInterval > 0) {
        setInterval(systemhealth.checkHealth, checkHealthInterval, app);
    }
};

// throw 404 for anything else
app.use(function (req, res, next) {
    debug('Not found: ' + req.path);
    res.status(404).jsonp({ message: "Not found." });
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        error(err.message);
        error(err.stack);
        //info(JSON.stringify(err, null, 2));
        res.status(err.status || 500);
        res.jsonp({
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    error(err.message);
    error(err.stack);
    info(JSON.stringify(err, null, 2));
    res.status(err.status || 500);
    res.jsonp({
        message: err.message,
        error: {}
    });
});


module.exports = app;
