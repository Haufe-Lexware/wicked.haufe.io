'use strict';

const assert = require('chai').assert;
const async = require('async');
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;
const poolId = 'wicked';
const READ_AUDITLOG_SCOPE = 'read_auditlog';
const WRITE_AUDITLOG_SCOPE = 'write_auditlog';
const publicApi = 'superduper';

describe('/auditlog', function () {

    this.timeout(5000);

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';
    let approverUserId = '';

    const now = new Date();
    now.setDate(now.getDate() + 1);      // Add a day since we use < from next day
    let eof_day_today = now.toISOString().slice(0, 10);

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Approver', ['approver', 'dev'], true, function (id) {
                approverUserId = id;
                utils.createUser('Admin', 'admin', true, function (id) {
                    adminUserId = id;
                    utils.createUser('Noob', null, true, function (id) {
                        noobUserId = id;
                        //cleanup audit log also 
                        utils.deleteAuditLog(eof_day_today, adminUserId, function () {
                            done();
                        });
                    });
                });
            });
        });

    });

    function addSomeRegistrations(callback) {
        utils.putRegistration(poolId, adminUserId, adminUserId, 'Admin User', null, (err) => {
            assert.isNotOk(err);
            utils.putRegistration(poolId, devUserId, adminUserId, 'Dan Developer', null, (err) => {
                assert.isNotOk(err);
                utils.putRegistration(poolId, noobUserId, adminUserId, 'Norah Noob', null, (err) => {
                    assert.isNotOk(err);
                    callback();
                });
            });
        });
    }

    function deleteSomeRegistrations(callback) {
        utils.deleteRegistration(poolId, adminUserId, null, true, (err) => {
            utils.deleteRegistration(poolId, devUserId, null, true, (err2) => {
                utils.deleteRegistration(poolId, noobUserId, null, true, (err3) => {
                    assert.isNotOk(err);
                    assert.isNotOk(err2);
                    assert.isNotOk(err3);
                    callback();
                });
            });
        });
    }


    // And delete them afterwards    
    after(function (done) {
        utils.deleteUser(noobUserId, function () {
            utils.deleteUser(approverUserId, function () {
                utils.deleteUser(adminUserId, function () {
                    utils.deleteUser(devUserId, function () {
                        done();
                    });
                });
            });
        });
    });

    describe('auditlog?embed=1', function () {
        const appList = ['abcde-hello', 'fghij-hello', 'klmno-world', 'pqrst-world', 'uvwxyz-world'];
        function makeAppInfo(appId) {
            return {
                id: appId,
                name: appId,
                description: appId,
                mainUrl: `https://${appId}.wicked.com`
            };
        }

        before(function (done) {
            addSomeRegistrations(function () {
                async.each(appList, (appId, callback) => {
                    utils.createApplication(appId, makeAppInfo(appId), devUserId, function () {
                        utils.addSubscription(appId, devUserId, publicApi, 'unlimited', null, function () {
                            utils.addOwner(appId, devUserId, 'noob@random.org', 'owner', callback);
                        });
                    });
                }, done);
            });
        });

        after(function (done) {
            deleteSomeRegistrations(function () {
                async.each(appList, (appId, callback) => {
                    utils.deleteSubscription(appId, devUserId, publicApi, function () {
                        utils.deleteApplication(appId, devUserId, callback);
                    });
                }, done);
            });
        });

        it('must be possible to retrieve auditlog as an admin', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.isAbove(jsonBody.items.length, 10);
                    assert.isAbove(jsonBody.count, 10);
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by activity', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22activity%22%3A%20%22add%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].action, "add");
                    assert.equal(jsonBody.items[1].action, "add");
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22activity%22%3A%20%22add%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by user name', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22user%22%3A%20%22Dan%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].user, "Dan Developer");
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22user%22%3A%20%22Dan%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by role and not find any row by \'Admin\' role', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22role%22%3A%20%22Admin%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.count, 0);
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22role%22%3A%20%22Admin%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by role', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22role%22%3A%20%22User%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].role, "User");
                    assert.isAbove(jsonBody.count, 1);
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22role%22%3A%20%22User%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by email', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22email%22%3A%20%22dev@random.org%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].user, "Dan Developer");
                    assert.equal(jsonBody.items[0].email, "dev@random.org");
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22email%22%3A%20%22dev@random.org%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by api', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22api%22%3A%20%22superduper%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].api, "superduper");
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22api%22%3A%20%22superduper%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by application', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22application%22%3A%20%22pqrst%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].application, "pqrst-world");
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22application%22%3A%20%22pqrst%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to retrieve auditlog as an admin and filter by plan', function (done) {
            if (utils.isPostgres()) {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22plan%22%3A%20%22unlimited%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.isOk(body);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal(jsonBody.items[0].plan, "unlimited");
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22plan%22%3A%20%22unlimited%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });

        it('must be possible to delete auditlog as an admin', function (done) {
            if (utils.isPostgres()) {
                request.delete({
                    uri: baseUrl + 'auditlog/' + eof_day_today,
                    headers: utils.makeHeaders(adminUserId, WRITE_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    done();
                });
            } else {
                request({
                    uri: baseUrl + 'auditlog?embed=1&no_cache=1&filter=%7B%0A%20%20%22plan%22%3A%20%22unlimited%22%0A%7D',
                    headers: utils.makeHeaders(adminUserId, READ_AUDITLOG_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 501);
                    done();
                });
            }
        });
    });
});