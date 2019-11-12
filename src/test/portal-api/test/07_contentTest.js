'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const READ_CONTENT_SCOPE = 'read_content';
const INVALID_SCOPE = 'invalid_content';

describe('/content', function () {

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                utils.createUser('Noob', null, false, function (id) {
                    noobUserId = id;
                    done();
                });
            });
        });
    });

    // And delete them afterwards    
    after(function (done) {
        utils.deleteUser(noobUserId, function () {
            utils.deleteUser(adminUserId, function () {
                utils.deleteUser(devUserId, function () {
                    done();
                });
            });
        });
    });

    function hasValidMetaHeader(response) {
        try {
            const metaInfo64 = response.headers['x-metainfo'];
            if (!metaInfo64)
                return false;
            const metaInfo = JSON.parse(new Buffer(metaInfo64, 'base64'));
            return true;
        } catch (err) {
            throw Error("Could not extract meta information: " + err);
        }
    }

    function isMarkdown(response) {
        const contentType = response.headers['content-type'];
        if (!contentType)
            return false;
        return contentType.startsWith('text/markdown');
    }

    describe('GET', function () {
        it('should return a 403 if using wrong scope', function (done) {
            request({
                uri: baseUrl + 'content',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return the index for empty subpaths', function (done) {
            request({
                uri: baseUrl + 'content',
                headers: utils.onlyScope(READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(hasValidMetaHeader(res));
                assert.isTrue(isMarkdown(res));
                done();
            });
        });

        it('should ignore invalid X-Authenticated-UserId for the index', function (done) {
            request({
                uri: baseUrl + 'content',
                headers: utils.makeHeaders('somethinginvalid', READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(hasValidMetaHeader(res));
                assert.isTrue(isMarkdown(res));
                done();
            });
        });

        it('should return a 404 if resource is not found', function (done) {
            request({
                uri: baseUrl + 'content/invaliduri',
                headers: utils.onlyScope(READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should return unrestricted resources without user id', function (done) {
            request({
                uri: baseUrl + 'content/example',
                headers: utils.onlyScope(READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(hasValidMetaHeader(res));
                assert.isTrue(isMarkdown(res));
                done();
            });
        });

        it('should return unrestricted resources with valid user id', function (done) {
            request({
                uri: baseUrl + 'content/example',
                headers: utils.makeHeaders(devUserId, READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(hasValidMetaHeader(res));
                assert.isTrue(isMarkdown(res));
                done();
            });
        });

        it('should allow access to restricted resources for users belonging to the group', function (done) {
            request({
                uri: baseUrl + 'content/restricted',
                headers: utils.makeHeaders(devUserId, READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(hasValidMetaHeader(res));
                assert.isTrue(isMarkdown(res));
                done();
            });
        });

        it('should allow access to restricted resources for admins', function (done) {
            request({
                uri: baseUrl + 'content/restricted',
                headers: utils.makeHeaders(adminUserId, READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(hasValidMetaHeader(res));
                assert.isTrue(isMarkdown(res));
                done();
            });
        });

        it('should return a 403 if user groups prevents access', function (done) {
            request({
                uri: baseUrl + 'content/restricted',
                headers: utils.makeHeaders(noobUserId, READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should return a 403 if accessing restricted content without user', function (done) {
            request({
                uri: baseUrl + 'content/restricted',
                headers: utils.onlyScope(READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertNotScopeReject(res, body);
                done();
            });
        });

        it('should return image resources without authentication', function (done) {
            request({
                uri: baseUrl + 'content/images/animal.jpg',
                headers: utils.onlyScope(READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return image resources even with invalid authentication', function (done) {
            request({
                uri: baseUrl + 'content/images/animal.jpg',
                headers: utils.makeHeaders('somethinginvalid', READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return correct content types for images', function (done) {
            request({
                uri: baseUrl + 'content/images/animal.jpg',
                headers: utils.onlyScope(READ_CONTENT_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                assert.isTrue(res.headers['content-type'].startsWith('image/jpeg'));
                done();
            });
        });
    });
});