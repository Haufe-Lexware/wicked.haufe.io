'use strict';

/* global __dirname **/

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:kickstart');
const routes = require('./routes/index');
const apis = require('./routes/apis');
const auth = require('./routes/auth');
const content = require('./routes/content');
const design = require('./routes/design');
const email = require('./routes/email');
const groups = require('./routes/groups');
const ipconfig = require('./routes/ipconfig');
const database = require('./routes/database');
const plans = require('./routes/plans');
const recaptcha = require('./routes/recaptcha');
const kongadapter = require('./routes/kongadapter');
const deploy = require('./routes/deploy');
const chatbot = require('./routes/chatbot');
const swagger = require('./routes/swagger');
const apidesc = require('./routes/apidesc');
const users = require('./routes/users');
const editcontent = require('./routes/editcontent');
const templates = require('./routes/templates');
const envs = require('./routes/envs');
const ssl = require('./routes/ssl');
const shutdown = require('./routes/shutdown');
const authservers = require('./routes/authservers');
const pools = require('./routes/pools');

// API functions
const api = require('./routes/api');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

const accessLog = require('portal-env').Logger('kickstarter:access').info;
app.use(logger(function (tokens, req, res) {
    accessLog(`${tokens.method(req, res)} ${tokens.url(req, res)} ${tokens.status(req, res)} - ${tokens['response-time'](req, res)}ms`);
    return null;
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist')));
app.use('/js/marked', express.static(path.join(__dirname, 'node_modules', 'marked')));
app.use('/js/vue', express.static(path.join(__dirname, 'node_modules', 'vue', 'dist')));
app.use('/js/uiv', express.static(path.join(__dirname, 'node_modules', 'uiv', 'dist')));

app.use('/', routes);
app.use('/ipconfig', ipconfig);
app.use('/database', database);
app.use('/deploy', deploy);
app.use('/ssl', ssl);
app.use('/users', users);
app.use('/auth', auth);
app.use('/groups', groups);
app.use('/plans', plans);
app.use('/apis', apis);
app.use('/authservers', authservers);
app.use('/recaptcha', recaptcha);
app.use('/kongadapter', kongadapter);
app.use('/content', content);
app.use('/email', email);
app.use('/chatbot', chatbot);
app.use('/design', design);
app.use('/swagger', swagger);
app.use('/apidesc', apidesc);
app.use('/editcontent', editcontent);
app.use('/templates', templates);
app.use('/envs', envs);
app.use('/pools', pools);
app.use('/shutdown', shutdown);

app.use('/api', api);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers
// development error handler
// will print stacktrace
// as kickstarter is development only, this is fine and wanted
app.use(function (err, req, res, next) {
    error(err);
    error(err.stack);
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: err
    });
});

module.exports = app;
