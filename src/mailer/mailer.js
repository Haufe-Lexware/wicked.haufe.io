'use strict';

const async = require('async');
const path = require('path');
const fs = require('fs');
const { debug, info, warn, error } = require('portal-env').Logger('portal-mailer:utils');
const mustache = require('mustache');
const wicked = require('wicked-sdk');

const utils = require('./utils');

const mailer = function () { };

mailer.smtpTransporter = null;

mailer.init = function (app, done) {
    debug('init()');
    const myUrl = app.get('my_url');

    async.parallel({
        registerWebhook: function (callback) {
            wicked.upsertWebhookListener('mailer', {
                id: 'mailer',
                url: myUrl
            }, callback);
        },
        getGlobals: function (callback) {
            const mailerGlobals = wicked.getGlobals();
            return callback(null, mailerGlobals);
        }
    }, function (err, results) {
        if (err)
            return done(err);

        app.mailerGlobals = results.getGlobals;

        return done(null);
    });
};

mailer.deinit = function (app, done) {
    debug('deinit()');
    wicked.deleteWebhookListener('mailer', done);
};

mailer.isEventInteresting = function (event) {
    debug('isEventInteresting()');
    debug(event);
    if (event.entity == "verification_lostpassword" ||
        event.entity == "verification_email")
        return true;
    if (event.entity == "approval" &&
        event.action == "add")
        return true;
    return false;
};

function getEmailData(event) {
    debug('getEmailData()');
    if (event.entity == "verification_email")
        return {
            template: "verify_email",
            subject: "Email validation",
            to: "user"
        };
    if (event.entity == "verification_lostpassword")
        return {
            template: "lost_password",
            subject: "Lost Password Recovery",
            to: "user"
        };
    if (event.entity == "approval" &&
        event.action == "add")
        return {
            template: "pending_approval",
            subject: "Pending Approval",
            to: "admin"
        };
    throw new Error("Mailer: getEmailData - event meta information invalid.");
}

mailer.handleEvent = function (app, event, done) {
    debug('handleEvent()');
    debug(event);
    const userId = event.data.userId;
    wicked.getUser(userId, function (err, userInfo) {
        if (err && err.status === 404) {
            // User has probably been deleted in the meantime.
            warn('handleEvent() - Unknown user ID: ' + userId);
            // We'll treat this as a success, not much we can do here.
            return done(null);
        }
        if (err)
            return done(err);

        // Let's check whether we have a registration for this user
        wicked.getUserRegistrations('wicked', userId, function (err, registrations) {
            // We won't fail if we don't get a registration for this user, instead just use the email
            // address as "name". If we get specific registration info, that's good, otherwise just use email.
            let reg = {
                name: userInfo.email
            };
            if (err) {
                warn(`Could not retrieve registrations for user ${userId}.`);
            } else {
                if (registrations.items.length !== 1) {
                    warn(`User ${userId} did not have exactly one registration for pool "wicked" (number: ${registrations.items.length}).`);
                } else {
                    reg = registrations.items[0];
                }
            }

            // Change for wicked 1.0: The verifications already contain the fully qualified link
            const verificationLink = event.data.link ?
                mustache.render(event.data.link, { id: event.data.id }) :
                '';
            const approvalsLink =
                app.mailerGlobals.network.schema + '://' +
                app.mailerGlobals.network.portalHost +
                '/admin/approvals';

            const viewData = {
                title: app.mailerGlobals.title,
                user: {
                    id: userInfo.id,
                    name: reg.name,
                    email: userInfo.email,
                },
                api: {
                    id: event.data.apiId
                },
                plan: {
                    id: event.data.planId
                },
                application: {
                    id: event.data.applicationId
                },                
                verificationLink: verificationLink,
                approvalsLink: approvalsLink,
                portalEmail: app.mailerGlobals.mailer.senderEmail
            };
            debug(viewData);

            const emailData = getEmailData(event);
            const templateName = emailData.template;

            wicked.getEmailTemplate(templateName, function (err, templateText) {
                if (err) {
                    error('Getting the email template failed!');
                    return done(err);
                }
                // Do da Mustache {{ }}
                const text = mustache.render(templateText, viewData);
                // Do da emailing thing
                const from = '"' + app.mailerGlobals.mailer.senderName + '" <' + app.mailerGlobals.mailer.senderEmail + '>';
                let to = '"' + reg.name + '" <' + userInfo.email + '>';
                if ("admin" == emailData.to)
                    to = '"' + app.mailerGlobals.mailer.adminName + '" <' + app.mailerGlobals.mailer.adminEmail + '>';
                    
                let subject = app.mailerGlobals.title + ' - ' + emailData.subject ;

                if(event.data.group){
                    subject = subject + ' - ' + event.data.group;
                }
                
                const email = {
                    from: from,
                    to: to,
                    subject: subject,
                    text: text
                };
                debug(email);

                mailer.smtpTransporter.sendMail(email, function (emailErr, emailResponse) {
                    if (emailErr) {
                        // Check the type of error...
                        // https://www.greenend.org.uk/rjk/tech/smtpreplies.html
                        switch (emailErr.responseCode) {
                            case 500:
                            case 501: // e.g. email address invalid
                                error(`Could not send email, discarding email to ${to}.`);
                                return done(null, emailResponse);
                        }
                        return done(emailErr);
                    }
                    info("Sent email to " + to + ".");
                    done(null, emailResponse);
                });
            });
        });
    });
};

module.exports = mailer;