'use strict';

const assert = require('chai').assert;
const request = require('request');
const wicked = require('wicked-sdk');
const utils = require('./testUtils');
const consts = require('./testConsts');

describe('Authorization Code Grant', function () {

    this.slow(500);

    // let trustedClientId;
    // let trustedClientSecret;
    // let confidentialClientId;
    // let confidentialClientSecret;
    // let publicClientId;
    // let publicClientSecret;

    /*
    ids = {
        users: {
            normal: {
                id: 'kdlaskjdlkajskdasd',
                email: ...,
                password: ...
            },
            admin: {
                id: 'dlksjdlksjdlksld'
                ...
            }
        },
        trusted: {
            clientId: '...',
            clientSecret: '...',
            redirectUri: '...'
        },
        confidential: { ... },
        public: { ... },
        withoutUri: { ... }
    }
    */
    let ids;

    before(function (done) {
        this.timeout(20000);
        const now = new Date();
        utils.initAppsAndSubscriptions(function (err, idsAndSecrets) {
            assert.isNotOk(err);
            assert.isOk(idsAndSecrets);
            ids = idsAndSecrets;
            // console.log(JSON.stringify(ids, null, 2));
            console.log('Before handler took ' + (new Date() - now) + 'ms.');
            done();
        });
    });

    after(function (done) {
        this.timeout(20000);
        utils.destroyAppsAndSubcriptions(done);
    });

    // Now we have an application to play with
    describe('basic failure cases', function () {
        this.slow(250);

        it('should return a 404 for an invalid URL', function (done) {
            utils.authGet('local/opi/flubbs/authorize', function (err, res, body) {
                assert.equal(res.statusCode, 404);
                utils.assertIsHtml(body);
                done();
            });
        });

        it('should return an HTML error for missing response_type', function (done) {
            utils.authGet('local/api/echo/authorize', function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('Invalid response_type') >= 0);
                done();
            });
        });

        it('should return an HTML error for invalid response_type', function (done) {
            utils.authGet('local/api/echo/authorize?response_type=hoops', function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('Invalid response_type') >= 0);
                done();
            });
        });

        it('should return an HTML error for an invalid client_id', function (done) {
            utils.authGet('local/api/echo/authorize?response_type=code&client_id=invalid&redirect_uri=http://dummy.org', function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                // console.log(body);
                assert.isTrue(body.message.indexOf('could not validate') >= 0);
                done();
            });
        });

        it('should return an HTML error for a faulty redirect_uri', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=http://bla.com`, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.include(body.message, 'does not match any registered');
                done();
            });
        });

        it('should return a 401 if trying to get a token with an invalid code', function (done) {
            utils.authPost(`local/api/echo/token`, {
                grant_type: 'authorization_code',
                client_id: ids.confidential.echo.clientId,
                client_secret: ids.confidential.echo.clientSecret,
                code: 'thisisaninvalidcode'
            }, null, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 401, 'faulty status code');
                const jsonBody = utils.getJson(body);
                assert.isUndefined(jsonBody.access_token);
                assert.isDefined(jsonBody.error);
                assert.isDefined(jsonBody.error_description);
                done();
            });
        });
    });

    describe('basic success cases', function () {
        this.slow(2000);
        this.timeout(10000);

        it('should return a login screen for a valid authorize request', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, function (err, res, body) {
                assert.equal(res.statusCode, 200);
                utils.assertIsHtml(body);
                assert.equal('login', body.template);
                // console.log(body);
                done();
            });
        });

        it('should return a login screen for a valid authorize request (secondary redirectUri)', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI2}`, function (err, res, body) {
                assert.equal(res.statusCode, 200);
                utils.assertIsHtml(body);
                assert.equal('login', body.template);
                // console.log(body);
                done();
            });
        });

        it('should return a login screen for a valid authorize request (without redirect_uri)', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}`, function (err, res, body) {
                assert.equal(res.statusCode, 200);
                utils.assertIsHtml(body);
                assert.equal('login', body.template);
                // console.log(body);
                done();
            });
        });

        it('should return an auth code if logged in successfully', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(302, res.statusCode);
                    const redir = res.headers.location;
                    assert.isOk(redir);
                    //console.log(redir);
                    const redirUrl = new URL(redir);
                    assert.isOk(redirUrl.searchParams.get('code'));
                    done();
                });
            });
        });

        it('should return an auth code if logged in successfully (secondary redirectUri)', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI2}`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(302, res.statusCode);
                    const redir = res.headers.location;
                    assert.isOk(redir);
                    assert.isTrue(redir.startsWith(consts.REDIRECT_URI2), `redirect location ${redir} does not start with ${consts.REDIRECT_URI2}`);
                    //console.log(redir);
                    const redirUrl = new URL(redir);
                    assert.isOk(redirUrl.searchParams.get('code'));
                    done();
                });
            });
        });

        it('should return an auth code if logged in successfully (without redirect_uri)', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(302, res.statusCode);
                    const redir = res.headers.location;
                    assert.isOk(redir);
                    //console.log(redir);
                    const redirUrl = new URL(redir);
                    assert.isOk(redirUrl.searchParams.get('code'));
                    done();
                });
            });
        });

        it('should also return a token for an auth code (confidential client)', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCode(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, {}, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'authorization_code',
                    client_id: ids.confidential.echo.clientId,
                    client_secret: ids.confidential.echo.clientSecret,
                    code: code
                }, function (err, res, accessToken) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    assert.isOk(accessToken);
                    assert.isObject(accessToken);
                    assert.isOk(accessToken.access_token);
                    assert.isOk(accessToken.refresh_token);
                    assert.equal('bearer', accessToken.token_type);
                    done();
                });
            });
        });

        it('should be possible to use a refresh token (confidential client)', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCodeToken(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, {}, function (err, accessToken) {
                assert.isNotOk(err);
                assert.isObject(accessToken);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'refresh_token',
                    refresh_token: accessToken.refresh_token,
                    client_id: ids.confidential.echo.clientId,
                    client_secret: ids.confidential.echo.clientSecret
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    assert.isObject(body);
                    assert.isNotOk(body.error);
                    assert.isOk(body.access_token);
                    assert.isOk(body.refresh_token);
                    done();
                });
            });
        });

        it('should not be possible to use a refresh token without the client secret (confidential client)', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCodeToken(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, {}, function (err, accessToken) {
                assert.isNotOk(err);
                assert.isObject(accessToken);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'refresh_token',
                    refresh_token: accessToken.refresh_token,
                    client_id: ids.confidential.echo.clientId
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(401, res.statusCode);
                    assert.isObject(body);
                    assert.equal('unauthorized_client', body.error);
                    done();
                });
            });
        });
    });

    describe('rejection use cases', function () {
        it('should reject creating a token with a differing client_id/secret than the one used for getting the code', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCode(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, {}, function (err, code) {
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'authorization_code',
                    client_id: ids.trusted.echo.clientId,
                    client_secret: ids.trusted.echo.clientSecret,
                    code: code
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    assert.isObject(body);
                    assert.equal('invalid_request', body.error);
                    done();
                });
            });
        });

        it('should reject attempting to log in with an app without a redirect_uri', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.withoutUri.echo.clientId}&redirect_uri=http://bla.com`, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('does not have a registered redirect_uri') >= 0);
                done();
            });
        });

        it('should detect a faulty password (and redisplay login screen)', function (done) {
            this.slow(1200);
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                const now = new Date().getTime();
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: 'wrong_password'
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.assertIsHtml(body);
                    assert.isTrue((new Date() - now) > 500, 'operation must take longer than 500ms');
                    assert.equal(body.template, 'login');
                    assert.equal(body.errorMessage, 'Username or password invalid.');
                    assert.equal(body.prefillUsername, ids.users.normal.email);
                    done();
                });
            });
        });
    });

    describe('public clients', function () {
        this.slow(1000);
        this.timeout(10000);
        it('should reject doing the auth code grant with a public client without code_challenge', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${client.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.equal(body.template, 'error');
                assert.include(body.message, 'it must present a code_challenge');
                done();
            });
        });

        it('should accept doing the auth code grant with PKCE (plain challenge)', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.isOk(body.access_token);
                    assert.isNotOk(body.error);
                    done();
                });
            });
        });

        it('should immediately return an auth code if adding &prompt=none', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.getAuthCode(cookieJar, 'echo', client, null, { code_challenge: codeVerifier, prompt: 'none' }, function (err, code) {
                    assert.isNotOk(err);
                    assert.isOk(code);
                    done();
                });
            });
        });

        it('should immediately return an auth code if adding &prompt=none (using secondary redirectUri)', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.getAuthCode(cookieJar, 'echo', client, null, { code_challenge: codeVerifier, prompt: 'none', redirect_uri: consts.REDIRECT_URI2 }, function (err, code) {
                    assert.isNotOk(err);
                    assert.isOk(code);
                    done();
                });
            });
        });

        it('should return an error as a redirect if not logged in when using prompt=none', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, null, { code_challenge: codeVerifier, prompt: 'none', redirect_uri: consts.REDIRECT_URI2 }, function (err, code) {
                assert.isOk(err);
                assert.equal(err.message, 'login_required');
                done();
            });
        });

        it('should force login but return an auth code if adding &prompt=login', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, prompt: 'login' }, function (err, code) {
                    assert.isNotOk(err);
                    assert.isOk(code);
                    done();
                });
            });
        });

        it('should not return a refresh token for public clients', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.isOk(body.access_token);
                    assert.isUndefined(body.refresh_token);
                    assert.isNotOk(body.error);
                    done();
                });
            });
        });

        it('should accept doing the auth code grant with PKCE (S256 challenge)', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            // At least 43, max 128
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, code_challenge_method: 'S256' }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.isOk(body.access_token);
                    assert.isNotOk(body.error);
                    done();
                });
            });
        });

        it('should reject doing the auth code grant with PKCE (S256 challenge) with a too short code_verifier', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            // At least 43, max 128
            const codeVerifier = 'hello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, code_challenge_method: 'S256' }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 400);
                    assert.equal('invalid_request', body.error);
                    done();
                });
            });
        });

        it('should reject doing the auth code grant with PKCE (S256 challenge) with a too long code_verifier', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            // At least 43, max 128
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, code_challenge_method: 'S256' }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 400);
                    assert.equal('invalid_request', body.error);
                    done();
                });
            });
        });
    });

    describe('native clients', function () {
        this.slow(1000);
        this.timeout(10000);
        it('should reject doing the auth code grant with a public client without code_challenge', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${client.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.equal(body.template, 'error');
                assert.include(body.message, 'it must present a code_challenge');
                done();
            });
        });

        it('should accept doing the auth code grant with PKCE (plain challenge)', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.isOk(body.access_token);
                    assert.isNotOk(body.error);
                    done();
                });
            });
        });

        it('should force login but return an auth code if adding &prompt=login', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, prompt: 'login' }, function (err, code) {
                    assert.isNotOk(err);
                    assert.isOk(code);
                    done();
                });
            });
        });

        it('should return a refresh token for native clients', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.isOk(body.access_token);
                    assert.isOk(body.refresh_token);
                    assert.isNotOk(body.error);
                    done();
                });
            });
        });

        it('should accept doing the auth code grant with PKCE (S256 challenge)', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            // At least 43, max 128
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, code_challenge_method: 'S256' }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    assert.isOk(body.access_token);
                    assert.isNotOk(body.error);
                    done();
                });
            });
        });

        it('should reject doing the auth code grant with PKCE (S256 challenge) with a too short code_verifier', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            // At least 43, max 128
            const codeVerifier = 'hello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, code_challenge_method: 'S256' }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 400);
                    assert.equal('invalid_request', body.error);
                    done();
                });
            });
        });

        it('should reject doing the auth code grant with PKCE (S256 challenge) with a too long code_verifier', function (done) {
            const cookieJar = request.jar();
            const client = ids.native.echo;
            // At least 43, max 128
            const codeVerifier = 'hellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohello';
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, { code_challenge: codeVerifier, code_challenge_method: 'S256' }, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost('local/api/echo/token', {
                    client_id: client.clientId,
                    code_verifier: codeVerifier,
                    code: code,
                    grant_type: 'authorization_code'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 400);
                    assert.equal('invalid_request', body.error);
                    done();
                });
            });
        });
    });

    describe('trusted clients', function () {
        this.slow(1000);
        this.timeout(10000);
        it('should return a token with full scope for a trusted client', function (done) {
            const cookieJar = request.jar();
            const client = ids.trusted.echo;
            const user = ids.users.normal;
            utils.getAuthCodeToken(cookieJar, 'echo', client, user, {}, function (err, accessToken) {
                utils.callApi('echo', accessToken.access_token, 'GET', 'foo', null, function (err, res, body) {
                    assert.isNotOk(err);
                    // console.log(body);
                    // Echo API returns everything
                    assert.equal(body.headers['x-authenticated-userid'], `sub=${user.id}`);
                    assert.equal(body.headers['x-authenticated-scope'], 'get put post patch delete wicked:dev');
                    done();
                });
            });
        });
    });

    describe('misc security failures', function (done) {
        it('should return reject a login if not using a session (cannot resolve CSRF)', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    // console.log(res);
                    assert.equal(400, res.statusCode);
                    done();
                });
            });
        });
    });

    describe('granting access to applications', function () {

        it('should ask for access after logging in', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.confidential.echo.clientId}&scope=get`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    const csrfToken = body.csrfToken;
                    assert.isDefined(csrfToken);
                    // console.log(res);
                    assert.equal(res.statusCode, 200);
                    utils.assertIsHtml(body);
                    assert.equal(body.template, 'grant_scopes');
                    done();
                });
            });
        });

        it('should be possible to deny access after logging in', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.confidential.echo.clientId}&scope=get`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    const csrfToken = body.csrfToken;
                    assert.isDefined(csrfToken);
                    // console.log(body);
                    assert.equal(res.statusCode, 200);
                    utils.assertIsHtml(body);
                    assert.equal(body.template, 'grant_scopes');

                    utils.authPost(body.grantUrl, {
                        _csrf: csrfToken,
                        _action: 'deny'
                    }, cookieJar, function (err, res, body) {
                        assert.isNotOk(err);
                        utils.assertIsRedirectError(res, 'access_denied');
                        done();
                    });
                });
            });
        });

        it('should be possible to grant access after logging in', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.confidential.echo.clientId}&scope=get`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    const csrfToken = body.csrfToken;
                    assert.isDefined(csrfToken);
                    // console.log(body);
                    assert.equal(res.statusCode, 200);
                    utils.assertIsHtml(body);
                    assert.equal(body.template, 'grant_scopes');

                    utils.authPost(body.grantUrl, {
                        _csrf: csrfToken,
                        _action: 'allow'
                    }, cookieJar, function (err, res, body) {
                        assert.isNotOk(err);
                        utils.assertIsCodeRedirect(res, done);
                    });
                });
            });
        });

        it('should be possible to get a code for a granted scope', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCode(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, { scope: ['get'] }, function (err, code) {
                assert.isNotOk(err);
                assert.isDefined(code);
                done();
            });
        });

        it('after revoking a scope, it should not be possible to get a code for a granted scope', function (done) {
            const cookieJar = request.jar();
            wicked.deleteAllUserGrants(ids.users.normal.id, function (err) {
                assert.isNotOk(err);
                utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.confidential.echo.clientId}&scope=get`, cookieJar, function (err, res, body) {
                    const csrfToken = body.csrfToken;
                    assert.isOk(csrfToken);
                    utils.authPost(body.loginUrl, {
                        _csrf: csrfToken,
                        username: ids.users.normal.email,
                        password: ids.users.normal.password
                    }, cookieJar, function (err, res, body) {
                        assert.isNotOk(err);
                        const csrfToken = body.csrfToken;
                        assert.isDefined(csrfToken);
                        // console.log(res);
                        assert.equal(res.statusCode, 200);
                        utils.assertIsHtml(body);
                        assert.equal(body.template, 'grant_scopes');

                        // It's okay, grant it again now please                        
                        utils.authPost(body.grantUrl, {
                            _csrf: csrfToken,
                            _action: 'allow'
                        }, cookieJar, function (err, res, body) {
                            assert.isNotOk(err);
                            utils.assertIsCodeRedirect(res, done);
                        });
                    });
                });
            });
        });

        let refreshToken;
        it('should be possible to get a token (and refresh token) for a granted scope', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCodeToken(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, { scope: ['get'] }, function (err, accessToken) {
                assert.isNotOk(err);
                assert.isDefined(accessToken.access_token);
                assert.isDefined(accessToken.refresh_token);
                refreshToken = accessToken.refresh_token;
                done();
            });
        });

        let tokenInfo;
        it('should be possible to get info on the token from the wicked API', async function () {
            const tokenList = await wicked.getAccessTokenByRefreshToken(refreshToken);
            assert.equal(tokenList.count, 1);
            tokenInfo = tokenList.items[0];
            // console.log(JSON.stringify(tokenInfo, null, 2));
        });

        let oldRefreshToken;
        it('should be possible to refresh a token (with a granted scope)', function (done) {
            oldRefreshToken = refreshToken;
            utils.authPost('local/api/echo/token', {
                grant_type: 'refresh_token',
                client_id: ids.confidential.echo.clientId,
                client_secret: ids.confidential.echo.clientSecret,
                refresh_token: refreshToken
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(body.access_token);
                assert.isDefined(body.refresh_token);
                refreshToken = body.refresh_token;
                done();
            });
        });

        it('should not be possible to use the same refresh token twice', function (done) {
            utils.authPost('local/api/echo/token', {
                grant_type: 'refresh_token',
                client_id: ids.confidential.echo.clientId,
                client_secret: ids.confidential.echo.clientSecret,
                refresh_token: oldRefreshToken
            }, function (err, res, body) {
                assert.isNotOk(err);
                // console.log(body);
                assert.equal(res.statusCode, 400);
                assert.isDefined(body.error);
                assert.equal(body.error, 'invalid_request');
                done();
            });
        });

        it('should not be possible to retrieve information on a used refresh token', async function () {
            const tokenList = await wicked.getAccessTokenByRefreshToken(oldRefreshToken);
            assert.equal(tokenList.count, 0);
        });

        it('should have a refreshed token which contains the same information as before', async function () {
            const tokenList = await wicked.getAccessTokenByRefreshToken(refreshToken);
            assert.equal(tokenList.count, 1);
            const newTokenInfo = tokenList.items[0];
            // console.log(JSON.stringify(newTokenInfo, null, 2));
            utils.assertAccessTokensMatch(tokenInfo, newTokenInfo);
        });

        it('should not be possible to refresh a token after the scope has been revoked by the user', function (done) {
            wicked.deleteAllUserGrants(ids.users.normal.id, function (err) {
                assert.isNotOk(err);
                utils.authPost('local/api/echo/token', {
                    grant_type: 'refresh_token',
                    client_id: ids.confidential.echo.clientId,
                    client_secret: ids.confidential.echo.clientSecret,
                    refresh_token: refreshToken
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 403);
                    assert.isDefined(body.error);
                    assert.equal(body.error, 'unauthorized_client');
                    done();
                });
            });
        });
    });
});
