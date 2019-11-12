'use strict';

const express = require('express');
const { debug, info, warn, error } = require('portal-env').Logger('portal:users');
const passwordValidator = require('portal-env').PasswordValidator;
const wicked = require('wicked-sdk');
const router = express.Router();
const async = require('async');
const utils = require('./utils');

router.get('/me', function (req, res, next) {
    debug("get('/me')");
    const loggedInUserId = utils.getLoggedInUserId(req);
    const userId = loggedInUserId;
    return getUser(loggedInUserId, userId, req, res, next);
});

router.get('/:userId', function (req, res, next) {
    debug("get('/:userId')");
    const loggedInUserId = utils.getLoggedInUserId(req);
    const userId = req.params.userId;
    return getUser(loggedInUserId, userId, req, res, next);
});

function getUser(loggedInUserId, userId, req, res, next) {
    debug("getUser(), loggedInUserId: " + loggedInUserId + ", userId: " + userId);
    if (!loggedInUserId) {
        const err = new Error('You cannot view user profiles when not logged in.');
        err.status = 403;
        return next(err);
    }

    async.parallel({
        getUser: callback => utils.getFromAsync(req, res, '/users/' + userId, 200, callback),
        getRegistration: callback => utils.getFromAsync(req, res, '/registrations/pools/wicked/users/' + userId, 200, callback),
        getGroups: callback => utils.getFromAsync(req, res, '/groups', 200, callback),
        getPool: callback => utils.getFromAsync(req, res, '/pools/wicked', 200, callback)
    }, function (err, results) {
        if (err)
            return next(err);

        const userInfo = results.getUser;
        const regResults = results.getRegistration;
        if (!regResults.items || !Array.isArray(regResults.items))
            return next(utils.makeError(500, 'Unexpected result of getting registrations (not an array of registrations'));
        if (userInfo.email == 'portal@wicked.haufe.io')
            return next(utils.makeError(403, 'This is an internal user of the API portal, it cannot be viewed.'));
        if (regResults.items.length !== 1) {
            error(regResults);
            return next(utils.makeError(500, `Number of registrations not exactly equal 1, received ${regResults.items.length} items.`));
        }
        const registrationInfo = regResults.items[0];
        const poolInfo = results.getPool;
        const groups = results.getGroups.groups;
        for (let i = 0; i < userInfo.groups.length; ++i) {
            for (let j = 0; j < groups.length; ++j) {
                if (groups[j].id == userInfo.groups[i])
                    groups[j].isMember = true;
            }
        }

        // Build the link to the "verify email" functionality, this depends on the auth method the
        // user selected when logging in.
        const authMethodId = req.session.user.authMethodId;
        if (!authMethodId)
            return utils.fail(500, 'Could not retrieve auth method ID from user session.', next);
        const authMethod = req.app.authConfig.authMethods.find(am => am.name == authMethodId);
        if (!authMethod)
            return utils.fail(500, 'Could not retrieve auth method configuration.', next);
        let verifyEmailLink = '';
        if (authMethod.config.verifyEmailEndpoint)
            verifyEmailLink = `${req.app.authConfig.authServerUrl}${authMethod.config.verifyEmailEndpoint}`;
        const grantsLink = `${req.app.authConfig.authServerUrl}${authMethod.config.grantsEndpoint}`;
        debug(`verifyEmailLink: ${verifyEmailLink}`);
        const passwordStrategyName = wicked.getPasswordStrategy();
        const passwordStrategy = passwordValidator.getStrategy(passwordStrategyName);

        if (!utils.acceptJson(req)) {
            res.render('user', {
                authUser: req.user,
                verifyEmailLink: verifyEmailLink,
                grantsLink: grantsLink,
                glob: req.app.portalGlobals,
                title: userInfo.name,
                userInfo: userInfo,
                registrationInfo: registrationInfo,
                poolInfo: poolInfo,
                groups: groups,
                passwordRegex: passwordStrategy.regex,
                passwordRules: passwordStrategy.description
            });
        } else {
            res.json({
                title: userInfo.name,
                userInfo: userInfo,
                grantsLink: grantsLink,
                registrationInfo: registrationInfo,
                poolInfo: poolInfo,
                groups: groups
            });
        }
    });
}

router.post('/:userId', function (req, res, next) {
    debug("post('/:userId')");
    const loggedInUserId = utils.getLoggedInUserId(req);
    if (!loggedInUserId) {
        const err = new Error('You cannot update a user profile when not logged in.');
        err.status = 403;
        return next(err);
    }

    const b = req.body;

    debug(b);
    const userId = req.params.userId;

    if ("deletePassword" == b.__action) {
        utils.delete(req, '/users/' + userId + '/password', function (err, apiResponse, apiBody) {
            if (err)
                return next(err);
            if (204 != apiResponse.statusCode)
                return utils.handleError(res, apiResponse, apiBody, next);
            // Woo hoo
            if (!utils.acceptJson(req))
                return res.redirect('/users/' + userId);
            else
                return res.status(204).json({});
        });
        return;
    }

    // We need the groups and pool info.
    async.parallel({
        getGroups: callback => utils.getFromAsync(req, res, '/groups', 200, callback),
        getPool: callback => utils.getFromAsync(req, res, '/pools/wicked', 200, callback)
    }, (err, results) => {
        if (err)
            return next(err);

        const apiGroups = results.getGroups.groups;
        const poolInfo = results.getPool;

        const userPatch = {};
        if (b.password)
            userPatch.password = b.password;
        // Check for groups only if user is admin
        if (b.__updategroups) {
            if (req.user.admin) {
                // Do da groups
                const newGroups = [];
                for (let i = 0; i < apiGroups.length; ++i) {
                    const groupId = apiGroups[i].id;
                    if (b[groupId] == groupId)
                        newGroups.push(groupId);
                }
                userPatch.groups = newGroups;
            }
        }

        // Change the registration information...
        // This includes 'name' (in the pool definition).
        const registrationInfo = {
            userId: userId,
            poolId: 'wicked',
            namespace: null
        };

        for (let i = 0; i < poolInfo.properties.length; ++i) {
            const propInfo = poolInfo.properties[i];
            const propName = propInfo.id;
            registrationInfo[propName] = b[propName];
        }

        utils.patch(req, '/users/' + userId, userPatch, function (err, apiResponse, apiBody) {
            if (err)
                return next(err);
            if (200 != apiResponse.statusCode)
                return utils.handleError(res, apiResponse, apiBody, next);
            const userInfo = utils.getJson(apiBody);
            utils.put(req, '/registrations/pools/wicked/users/' + userId, registrationInfo, (err, apiResponse, apiBody) => {
                if (err)
                    return next(err);
                if (apiResponse.statusCode > 299)
                    return utils.handleError(res, apiResponse, apiBody, next);
                const registrationInfo = utils.getJson(apiBody);
                // Yay!
                if (!utils.acceptJson(req)) {
                    if (userId === loggedInUserId)
                        res.redirect('/users/me');
                    else
                        res.redirect('/users/' + userId);
                } else {
                    res.json({
                        userInfo,
                        registrationInfo
                    });
                }
            });
        });
    });
});

router.post('/:userId/delete', function (req, res, next) {
    const loggedInUserId = utils.getLoggedInUserId(req);
    if (!loggedInUserId) {
        const err = new Error('You cannot delete a user profile when not logged in.');
        err.status = 403;
        return next(err);
    }

    const userToDelete = req.params.userId;
    const selfDeletion = (userToDelete.toLowerCase() == loggedInUserId.toLowerCase());

    utils.delete(req, '/users/' + userToDelete, function (err, apiResponse, apiBody) {
        if (err)
            return next(err);
        if (204 != apiResponse.statusCode)
            return utils.handleError(res, apiResponse, apiBody, next);
        // Yay!

        if (!utils.acceptJson(req)) {
            if (selfDeletion)
                return res.redirect('/login/logout');
            return res.redirect('/admin/users');
        } else {
            res.status(204).json({});
        }
    });
});

module.exports = router;