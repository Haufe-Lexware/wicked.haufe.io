'use strict';

const path = require('path');
const fs = require('fs');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:templates');

const utils = require('./utils');
const users = require('./users');

const templates = require('express').Router();

// ===== SCOPES =====

const READ = 'read_templates';
const verifyScope = utils.verifyScope(READ);

// ===== ENDPOINTS =====

templates.get('/chatbot', verifyScope, function (req, res, next) {
    templates.getChatbotTemplates(req.app, res, req.apiUserId);
});

templates.get('/email/:templateId', verifyScope, function (req, res, next) {
    templates.getEmailTemplate(req.app, res, req.apiUserId, req.params.templateId, next);
});

// ===== IMPLEMENTATION =====

templates.getChatbotTemplates = function (app, res, loggedInUserId) {
    users.isUserIdAdmin(app, loggedInUserId, (err, isAdmin) => {
        if (err || !isAdmin) {
            return res.status(403).jsonp({ message: 'Not allowed. Only admins can do this.' });
        }
        const chatbotTemplates = utils.loadChatbotTemplates(app);
        res.json(chatbotTemplates);
    });
};

templates.getEmailTemplate = function (app, res, loggedInUserId, templateName, next) {
    users.isUserIdAdmin(app, loggedInUserId, (err, isAdmin) => {
        if (err || !isAdmin) {
            return res.status(403).jsonp({ message: 'Not allowed. Only admins can do this.' });
        }
        try {
            const emailTemplate = utils.loadEmailTemplate(app, templateName);
            res.setHeader('Content-Type', 'text/plain');
            res.send(emailTemplate);
        } catch (err) {
            err.status = 404;
            return next(err);
        }
    });
};

module.exports = templates;
