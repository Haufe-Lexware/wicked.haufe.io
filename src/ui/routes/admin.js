'use strict';

const express = require('express');
const router = express.Router();
const async = require('async');
const mustache = require('mustache');
const { debug, info, warn, error } = require('portal-env').Logger('portal:admin');
const tmp = require('tmp');
const fs = require('fs');
const util = require('util');
const utils = require('./utils');

router.get('/approvals', function (req, res, next) {
    debug('get("/approvals")');
    utils.getFromAsync(req, res, '/approvals', 200, function (err, apiResponse) {
        if (err)
            return next(err);
        console.log(JSON.stringify(apiResponse));
        for (let approval of apiResponse) {
            if (approval.application) {
                const app = approval.application;
                if (app.name) {
                    app.name = utils.sanitizeHtml(app.name);
                }
                if (app.description) {
                    app.description = utils.sanitizeHtml(app.description);
                }
            }
        }
        if (!utils.acceptJson(req)) {
            res.render('admin_approvals', {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'Pending Subscription Approvals',
                approvals: JSON.stringify(apiResponse)
            });
        } else {
            res.json({
                title: 'Pending Subscription Approvals',
                approvals: apiResponse
            });
        }
    });
});

router.post('/approvals/approve', function (req, res, next) {
    debug("post('/approvals/approve')");
    const appId = req.body.app;
    const apiId = req.body.api;
    const approvalId = req.body.id;
    if (!approvalId || !appId || !apiId) {
        const err = new Error('Bad request. Approval ID, App and API all need to be specified.');
        err.status = 400;
        return next(err);
    }

    utils.get(req, `/approvals/${approvalId}`, (err, apiRes, apiBody) => {
        if (err)
            return next(err);
        const approvalInfo = utils.getJson(apiBody);
        debug(approvalInfo);

        if (approvalInfo.application.id !== appId)
            return next(utils.makeError(400, 'Bad request. Application ID does not match approval request.'));
        if (approvalInfo.api.id !== apiId)
            return next(utils.makeError(400, 'Bad request. API does not match approval request.'));
        const isTrusted = approvalInfo.application.trusted;
        const patchBody = {
            approved: true,
            trusted: isTrusted
        };

        // Hit the API
        utils.patch(req, `/applications/${appId}/subscriptions/${apiId}`, patchBody, (err, apiResponse, apiBody) => {
            if (err)
                return next(err);
            if (200 != apiResponse.statusCode)
                return utils.handleError(res, apiResponse, apiBody, next);
            // Woohoo
            if (!utils.acceptJson(req))
                res.redirect('/admin/approvals');
            else
                res.json(utils.getJson(apiBody));
        });
    });
});

router.post('/approvals/decline', function (req, res, next) {
    debug("post('/approvals/decline')");
    const appId = req.body.app;
    const apiId = req.body.api;
    if (!appId || !apiId) {
        const err = new Error('Bad request. Both App and API need to be specificed.');
        err.status = 400;
        return next(err);
    }

    // Then delete the subscription. Should we notify the user? Nah.
    utils.delete(req, '/applications/' + appId + '/subscriptions/' + apiId,
        function (err, apiResponse, apiBody) {
            if (err)
                return next(err);
            if (204 != apiResponse.statusCode)
                return utils.handleError(res, apiResponse, apiBody, next);
            // Booyakasha
            if (!utils.acceptJson(req))
                res.redirect('/admin/approvals');
            else
                res.status(204).json({});
        });
});

router.get('/approvals_csv', mustBeAdminOrApproverMiddleware, function (req, res, next) {
    debug('get("/approvals_csv")');
    utils.getFromAsync(req, res, '/approvals', 200, function (err, apiResponse) {
        if (err)
            return next(err);
        if (!utils.isEmptyGridFilter(req.query)) {
            apiResponse = apiResponse.filter(function (item) {
                if (utils.applyGridFilter(req.query, item)) {
                    return true;
                }
                return false;
            });
        }
        tmp.file(function (err, path, fd, cleanup) {
            if (err)
                return next(err);
            const outStream = fs.createWriteStream(path);
            outStream.write('User;Application;Description;Trusted;Api;Plan;Date (UTC)\n');
            apiResponse.forEach(item => {
                let trusted = item.application.trusted ? 'Yes' : '-';
                let date = utils.dateFormat(new Date(item.changedDate), "%Y-%m-%d %H:%M:%S", true);
                let description = item.application.description ? item.application.description : 'No Description';
                const approvalsLine = `${item.user.email}; ${item.application.name}; ${description}; ${trusted}; ${item.api.name}; ${item.plan.name}; ${date}\n`;
                debug(approvalsLine);
                outStream.write(approvalsLine);
            });
            outStream.end(function (err) {
                if (err) {
                    cleanup();
                    return next(err);
                }
                res.download(path, 'approvals.csv', function (err) {
                    cleanup();
                    if (err) {
                        return next(err);
                    }
                });
            });
        });
    });
});

function byName(a, b) {
    return a.name < b.name ? -1 : 1;
}

function mustBeAdminMiddleware(req, res, next) {
    const loggedInUserId = utils.getLoggedInUserId(req);
    if (!loggedInUserId)
        return utils.fail(403, 'You must be logged in to view this page.', next);
    if (!req.user.admin)
        return utils.fail(403, 'Only Admins can view this page. If you need access, contact your site administrator.', next);

    return next();
}

function mustBeAdminOrApproverMiddleware(req, res, next) {
    const loggedInUserId = utils.getLoggedInUserId(req);
    if (!loggedInUserId)
        return utils.fail(403, 'You must be logged in to view this page.', next);
    if (!req.user.admin && !req.user.approver)
        return utils.fail(403, 'Only Admins Or Approvers can view this page. If you need access, contact your site administrator.', next);

    return next();
}

router.get('/users', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/users')");
    if (!utils.acceptJson(req)) {
        res.render('admin_users',
            {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'All Users',
            });
        return;
    }
    const filterFields = ['id', 'name', 'email'];
    const usersUri = utils.makePagingUri(req, '/registrations/pools/wicked', filterFields);
    utils.getFromAsync(req, res, usersUri, 200, function (err, apiResponse) {
        if (err)
            return next(err);
        if (utils.acceptJson(req)) {
            res.json({
                title: 'All Users',
                users: apiResponse
            });
        }
    });
});

router.get('/auditlog', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/auditlog')");
    const filterFields = ['activity', 'user', 'email', 'plan', 'api', 'role', 'application', 'startdate', 'enddate'];
    const auditlogUri = utils.makePagingUri(req, '/auditlog?embed=1&', filterFields);
    console.log("auditlog" + auditlogUri);
    if (!utils.acceptJson(req)) {
        res.render('admin_auditlog', {
            authUser: req.user,
            glob: req.app.portalGlobals,
            title: 'Audit Log',
        });
        return;
    }
    utils.getFromAsync(req, res, auditlogUri, 200, function (err, auditlogResponse) {
        if (err)
            return next(err);
        if (utils.acceptJson(req)) {
            console.log(JSON.stringify(auditlogResponse, null, 2));
            for (let auditLog of auditlogResponse.items) {
                if (auditLog.user)
                    auditLog.user = utils.sanitizeHtml(auditLog.user);
            }
            res.json({
                title: 'Audit Log',
                auditlog: auditlogResponse
            });
        }
    });
});

router.get('/auditlog_csv', mustBeAdminOrApproverMiddleware, function (req, res, next) {
    debug("get('/auditlog_csv')");
    const filterFields = ['activity', 'user', 'email', 'plan', 'api', 'role', 'application', 'startdate', 'enddate'];
    const auditlogUri = utils.makePagingUri(req, '/auditlog?embed=1&', filterFields);

    utils.getFromAsync(req, res, auditlogUri, 200, function (err, auditResponse) {
        if (err)
            return next(err);
        tmp.file(function (err, path, fd, cleanup) {
            if (err)
                return next(err);
            const outStream = fs.createWriteStream(path);
            outStream.write('Api;Application;Plan;Date (UTC);Activity;User;Email;Role\n');
            for (let i = 0; i < auditResponse.items.length; ++i) {
                const item = auditResponse.items[i];
                const api = item.api ? item.api : ``;
                const application = item.application ? item.application : ``;
                const plan = item.plan ? item.plan : ``;
                const created_at = utils.dateFormat(new Date(item.created_at), "%Y-%m-%d %H:%M:%S", true);
                const auditLine = `${api}; ${application}; ${plan}; ${created_at}; ${item.activity}; ${item.user};  ${item.email}; ${item.role}\n`;
                outStream.write(auditLine);
            }
            outStream.end(function (err) {
                if (err) {
                    cleanup();
                    return next(err);
                }
                res.download(path, 'auditlog.csv', function (err) {
                    cleanup();
                    if (err) {
                        return next(err);
                    }
                });
            });
        });
    });
});

router.get('/subscriptions', mustBeAdminOrApproverMiddleware, function (req, res, next) {
    debug("get('/subscriptions')");
    const filterFields = ['application', 'application_name', 'plan', 'api', 'owner', 'user'];
    const subsUri = utils.makePagingUri(req, '/subscriptions?embed=1&', filterFields);
    utils.getFromAsync(req, res, subsUri, 200, function (err, subsResponse) {
        if (err)
            return next(err);
        if (!utils.acceptJson(req)) {
            res.render('admin_subscriptions', {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'All Subscriptions',
            });
            return;
        }
        if (utils.acceptJson(req)) {
            res.json({
                title: 'All Subscriptions',
                subscriptions: subsResponse
            });
        }
    });
});

router.get('/subscriptions_csv', mustBeAdminOrApproverMiddleware, function (req, res, next) {
    debug("get('/subscriptions')");
    const filterFields = ['application', 'application_name', 'plan', 'api', 'owner', 'user'];
    const subsUri = utils.makePagingUri(req, '/subscriptions?embed=1&', filterFields);
    utils.getFromAsync(req, res, subsUri, 200, function (err, subsResponse) {
        if (err)
            return next(err);
        tmp.file(function (err, path, fd, cleanup) {
            if (err)
                return next(err);
            const outStream = fs.createWriteStream(path);
            outStream.write('Status;Application;Owners;Users;Api;Plan\n');
            for (let i = 0; i < subsResponse.items.length; ++i) {
                const item = subsResponse.items[i];
                let status = (item.approved) ? `Approved` : `Pending`;
                status = (item.trusted) ? `${status}, (Trusted)` : status;
                const subscLine = `${status}; ${item.application_name}; ${item.owner}; ${item.user}; ${item.api}; ${item.plan}\n`;
                debug(subscLine);
                outStream.write(subscLine);
            }
            outStream.end(function (err) {
                if (err) {
                    cleanup();
                    return next(err);
                }
                res.download(path, 'subscriptions.csv', function (err) {
                    cleanup();
                    if (err) {
                        return next(err);
                    }
                });
            });
        });
    });
});

router.get('/applications', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/applications')");
    if (!utils.acceptJson(req)) {
        res.render('admin_applications', {
            authUser: req.user,
            glob: req.app.portalGlobals,
            title: 'All Applications',
        });
        return;
    }
    const filterFields = ['id', 'name', 'ownerEmail'];
    const appsUri = utils.makePagingUri(req, '/applications?embed=1&', filterFields);
    utils.getFromAsync(req, res, appsUri, 200, function (err, appsResponse) {
        if (err)
            return next(err);
        if (utils.acceptJson(req)) {
            res.json({
                title: 'All Applications',
                applications: appsResponse
            });
        }
    });
});

router.get('/subscribe', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/subscribe')");
    async.parallel({
        getApplications: function (callback) {
            utils.getFromAsync(req, res, '/applications', 200, callback);
        },
        getApis: function (callback) {
            utils.getFromAsync(req, res, '/apis', 200, callback);
        }
    }, function (err, results) {
        if (err)
            return next(err);

        const apps = results.getApplications;
        const apis = results.getApis;

        res.render('admin_subscribe', {
            authUser: req.user,
            glob: req.app.portalGlobals,
            title: 'Admin Subscription Page',
            apps: apps,
            apis: apis.apis
        });
    });
});

router.get('/listeners', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/listeners')");
    utils.getFromAsync(req, res, '/webhooks/listeners', 200, function (err, appsResponse) {
        if (err)
            return next(err);
        if (!utils.acceptJson(req)) {
            res.render('admin_listeners', {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'Webhook Listeners',
                listeners: appsResponse
            });
        } else {
            res.json({
                title: 'Webhook Listeners',
                listeners: appsResponse
            });
        }
    });
});

router.get('/listeners/:listenerId', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/listeners/:listenerId')");
    const listenerId = req.params.listenerId;
    const regex = /^[a-zA-Z0-9\-_]+$/;
    if (!regex.test(listenerId))
        return req.status(400).jsonp({ message: 'Bad Request.' });
    utils.getFromAsync(req, res, '/webhooks/events/' + listenerId, 200, function (err, appsResponse) {
        if (err)
            return next(err);
        if (!utils.acceptJson(req)) {
            res.render('admin_events', {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'Pending Events - ' + listenerId,
                events: appsResponse
            });
        } else {
            res.json({
                title: 'Pending Events - ' + listenerId,
                events: appsResponse
            });
        }
    });
});

router.get('/verifications', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/verifications'");
    utils.getFromAsync(req, res, '/verifications', 200, function (err, verifResponse) {
        if (err)
            return next(err);
        verifResponse.forEach(v => v.link = mustache.render(v.link, { id: v.id }));
        if (!utils.acceptJson(req)) {
            res.render('admin_verifications', {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'Pending Verifications',
                verifications: JSON.stringify(verifResponse)
            });
        } else {
            res.json({
                title: 'Pending Verifications',
                verifications: verifResponse
            });
        }
    });
});

router.post('/verifications/:verificationId', mustBeAdminMiddleware, function (req, res, next) {
    const verificationId = req.params.verificationId;
    utils.delete(req, `/verifications/${verificationId}`, (err, apiResponse, apiBody) => {
        if (err) {
            error(err);
            return res.json({
                success: false,
                message: err.message
            });
        }
        if (apiResponse.statusCode >= 200 && apiResponse.statusCode < 300) {
            return res.json({
                success: true,
                message: 'Successfully deleted verification.'
            });
        }
        warn(`Delete verification: Failed with status code ${apiResponse.statusCode}, API returns:`);
        warn(apiBody);
        return res.json({
            success: false,
            message: `Unexpected status code ${apiResponse.statusCode}.`,
            response: apiBody
        });
    });
});

function padLeft(n) {
    if (n < 10)
        return "0" + n;
    return "" + n;
}

function fixUptimes(healths) {
    debug('fixUptimes()');
    for (let i = 0; i < healths.length; ++i) {
        const uptimeSeconds = Number(healths[i].uptime);
        if (uptimeSeconds >= 0) {
            const days = Math.floor(uptimeSeconds / 86400);
            let remain = uptimeSeconds - (days * 86400);
            const hours = Math.floor(remain / 3600);
            remain = remain - (hours * 3600);
            const minutes = Math.floor(remain / 60);
            const seconds = remain - (minutes * 60);
            if (days > 0)
                healths[i].uptimeText = util.format('%d days, %d:%s:%s', days, hours, padLeft(minutes), padLeft(seconds));
            else
                healths[i].uptimeText = util.format('%d:%s:%s', hours, padLeft(minutes), padLeft(seconds));
        } else {
            healths[i].uptimeText = '---';
        }
    }
}

router.get('/health', mustBeAdminMiddleware, function (req, res, next) {
    debug("get('/health')");
    utils.getFromAsync(req, res, '/systemhealth', 200, function (err, healthResponse) {
        if (err)
            return next(err);
        fixUptimes(healthResponse);
        if (!utils.acceptJson(req)) {
            res.render('admin_systemhealth', {
                authUser: req.user,
                glob: req.app.portalGlobals,
                title: 'System Health',
                health: healthResponse
            });
        } else {
            res.json({
                title: 'System Health',
                health: healthResponse
            });
        }
    });
});

router.get('/apis/:apiId/subscriptions_csv', mustBeAdminMiddleware, function (req, res, next) {
    const apiId = req.params.apiId;
    debug("get('/apis/" + apiId + "/subscriptions_csv')");
    utils.getFromAsync(req, res, '/apis/' + apiId + '/subscriptions', 200, function (err, applicationList) {
        if (err)
            return next(err);
        tmp.file(function (err, path, fd, cleanup) {
            if (err)
                return next(err);
            async.mapLimit(applicationList.items, 10, function (appEntry, callback) {
                utils.getFromAsync(req, res, '/applications/' + appEntry.application, 200, callback);
            }, function (err, results) {
                if (err) {
                    cleanup();
                    return next(err);
                }
                const outStream = fs.createWriteStream(path);
                outStream.write('api_id;application_id;application_name;plan;owner_id;owner_email;owner_role\n');
                for (let i = 0; i < results.length; ++i) {
                    const thisApp = results[i];
                    for (let owner = 0; owner < thisApp.owners.length; ++owner) {
                        const thisOwner = thisApp.owners[owner];
                        const ownerLine = apiId + ';' +
                            thisApp.id + ';' +
                            thisApp.name + ';' +
                            applicationList.items[i].plan + ';' +
                            thisOwner.userId + ';' +
                            thisOwner.email + ';' +
                            thisOwner.role + '\n';
                        debug(ownerLine);
                        outStream.write(ownerLine);
                    }
                }
                outStream.end(function (err) {
                    if (err) {
                        cleanup();
                        return next(err);
                    }
                    res.download(path, 'subscriptions-' + apiId + '.csv', function (err) {
                        cleanup();
                        if (err) {
                            return next(err);
                        }
                    });
                });
            });
        });
    });
});

router.post('/apis/:apiId/delete_subscriptions', mustBeAdminMiddleware, function (req, res, next) {
    // This thing could use CSRF
    const apiId = req.params.apiId;
    debug("post('/apis/" + apiId + "/delete_subscriptions')");
    utils.getFromAsync(req, res, '/apis/' + apiId + '/subscriptions', 200, function (err, applicationList) {
        if (err) {
            return next(err);
        }
        async.eachSeries(applicationList.items, function (appEntry, callback) {
            utils.delete(req, '/applications/' + appEntry.application + '/subscriptions/' + apiId, callback);
        }, function (err, results) {
            if (err)
                return next(err);
            res.redirect('/apis/' + apiId);
        });
    });
});

router.post('/restart', mustBeAdminMiddleware, function (req, res, next) {
    debug('/admin/restart');
    utils.post(req, '/kill', null, function (err, apiRes, apiBody) {
        if (err)
            return next(err);
        if (204 !== apiRes.statusCode)
            return utils.fail(apiRes.statusCode, `The restart request returned an unexpected status code ${apiRes.statusCode}.`, next);
        res.render('admin_restart');
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    });
});

module.exports = router;
