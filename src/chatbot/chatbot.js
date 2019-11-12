'use strict';

const request = require('request');
const async = require('async');
const wicked = require('wicked-sdk');
const mustache = require('mustache');
const { debug, warn, error } = require('portal-env').Logger('portal-chatbot:chatbot');

const Messages = require('./messages.json');
const utils = require('./utils');

const chatbot = function () { };

chatbot.eventTargetMapping = {};
chatbot.interestingTemplates = {};
chatbot.chatbotTemplates = null;

chatbot.init = function (app, done) {
    debug('init()');
    const myUrl = app.get('my_url');

    async.parallel({
        registerWebhook: function (callback) {
            debug('Registering as listener.');
            wicked.upsertWebhookListener('chatbot', {
                id: 'chatbot',
                url: myUrl
            }, callback);
        },
        getGlobals: function (callback) {
            const chatbotGlobals = wicked.getGlobals();
            return callback(null, chatbotGlobals);
        },
        getTemplates: function (callback) {
            debug('Getting templates...');
            wicked.getChatbotTemplates(function (err, chatbotTemplates) {
                if (err)
                    return callback(err);
                debug('Retrieved templates successfully.');
                return callback(null, chatbotTemplates);
            });
        }
    }, function (err, results) {
        if (err)
            return done(err);

        app.chatbotGlobals = results.getGlobals;
        chatbot.chatbotTemplates = results.getTemplates;

        chatbot.initInterestingEvents(app.chatbotGlobals);

        return done(null);
    });
};

chatbot.deinit = function (app, done) {
    debug('deinit()');
    wicked.deleteWebhookListener('chatbot', done);
};

chatbot.initInterestingEvents = function (chatbotGlobals) {
    debug('initInterestingEvents()');
    if (!chatbotGlobals.chatbot ||
        !chatbotGlobals.chatbot.targets ||
        !chatbotGlobals.chatbot.useChatbot) {
        return;
    }

    for (let message in Messages) {
        const thisMessage = Messages[message];
        const eventId = thisMessage.entity + '.' + thisMessage.action;
        // Store all targets that are interesting for each event
        for (let i in chatbotGlobals.chatbot.targets) {
            const target = chatbotGlobals.chatbot.targets[i];
            if (target.events[message]) {
                if (!chatbot.eventTargetMapping[eventId]) {
                    chatbot.eventTargetMapping[eventId] = [];
                }

                const messageTemplate = chatbot.chatbotTemplates[message];
                if (!messageTemplate)
                    throw new Error('The chatbot message template is missing for event "' + message + '".');
                chatbot.interestingTemplates[eventId] = messageTemplate;
                chatbot.eventTargetMapping[eventId].push({
                   hookUrl: target.hookUrl,
                   type: target.type,
                });
            }
        }
    }
};

chatbot.isEventInteresting = function (event) {
    debug('isEventInteresting()');
    debug(event);
    const eventId = event.entity + '.' + event.action;
    return !!chatbot.interestingTemplates[eventId];
};

chatbot.handleEvent = function (app, event, done) {
    debug('handleEvent()');
    debug(event);
    const eventId = event.entity + '.' + event.action;
    const messageTemplate = chatbot.interestingTemplates[eventId];
    const targets = chatbot.eventTargetMapping[eventId];
    if (!event.data)
        return done(null);
    if (!event.data.userId)
        return done(null);

    buildViewModel(app, event, function (err, viewModel) {
        if (err)
            return done(err);

        const text = mustache.render(messageTemplate, viewModel);

        async.each(targets, function (target, callback) {
            // Payload depends on type of messenger
            // Post to the hook URL
            let payload = {};
            switch (target.type) {
                case "slack":
                    payload = {
                        username: app.chatbotGlobals.chatbot.username,
                        icon_url: app.chatbotGlobals.chatbot.icon_url,
                        text: text,
                    };
                    break;
                case "msteams":
                    payload = {
                        "@context": "https://schema.org/extensions",
                        "@type": "MessageCard",
                        "themeColor": "0072C6",
                        "title": "Notification from " + app.chatbotGlobals.chatbot.username,
                        "text": text,
                    };
                    break;
                default:
                    error("Unknown chatbot target " + target.type);
                    return callback(null);
            }


            request.post({
                url: target.hookUrl,
                json: true,
                body: payload
            }, function (chatbotErr, apiResponse, apiBody) {
                if (chatbotErr)
                    return callback(chatbotErr);
                if (apiResponse.statusCode > 299) {
                    debug('Posting to Chatbot failed: Status ' + apiResponse.statusCode);
                    debug(apiResponse);
                    debug(apiBody);
                    error(utils.getText(apiBody));
                }

                return callback(null);
            });
        }, function (err, results) {
            if (err) {
                error(err);
            }
            done(null);
        });
    });
};

function getPortalUrl(app) {
    return app.chatbotGlobals.network.schema + '://' +
        app.chatbotGlobals.network.portalHost;
}

function buildViewModel(app, event, callback) {
    debug('buildViewModel()');
    wicked.getUser(event.data.userId, function (err, userInfo) {
        if (err)
            return callback(err);
        // Try to get the name of the user; but if there is none, just use the email address
        // of the user as the user's name (getRegistration must not provoke an error in this case).
        wicked.getUserRegistrations('wicked', event.data.userId, function (err, registrations) {
            let reg = null;
            if (err) {
                warn(`Could not retrieve registration for user ${event.data.userId} (${userInfo.email})`);
            } else {
                // There should be exactly one registration
                if (registrations.items.length !== 1) {
                    warn(`User with user ID ${event.data.userId} does not have a registration for pool 'wicked'`);
                    reg = {
                        name: userInfo.email
                    };
                } else {
                    reg = registrations.items[0];
                }
            }

            const portalUrl = getPortalUrl(app);
            let applicationLink = null;
            if (event.data.applicationId)
                applicationLink = portalUrl + '/applications/' + event.data.applicationId;
            callback(null, {
                userId: event.data.userId,
                email: userInfo.email,
                name: reg.name,
                apiId: event.data.apiId,
                applicationId: event.data.applicationId,
                approvalsLink: portalUrl + '/admin/approvals',
                userLink: portalUrl + '/users/' + event.data.userId,
                applicationLink: applicationLink
            });
        });
    });
}

module.exports = chatbot;
