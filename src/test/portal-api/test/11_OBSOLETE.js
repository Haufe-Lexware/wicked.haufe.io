'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;
const AUTH_KEY = 'ThisIsUsedInDeploy';

// describe('/deploy', function () {
//     describe('/export', function () {
//         it('should not be possible to trigger an export without authorization', function (done) {
//             request.post({
//                 url: baseUrl + 'deploy/export'
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 assert.equal(403, res.statusCode);
//                 done();
//             });
//         });

//         it('should not be possible to trigger an export with a faulty authorization', function (done) {
//             request.post({
//                 url: baseUrl + 'deploy/export',
//                 headers: { 'Authorization': 'a' + AUTH_KEY }
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 assert.equal(403, res.statusCode);
//                 done();
//             });
//         });

//         var exportId = null;

//         it('should be possible to trigger an export with the correct key', function (done) {
//             request.post({
//                 url: baseUrl + 'deploy/export',
//                 headers: { 'Authorization': AUTH_KEY }
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 var jsonBody = utils.getJson(body);
//                 assert.isOk(jsonBody.exportId);
//                 exportId = jsonBody.exportId;
//                 done();
//             });
//         });

//         it('should be possible to retrieve the status of an export', function (done) {
//             request.get({
//                 url: baseUrl + 'deploy/export/' + exportId + '/status',
//                 headers: { 'Authorization': AUTH_KEY }
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 assert.isTrue(res.statusCode < 299);
//                 done();
//             });
//         });

//         it('should eventually return a DONE status after an export', function (done) {
//             this.slow(500);
//             var checkStatus = function (tryCount, callback) {
//                 if (tryCount > 10)
//                     return callback(new Error('Try count exceeded (10)'));
//                 request.get({
//                     url: baseUrl + 'deploy/export/' + exportId + '/status',
//                     headers: { 'Authorization': AUTH_KEY }
//                 }, function (err, res, body) {
//                     if (err)
//                         return callback(err);
//                     if (res.statusCode == 200)
//                         return callback(null, true);
//                     setTimeout(checkStatus, 100, tryCount + 1, callback);
//                 });
//             };

//             checkStatus(0, function (err) {
//                 assert.isNotOk(err);
//                 done();
//             });
//         });

//         it('should be possible to download the archive', function (done) {
//             request.get({
//                 url: baseUrl + 'deploy/export/' + exportId + '/data',
//                 headers: { 'Authorization': AUTH_KEY }
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 assert.equal(200, res.statusCode);
//                 assert.isTrue(res.headers['content-type'].indexOf('octet-stream') >= 0);
//                 done();
//             });
//         });

//         it('should not be possible to add a user during export', function (done) {
//             request.post({
//                 url: baseUrl + 'users',
//                 json: true,
//                 body: {
//                     firstName: 'Daniel',
//                     lastName: 'Developer',
//                     email: 'dan@developer.com',
//                     customId: 'SJFJHDSFGJHDFGJDF'
//                 }
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 // 423 means "locked"
//                 assert.equal(423, res.statusCode);
//                 done();
//             });
//         });

//         it('should be possible to cancel the export', function (done) {
//             request.delete({
//                 url: baseUrl + 'deploy/export/' + exportId,
//                 headers: { 'Authorization': AUTH_KEY }
//             }, function (err, res, body) {
//                 assert.isNotOk(err);
//                 assert.equal(204, res.statusCode);
//                 done();
//             });
//         });

//         it('should be possible to add and delete users again after cancelling the export', function (done) {
//             utils.createUser('Huppala', 'dev', true, function (userId) {
//                 utils.deleteUser(userId, function() {
//                     // If we get here, we're good.
//                     done();
//                 });
//             });
//         });
//     });
// });