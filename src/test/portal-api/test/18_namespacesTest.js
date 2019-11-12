'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL + 'pools/woo-ns/';

const READ_SCOPE = 'read_namespaces';
const WRITE_SCOPE = 'write_namespaces';
const INVALID_SCOPE = 'invalid_templates';

describe('/pools/:poolId/namespaces', () => {

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                done();
            });
        });
    });

    after(function (done) {
        utils.deleteUser(adminUserId, function () {
            utils.deleteUser(devUserId, function () {
                done();
            });
        });
    });

    it('should be possible to create a namespace as an admin', done => {
        request.put({
            url: baseUrl + 'namespaces/ns-a',
            headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
            json: true,
            body: {
                namespace: 'ns-a',
                description: 'Namespace A'
            }
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 204, 'Unexpected status code');
            done();
        });
    });

    it('should be possible to retrieve the created namespace', done => {
        request.get({
            url: baseUrl + 'namespaces/ns-a',
            headers: utils.makeHeaders(adminUserId, READ_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            const jsonBody = utils.getJson(body);
            assert.isOk(jsonBody);
            assert.equal(jsonBody.namespace, 'ns-a');
            assert.equal(jsonBody.description, 'Namespace A');
            done();
        });
    });

    it('should be possible to retrieve a list of namespaces', done => {
        request.get({
            url: baseUrl + 'namespaces',
            headers: utils.makeHeaders(adminUserId, READ_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            const jsonBody = utils.getJson(body);
            assert.isOk(jsonBody);
            assert.isArray(jsonBody.items);
            const ns = jsonBody.items.find(ns => ns.namespace === 'ns-a');
            assert.isOk(ns);
            assert.equal(ns.namespace, 'ns-a');
            assert.equal(ns.description, 'Namespace A');
            done();
        });
    });

    it('should not be possible to create a namespace with a wrong scope', done => {
        request.put({
            url: baseUrl + 'namespaces/ns-b',
            headers: utils.makeHeaders(adminUserId, INVALID_SCOPE),
            json: true,
            body: {
                namespace: 'ns-b',
                description: 'Namespace B'
            }
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });

    it('shold check whether path parameter and payload match', done => {
        request.put({
            url: baseUrl + 'namespaces/ns-c',
            headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
            json: true,
            body: {
                namespace: 'ns-b',
                description: 'Namespace B'
            }
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 400, 'Unexpected status code');
            done();
        });
    });

    it('should not be possible to create a namespace as a non-admin user', done => {
        request.put({
            url: baseUrl + 'namespaces/ns-c',
            headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
            json: true,
            body: {
                namespace: 'ns-c',
                description: 'Namespace C'
            }
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertNotScopeReject(res, body);
            done();
        });
    });

    it('should, as a non-admin user, not be possible to retrieve the created namespace', done => {
        request.get({
            url: baseUrl + 'namespaces/ns-a',
            headers: utils.makeHeaders(devUserId, READ_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertNotScopeReject(res, body);
            done();
        });
    });

    it('should, as a non-admin user, not be possible to retrieve a list of namespaces', done => {
        request.get({
            url: baseUrl + 'namespaces',
            headers: utils.makeHeaders(devUserId, READ_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertNotScopeReject(res, body);
            done();
        });
    });

    it('should not be possible to retrieve the created namespace with a wrong scope', done => {
        request.get({
            url: baseUrl + 'namespaces/ns-a',
            headers: utils.makeHeaders(adminUserId, INVALID_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });

    it('should not be possible to retrieve a list of namespaces with a wrong scope', done => {
        request.get({
            url: baseUrl + 'namespaces',
            headers: utils.makeHeaders(adminUserId, INVALID_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });

    it('should not be possible to create a namespace without a description', done => {
        request.put({
            url: baseUrl + 'namespaces/ns-d',
            headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
            json: true,
            body: {
                namespace: 'ns-d',
            }
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 400, 'Unexpected status code');
            done();
        });
    });

    it('should be possible to delete a namespace', done => {
        request.delete({
            url: baseUrl + 'namespaces/ns-a',
            headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 204, 'Unexpected status code');
            done();
        });
    });

    it('should have actually deleted the namespace', done => {
        request.get({
            url: baseUrl + 'namespaces/ns-a',
            headers: utils.makeHeaders(adminUserId, READ_SCOPE),
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 404);
            done();
        });
    });

    it('should not be possible to delete a namespace as a non-admin user', done => {
        request.delete({
            url: baseUrl + 'namespaces/ns-b',
            headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertNotScopeReject(res, body);
            done();
        });
    });

    it('should not be possible to delete a namespace using the wrong scope', done => {
        request.delete({
            url: baseUrl + 'namespaces/ns-b',
            headers: utils.makeHeaders(adminUserId, READ_SCOPE),
        }, (err, res, body) => {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });
});
