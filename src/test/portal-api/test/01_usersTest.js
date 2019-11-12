'use strict';

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL;

const WRITE_USERS_SCOPE = 'write_users';
const READ_USERS_SCOPE = 'read_users';
const INVALID_SCOPE = 'invalid_users';
const LOGIN_SCOPE = 'login';

describe('/users', function () {

    let adminUserId = '';
    let devUserId = '';
    let noobUserId = '';

    describe('POST', function () {
        it('should return the new ID of a newly created user', function (done) {
            const myBody = {
                customId: 'xyz',
                email: 'foo@foo.foo',
                validated: true,
                groups: ["dev"]
            };
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: myBody
            }, function (err, res, body) {
                assert.equal(201, res.statusCode, "status code not 201");
                const jsonBody = utils.getJson(body);
                devUserId = jsonBody.id;
                assert.isOk(devUserId);
                done();
            });
        });

        it('should return a 409 if the email address is duplicate.', function (done) {
            const myBody = {
                customId: 'zyx',
                email: 'foo@foo.foo',
                validated: true,
                groups: ["dev"]
            };
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: myBody
            }, function (err, res, body) {
                assert.equal(409, res.statusCode, "status code not 409, duplicate not detected");
                done();
            });
        });

        it('should return a 409 if the custom ID is duplicate.', function (done) {
            const myBody = {
                customId: 'xyz',
                email: 'foo2@foo.foo',
                validated: true,
                groups: ["dev"]
            };
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: myBody
            }, function (err, res, body) {
                assert.equal(409, res.statusCode, "status code not 409, duplicate not detected");
                done();
            });
        });

        it('should be possible to add a user without a group', function (done) {
            const myBody = {
                customId: '123',
                email: 'noob@noob.com',
                validated: false,
                groups: []
            };
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: myBody
            }, function (err, res, body) {
                assert.equal(201, res.statusCode, "status code not 201");
                const jsonBody = utils.getJson(body);
                noobUserId = jsonBody.id;
                assert.isOk(noobUserId);
                done();
            });
        });

        it('should be possible to add an admin user', function (done) {
            const myBody = {
                customId: 'abc',
                email: 'admin@admin.com',
                validated: false,
                groups: ["admin"]
            };
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: myBody
            }, function (err, res, body) {
                assert.equal(201, res.statusCode, "status code not 201");
                const jsonBody = utils.getJson(body);
                adminUserId = jsonBody.id;
                assert.isOk(adminUserId);
                done();
            });
        });

        // This functionality does not exist anymore. It's not what you should do with
        // OAuth2.
        //
        // it('should render OAuth credentials if belonging to correct group', function (done) {
        //     utils.createUser('OAuth', 'dev', true, function (userId) {
        //         utils.getUser(userId, function (userInfo) {
        //             utils.deleteUser(userId, function () {
        //                 assert.isOk(userInfo);
        //                 assert.isOk(userInfo.clientId);
        //                 assert.isOk(userInfo.clientSecret);
        //                 done();
        //             });
        //         });
        //     });
        // });

        // it('should not render OAuth credentials if not belonging to correct group', function (done) {
        //     utils.createUser('OAuth', null, false, function (userId) {
        //         utils.getUser(userId, function (userInfo) {
        //             utils.deleteUser(userId, function () {
        //                 assert.isOk(userInfo);
        //                 assert.isNotOk(userInfo.clientId);
        //                 assert.isNotOk(userInfo.clientSecret);
        //                 done();
        //             });
        //         });
        //     });
        // });

        // it('should not render OAuth credentials if not validated', function (done) {
        //     utils.createUser('OAuth', 'dev', false, function (userId) {
        //         utils.getUser(userId, function (userInfo) {
        //             utils.deleteUser(userId, function () {
        //                 assert.isOk(userInfo);
        //                 assert.isNotOk(userInfo.clientId);
        //                 assert.isNotOk(userInfo.clientSecret);
        //                 done();
        //             });
        //         });
        //     });
        // });

        it('should not set the user group for a non-validated user', function (done) {
            utils.createUser('Whatever', null, false, function (userId) {
                utils.getUser(userId, function (userInfo) {
                    utils.deleteUser(userId, function () {
                        assert.isTrue(!userInfo.groups || userInfo.groups.length === 0);
                        done();
                    });
                });
            });
        });

        it('should set the user group for a validated user', function (done) {
            utils.createUser('Whatever', null, true, function (userId) {
                utils.getUser(userId, function (userInfo) {
                    utils.deleteUser(userId, function () {
                        assert.isOk(userInfo);
                        assert.isOk(userInfo.groups);
                        assert.equal(1, userInfo.groups.length);
                        assert.equal("dev", userInfo.groups[0]);
                        done();
                    });
                });
            });
        });
    }); // /users POST

    describe('GET', function () {
        it('should return a list of short infos', function (done) {
            request({
                url: baseUrl + 'users',
                headers: utils.makeHeaders(adminUserId, READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.isArray(jsonBody.items);
                // Admin and three Initial Users are predefined, we added three users
                assert.equal(jsonBody.count, 7);
                assert.isTrue(jsonBody.hasOwnProperty('count_cached'));
                assert.equal(jsonBody.items.length, 7);
                done();
            });
        });

        it('should return 403 if no user is passed', function (done) {
            request({
                url: baseUrl + 'users'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should return 403 if the wrong scope is passed', function (done) {
            request({
                url: baseUrl + 'users',
                headers: utils.makeHeaders(adminUserId, INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should return 403 if non-admin user is passed', function (done) {
            request({
                url: baseUrl + 'users',
                headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should return 400 if invalid user is passed', function (done) {
            request({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('invaliduser', READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should return a user by customId', function (done) {
            request({
                url: baseUrl + 'users?customId=xyz',
                headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal(devUserId, jsonBody[0].id);
                done();
            });
        });

        it('should return a 403 for search user by customId of wrong scope is passed', function (done) {
            request({
                url: baseUrl + 'users?customId=xyz',
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should return a 404 if customId is not found', function (done) {
            request({
                url: baseUrl + 'users?customId=invalidId',
                headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should return a user by email', function (done) {
            request({
                url: baseUrl + 'users?email=noob@noob.com',
                headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal(noobUserId, jsonBody[0].id);
                done();
            });
        });

        it('should return a 404 if email is not found', function (done) {
            request({
                url: baseUrl + 'users?email=invalid@email.com',
                headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                done();
            });
        });
    }); // /users GET

    describe('/<userId>', function () {
        describe('GET', function () {
            it('should return the user.', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode, 'status code not 200');
                    const jsonBody = utils.getJson(body);
                    assert.equal(devUserId, jsonBody.id);
                    done();
                });
            });

            it('should return 403 if the scope is invalid ', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(devUserId, INVALID_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should return valid HAL _links.', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(devUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode, 'status code not 200');
                    const jsonBody = utils.getJson(body);
                    assert.equal(devUserId, jsonBody.id);
                    assert.isOk(jsonBody._links);
                    assert.isOk(jsonBody._links.self);
                    assert.equal(jsonBody._links.self.href, '/users/' + devUserId);
                    done();
                });
            });

            it('should return a 403 if X-Authenticated-UserId is not passed', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.onlyScope(READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should return a 403 if invalid X-Authenticated-UserId is passed', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders('something invalid', READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should return a 403 if X-Authenticated-UserId of different user is passed', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(noobUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should succeed if admin X-Authenticated-UserId is passed', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(adminUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode, 'status code not 200');
                    done();
                });
            });

            it('should return 403 if admin X-Authenticated-UserId but wrong scope is passed', function (done) {
                request({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(adminUserId, INVALID_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should be able to read second user', function (done) {
                request({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode, 'status code not 200');
                    done();
                });
            });
        }); // /users/<userId> GET

        describe('PATCH', function () {
            it('should allow changing the email address', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_USERS_SCOPE),
                    json: true,
                    body: {
                        email: 'new@new.com'
                    }
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal('new@new.com', jsonBody.email);
                    done();
                });
            });

            it('should return 403 if wrong scope is passed in', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, INVALID_SCOPE),
                    json: true,
                    body: {
                        email: 'evennewer@new.com'
                    }
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode);
                    done();
                });
            });

            it('should return 403 if a non-admin user tries to change the groups', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_USERS_SCOPE),
                    json: true,
                    body: {
                        groups: ['admin']
                    }
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal('Not allowed. Only admins can change a user\'s groups.', jsonBody.message, 'Unexpected error message.');
                    done();
                });
            });

            it('should return 403 if a non-admin user tries to change the validated property', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_USERS_SCOPE),
                    json: true,
                    body: {
                        validated: true
                    }
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal('Not allowed. Only admins can change a user\'s validated email status.', jsonBody.message, 'Unexpected error message.');
                    done();
                });
            });

            // it('should allow changing the name', function (done) {
            //     request(
            //         {
            //             method: 'PATCH',
            //             url: baseUrl + 'users/' + noobUserId,
            //             headers: utils.makeHeaders(noobUserId, WRITE_SCOPE),
            //             json: true,
            //             body: {
            //                 email: 'new@new.com'
            //             }
            //         },
            //         function (err, res, body) {
            //             assert.isNotOk(err);
            //             assert.equal(200, res.statusCode);
            //             // Now GET the user and check it's okay
            //             request(
            //                 {
            //                     url: baseUrl + 'users/' + noobUserId,
            //                     headers: utils.makeHeaders(noobUserId, READ_SCOPE)
            //                 },
            //                 function (err, res, body) {
            //                     assert.equal(200, res.statusCode);
            //                     const jsonBody = utils.getJson(body);
            //                     assert.equal('new@new.com', jsonBody.email);
            //                     assert.equal(true, jsonBody.validated);
            //                     done();
            //                 });
            //         });
            // });

            it('should forbid changing the custom ID', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_USERS_SCOPE),
                    json: true,
                    body: { customId: 'fhkdjfhkdjf' }
                }, function (err, res, body) {
                    assert.equal(400, res.statusCode);
                    done();
                });
            });

            it('should forbid changing a different user', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(devUserId, WRITE_USERS_SCOPE),
                    json: true,
                    body: {
                        email: 'helmer@fudd.com'
                    }
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode);
                    done();
                });
            });

            it('... except if you\'re an admin', function (done) {
                request.patch({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(adminUserId, WRITE_USERS_SCOPE),
                    json: true,
                    body: {
                        email: 'helmer@fudd.com'
                    }
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.equal('helmer@fudd.com', jsonBody.email);
                    done();
                });
            });

            it('should have actually changed things', function (done) {
                request({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode, 'status code not 200');
                    const jsonBody = utils.getJson(body);
                    assert.equal('helmer@fudd.com', jsonBody.email);
                    done();
                });
            });

            it('should have actually changed things in the short list', function (done) {
                request({
                    url: baseUrl + 'users?customId=123',
                    headers: utils.makeHeaders(noobUserId, READ_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(200, res.statusCode, 'status code not 200');
                    const jsonBody = utils.getJson(body);
                    assert.equal(1, jsonBody.length);
                    assert.equal('helmer@fudd.com', jsonBody[0].email);
                    done();
                });
            });
        }); // /users/<userId> PATCH

        describe('DELETE', function () {
            it('should return 404 if user does not exist', function (done) {
                request.delete({
                    url: baseUrl + 'users/doesnotexist',
                    headers: utils.makeHeaders(adminUserId, WRITE_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(404, res.statusCode, 'status code not 404');
                    done();
                });
            });

            it('should return 403 if user does not match X-Authenticated-UserId', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should return 403 if X-Authenticated-UserId is invalid', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders('somethinginvalid', WRITE_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode, 'status code not 403');
                    done();
                });
            });

            it('should return 409 if user has applications', function (done) {
                utils.createApplication('application', 'Application', devUserId, function () {
                    request.delete({
                        url: baseUrl + 'users/' + devUserId,
                        headers: utils.makeHeaders(devUserId, WRITE_USERS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(409, res.statusCode);
                        utils.deleteApplication('application', devUserId, function () {
                            done();
                        });
                    });
                });
            });

            it('should return 403 if wrong scope is passed in', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, INVALID_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode);
                    done();
                });
            });

            it('should return 204 if successful', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + noobUserId,
                    headers: utils.makeHeaders(noobUserId, WRITE_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(204, res.statusCode);
                    done();
                });
            });

            it('should not allow admins to delete users if using wrong scope', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(adminUserId, INVALID_SCOPE)
                }, function (err, res, body) {
                    assert.equal(403, res.statusCode);
                    done();
                });
            });

            it('should allow admins to delete users', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(adminUserId, WRITE_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(204, res.statusCode);
                    done();
                });
            });

            it('should allow admins to delete themself', function (done) {
                request.delete({
                    url: baseUrl + 'users/' + adminUserId,
                    headers: utils.makeHeaders(adminUserId, WRITE_USERS_SCOPE)
                }, function (err, res, body) {
                    assert.equal(204, res.statusCode);
                    done();
                });
            });
        }); // /users/<userId> DELETE
    }); // /users/<userId>

    describe('with password,', function () {
        this.slow(500);

        let pwdUserId = '';
        let devUserId = '';

        after(function (done) {
            utils.deleteUser(pwdUserId, function () {
                utils.deleteUser(devUserId, done);
            });
        });

        it('should be possible to create a user with a password', function (done) {
            request.post({
                url: baseUrl + 'users',
                json: true,
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                body: {
                    firstName: 'Secret',
                    lastName: 'User',
                    email: 'secret@user.com',
                    password: 'super$3cret!',
                    groups: [],
                    validated: true
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(201, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isNotOk(jsonBody.password);
                assert.isOk(jsonBody.id, 'create user must return the new ID');
                pwdUserId = jsonBody.id;
                done();
            });
        });

        it('should be possible to login a user by email and password', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'secret@user.com',
                    password: 'super$3cret!'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal(jsonBody[0].id, pwdUserId);
                assert.isNotOk(jsonBody[0].password);
                done();
            });
        });

        it('should not be possible to verify a user by email and password with a wrong scope', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', INVALID_SCOPE),
                body: {
                    email: 'secret@user.com',
                    password: 'super$3cret!'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should not be possible to verify user and password with a user which is non-admin', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders(pwdUserId, LOGIN_SCOPE),
                body: {
                    email: 'secret@user.com',
                    password: 'super$3cret!'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal('Not allowed. Only admin users can verify a user by email and password.', jsonBody.message, 'Unexpected error message');
                done();
            });
        });

        it('should return a 403 if email is correct and password wrong', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'secret@user.com',
                    password: 'super$3cret'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal('Password not correct or user not found.', jsonBody.message, 'Unexpected error message');
                done();
            });
        });

        it('should be possible to update the password', function (done) {
            request.patch({
                url: baseUrl + 'users/' + pwdUserId,
                headers: utils.makeHeaders(pwdUserId, WRITE_USERS_SCOPE),
                json: true,
                body: {
                    password: 'm0re$3kriT!'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.isNotOk(jsonBody.password);
                done();
            });
        });

        it('should be possible to verify a user by email and the new password', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'secret@user.com',
                    password: 'm0re$3kriT!'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal(jsonBody[0].id, pwdUserId);
                assert.isNotOk(jsonBody[0].password);
                done();
            });
        });

        it('should return a 400 if user has no password', function (done) {
            utils.createUser('Whatever', 'dev', true, function (userId) {
                devUserId = userId;
                request.post({
                    url: baseUrl + 'login',
                    headers: utils.makeHeaders('1', LOGIN_SCOPE),
                    body: {
                        email: 'whatever@random.org',
                        password: 'doesntmatter'
                    },
                    json: true
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    done();
                });
            });
        });

        it('should return a 404 if user email is not found', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'whenever@random.org',
                    password: 'doesntmatter'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(404, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal('User not found or password not correct.', jsonBody.message, 'Unexpected error message.');
                done();
            });
        });

        it('should not allow too short passwords', function (done) {
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: {
                    firstName: 'Secret',
                    lastName: 'User',
                    email: 'secret@user.com',
                    password: 'short',
                    groups: [],
                    validated: true
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should not allow too long passwords', function (done) {
            request.post({
                url: baseUrl + 'users',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE),
                json: true,
                body: {
                    firstName: 'Secret',
                    lastName: 'User',
                    email: 'secret@user.com',
                    password: '1234567890123456789012345',
                    groups: [],
                    validated: true
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should be possible to log in as the predefined user', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'initial@user.com',
                    password: 'password'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal(jsonBody[0].id, '1234567890');
                assert.isNotOk(jsonBody[0].password);
                done();
            });
        });

        it('should not be possible to remove the password from a user with a wrong scope', function (done) {
            request.delete({
                url: baseUrl + 'users/1234567890/password',
                headers: utils.makeHeaders('1', INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should be possible to remove the password from a user', function (done) {
            request.delete({
                url: baseUrl + 'users/1234567890/password',
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(204, res.statusCode);
                done();
            });
        });

        it('should not be possible to log in to this user after removing password', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'initial@user.com',
                    password: 'password'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should be possible to re-define the password for a different user, as admin', function (done) {
            request.patch({
                url: baseUrl + 'users/1234567890',
                json: true,
                body: { password: 'password1' },
                headers: utils.makeHeaders('1', WRITE_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should not be possible to redefine the password for a different user, as non-admin', function (done) {
            request.patch({
                url: baseUrl + 'users/1',
                json: true,
                body: { password: 'password2' },
                headers: utils.makeHeaders('9876543210', WRITE_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(403, res.statusCode);
                done();
            });
        });

        it('should be possible to re-define the password', function (done) {
            request.patch({
                url: baseUrl + 'users/1234567890',
                json: true,
                body: { password: 'supersecret' },
                headers: utils.makeHeaders('1234567890', WRITE_USERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should be possible to log in as the predefined user again after re-defining password', function (done) {
            request.post({
                url: baseUrl + 'login',
                headers: utils.makeHeaders('1', LOGIN_SCOPE),
                body: {
                    email: 'initial@user.com',
                    password: 'supersecret'
                },
                json: true
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                const jsonBody = utils.getJson(body);
                assert.equal(1, jsonBody.length);
                assert.equal(jsonBody[0].id, '1234567890');
                assert.isNotOk(jsonBody[0].password);
                done();
            });
        });
    });

    describe('/machine', () => {

        let machineUserId;
        after((done) => {
            utils.deleteUser(machineUserId, done);
        });

        it('should return a 403 if called with via Kong', (done) => {
            request.post({
                url: baseUrl + 'users/machine',
                headers: {
                    'X-Consumer-Custom-Id': 'abcdefgh'
                },
                json: true,
                body: {
                    customId: 'internal:foo',
                    email: 'foo@wicked.haufe.io',
                    validated: true,
                    groups: ["admin"]
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertKongReject(res, body);
                done();
            });
        });

        it('should return 400 if the machine user does not have a custom ID', (done) => {
            request.post({
                url: baseUrl + 'users/machine',
                headers: {},
                json: true,
                body: {
                    email: 'foo@wicked.haufe.io',
                    validated: true,
                    groups: ["admin"]
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode, 'Unexpected status code');
                const jsonBody = utils.getJson(body);
                assert.equal('Machines users must have a custom ID', jsonBody.message, 'Unexpected error message');
                done();
            });
        });

        it('should return 400 if the machine user custom ID does not start with "internal:"', (done) => {
            request.post({
                url: baseUrl + 'users/machine',
                headers: {},
                json: true,
                body: {
                    customId: 'infernal:foo',
                    email: 'foo@wicked.haufe.io',
                    validated: true,
                    groups: ["admin"]
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode, 'Unexpected status code');
                const jsonBody = utils.getJson(body);
                assert.equal('Machine user customId must start with "internal:"', jsonBody.message, 'Unexpected error message');
                done();
            });
        });

        it('should return 400 if the machine user has a password', (done) => {
            request.post({
                url: baseUrl + 'users/machine',
                headers: {},
                json: true,
                body: {
                    customId: 'internal:foo',
                    email: 'foo@wicked.haufe.io',
                    password: 'p@assw0rd!',
                    validated: true,
                    groups: ["admin"]
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode, 'Unexpected status code');
                const jsonBody = utils.getJson(body);
                assert.equal('Machine users must not have a password', jsonBody.message, 'Unexpected error message');
                done();
            });
        });

        it('should be possible to create a machine user', (done) => {
            request.post({
                url: baseUrl + 'users/machine',
                headers: {},
                json: true,
                body: {
                    customId: 'internal:foo',
                    email: 'foo@wicked.haufe.io',
                    validated: true,
                    groups: ["admin"]
                }
            }, function (err, res, body) {
                assert.equal(201, res.statusCode, "status code not 201");
                const jsonBody = utils.getJson(body);
                machineUserId = jsonBody.id;
                assert.isOk(machineUserId);
                done();
            });
        });

        it('should not be possilble to create a machine user with an invalid email', (done) => {
            request.post({
                url: baseUrl + 'users/machine',
                headers: {},
                json: true,
                body: {
                    customId: 'internal:whatever',
                    email: 'foo@whatever',
                    validated: true,
                    groups: ["admin"]
                }
            }, function (err, res, body) {
                assert.equal(400, res.statusCode, "status code not 400");
                const jsonBody = utils.getJson(body);
                assert.equal('Email address invalid (not RFC 5322 compliant)', jsonBody.message, 'Unexpected error message');
                done();
            });
        });
    });
}); // /users
