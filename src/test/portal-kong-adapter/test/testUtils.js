'use strict';

const crypto = require('crypto');
const request = require('request');
const consts = require('./testConsts');

const utils = {};

utils.createRandomId = function () {
    return crypto.randomBytes(5).toString('hex');
};

utils.getJson = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return JSON.parse(ob);
    return ob;
};

utils.getText = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return ob;
    return JSON.stringify(ob, null, 2);
};

utils.createUser = function (lastName, group, validated, callback) {
    let thisGroup = [];
    if (group)
        thisGroup = [group];
    request.post({
        url: consts.BASE_URL + 'users',
        json: true,
        headers: utils.makeHeaders('1', 'write_users'),
        body: {
            firstName: 'Dummy', 
            lastName: lastName,
            validated: validated,
            email: lastName.toLowerCase() + '@random.org',
            groups: thisGroup
        }
    }, function (err, res, body) {
        if (201 != res.statusCode)
            throw Error("Creating user did not succeed: " + utils.getText(body));
        const jsonBody = utils.getJson(body);
        // console.log(jsonBody);
        callback(jsonBody.id);
    });
};

utils.createUserAsync = async function (lastName, group, validated) {
    return new Promise((resolve) => {
        utils.createUser(lastName, group, validated, resolve);
    });
};

utils.makeHeaders = function (userId, scopes) {
    if (!userId && !utils.correlationId)
        return null;
    const headers = {};
    if (userId)
        headers['X-Authenticated-UserId'] = `sub=${userId}`;
    if (scopes)
        headers['X-Authenticated-Scope'] = scopes;
    if (utils.correlationId)
        headers['Correlation-Id'] = utils.correlationId;

    return headers;
};

utils.getUser = function (userId, callback) {
    request({
        url: consts.BASE_URL + 'users/' + userId,
        headers: utils.makeHeaders(userId, 'read_users')
    }, function (err, res, body) {
        if (200 != res.statusCode)
            throw Error("Could not retrieve user: " + utils.getText(body));
        callback(utils.getJson(body));
    });
};

utils.getUserAsync = async function (userId) {
    return new Promise((resolve) => {
        utils.getUser(userId, resolve);
    });
};

utils.deleteUser = function (userId, callback) {
    request.delete({
        url: consts.BASE_URL + 'users/' + userId,
        headers: utils.makeHeaders(userId, 'write_users')
    }, function (err, res, body) {
        if (204 != res.statusCode)
            throw Error("Deleting user " + userId + " did not succeed: " + utils.getText(body));
        callback();
    });
};

utils.deleteUserAsync = async function (userId) {
    return new Promise((resolve) => {
        utils.deleteUser(userId, resolve);
    });
};

utils.setGroups = function (userId, groups, callback) {
    request.patch({
        url: consts.BASE_URL + 'users/' + userId,
        headers: utils.makeHeaders('1', 'write_users'), // Admin required
        json: true,
        body: {
            groups: groups
        }
    }, function (err, res, body) {
        if (err)
            throw err;
        if (200 != res.statusCode)
            throw new Error('Setting user groups failed: ' + utils.getText(body));
        callback();
    });
};

utils.createApplication = function (appId, appInfo, userId, callback) {
    let appName = appInfo;
    let redirectUri = null;
    if (typeof (appInfo) === 'object') {
        if (appInfo.name)
            appName = appInfo.name;
        if (appInfo.redirectUri)
            redirectUri = appInfo.redirectUri;
    }
    request.post({
        url: consts.BASE_URL + 'applications',
        headers: utils.makeHeaders(userId, 'write_applications'),
        json: true,
        body: {
            id: appId,
            name: appName,
            redirectUri: redirectUri
        }
    }, function (err, res, body) {
        if (201 != res.statusCode)
            throw Error("Creating application failed:" + utils.getText(body));
        callback();
    });
};

utils.createApplicationAsync = async function (appId, appInfo, userId) {
    return new Promise(resolve => utils.createApplication(appId, appInfo, userId, resolve));
};

utils.deleteApplication = function (appId, userId, callback) {
    request.delete({
        url: consts.BASE_URL + 'applications/' + appId,
        headers: utils.makeHeaders(userId, 'write_applications')
    }, function (err, res, body) {
        if (204 != res.statusCode)
            throw Error("Deleting application failed: " + utils.getText(body));
        callback();
    });
};

utils.deleteApplicationAsync = async function (appId, userId) {
    return new Promise(resolve => utils.deleteApplication(appId, userId, resolve));
};

utils.addOwner = function (appId, userId, email, role, callback) {
    request.post({
        url: consts.BASE_URL + 'applications/' + appId + '/owners',
        headers: utils.makeHeaders(userId, 'write_applications'),
        json: true,
        body: {
            email: email,
            role: role
        }
    }, function (err, res, body) {
        if (201 != res.statusCode)
            throw Error("Could not add owner '" + email + "' to application '" + appId + "': " + utils.getText(body));
        callback();
    });
};

utils.addOwnerAsync = async function (appId, userId, email, role) {
    return new Promise(resolve => utils.addOwner(appId, userId, email, role, resolve));
};

utils.deleteOwner = function (appId, userId, email, callback) {
    request.delete(
        {
            url: consts.BASE_URL + 'applications/' + appId + '/owners?userEmail=' + email,
            headers: utils.makeHeaders(userId, 'write_applications')
        },
        function (err, res, body) {
            if (200 != res.statusCode)
                throw Error("Deleting owner '" + email + "' from application '" + appId + "' failed: " + utils.getText(body));
            callback();
        });
};

utils.deleteOwnerAsync = async function (appId, userId, email) {
    return new Promise(resolve => utils.deleteOwner(appId, userId, email, resolve));
};

utils.addSubscription = function (appId, userId, apiId, plan, apikey, callback) {
    request.post({
        url: consts.BASE_URL + 'applications/' + appId + '/subscriptions',
        headers: utils.makeHeaders(userId, 'write_subscriptions'),
        json: true,
        body: {
            application: appId,
            api: apiId,
            plan: plan,
            apikey: apikey
        }
    }, function (err, res, body) {
        if (201 != res.statusCode)
            throw Error("Could not add subscription: " + utils.getText(body));
        callback(null, utils.getJson(body));
    });
};

utils.addSubscriptionAsync = async function (appId, userId, apiId, plan, apikey) {
    return new Promise((resolve, reject) => utils.addSubscription(appId, userId, apiId, plan, apikey, function (err, body) {
        err ? reject(err) : resolve(body);
    }));
};

utils.deleteSubscription = function (appId, userId, apiId, callback) {
    request.delete({
        url: consts.BASE_URL + 'applications/' + appId + '/subscriptions/' + apiId,
        headers: utils.makeHeaders(userId, 'write_subscriptions')
    }, function (err, res, body) {
        if (204 != res.statusCode)
            throw Error("Could not delete subscription: " + utils.getText(body));
        callback();
    });
};

utils.deleteSubscriptionAsync = async function (appId, userId, apiId) {
    return new Promise(resolve => utils.deleteSubscription(appId, userId, apiId, resolve));
};

utils.approveSubscription = function (appId, apiId, adminUserId, callback) {
    request.patch({
        url: consts.BASE_URL + 'applications/' + appId + '/subscriptions/' + apiId,
        headers: utils.makeHeaders(adminUserId, 'write_subscriptions'),
        json: true,
        body: { approved: true }
    }, function (err, res, body) {
        if (err || 200 != res.statusCode)
            throw new Error("Could not approve subscription for app " + appId + " to API " + apiId);
        callback();
    });
};

utils.approveSubscriptionAsync = async function (appId, apiId, adminUserId) {
    return new Promise(resolve => utils.approveSubscription(appId, apiId, adminUserId, resolve));
};

utils.createListener = function (listenerId, listenerUrl, callback) {
    request.put({
        url: consts.BASE_URL + 'webhooks/listeners/' + listenerId,
        headers: utils.makeHeaders('1', 'webhooks'),
        json: true,
        body: {
            id: listenerId,
            url: listenerUrl
        }
    }, function (err, apiResponse, apiBody) {
        if (err)
            throw err;
        if (200 != apiResponse.statusCode)
            throw new Error("Could not create listener: " + utils.getText(apiBody));
        callback();
    });
};

utils.deleteListener = function (listenerId, callback) {
    request.delete({
        url: consts.BASE_URL + 'webhooks/listeners/' + listenerId,
        headers: utils.makeHeaders('1', 'webhooks')
    }, function (err, apiResponse, apiBody) {
        if (err)
            throw err;
        if (204 != apiResponse.statusCode)
            throw new Error("Could not delete listener: " + utils.getText(apiBody));
        callback();
    });
};

utils.findWithName = function (someArray, name) {
    for (let i = 0; i < someArray.length; ++i) {
        if (someArray[i].name === name)
            return someArray[i];
    }
    return null;
};

utils.awaitEmptyQueue = function (queueName, userId, callback) {
    const maxCount = 80;
    const timeOut = 400;
    const _awaitEmptyQueue = function (tryCount) {
        if (tryCount >= maxCount)
            return callback(new Error('awaitEmptyQueue: Max count of ' + maxCount + ' was reached: ' + tryCount));
        request.get({
            url: consts.BASE_URL + 'webhooks/events/' + queueName,
            headers: utils.makeHeaders(userId, 'webhooks')
        }, function (err, res, body) {
            if (err)
                return callback(err);
            if (res.statusCode !== 200)
                return callback(new Error('awaitEmptyQueue: GET of events for ' + queueName + ' returns status code ' + res.statusCode));
            const queue = utils.getJson(body);
            if (queue.length === 0) {
                if (tryCount > 4)
                    console.log('INFO: awaitEmptyQueue needed ' + tryCount + ' tries.');
                return callback(null);
            }
            setTimeout(_awaitEmptyQueue, timeOut, tryCount + 1);
        });
    };

    // Let the queue build up first before hammering the API.
    setTimeout(_awaitEmptyQueue, 500, 1);
};

utils.awaitEmptyQueueAsync = async function (queueName, userId) {
    return new Promise(resolve => utils.awaitEmptyQueue(queueName, userId, resolve));
};

utils.kongGet = function (url, expectedStatusCode, callback) {
    let thisCallback = callback;
    let thisStatusCode = expectedStatusCode;
    if (!callback &&
        (typeof (expectedStatusCode) == 'function')) {
        thisCallback = expectedStatusCode;
        thisStatusCode = 200;
    }
    request.get({
        url: consts.KONG_ADMIN_URL + url
    }, function (err, res, body) {
        if (err)
            throw err;
        if (res.statusCode !== thisStatusCode)
            throw new Error('kongGet of ' + url + ' return unexpected status code: ' + res.statusCode + ' vs. expected ' + thisStatusCode);
        thisCallback(null, {
            res: res,
            body: utils.getJson(body)
        });
    });
};

utils.kongGetAsync = async function (url, expectedStatusCode) {
    if (!expectedStatusCode)
        expectedStatusCode = 200;
    return new Promise((resolve, reject) => utils.kongGet(url, expectedStatusCode, function (err, result) {
        err ? reject(err) : resolve(result);
    }));
};

utils.resyncAsync = async function () {
    return new Promise((resolve, reject) => {
        request.post({
            url: consts.KONG_ADAPTER_URL + 'resync'
        }, function (err, res, body) {
            if (err)
                reject(err);
            if (res.statusCode !== 200)
                reject(new Error('Resync status code not 200'));
            const jsonBody = utils.getJson(body);
            resolve(jsonBody);
        });
    });
};

module.exports = utils;
