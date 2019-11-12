'use strict';

const assert = require('chai').assert;
const request = require('request');
const async = require('async');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL + 'registrations/';
const poolId = 'woo-ns';

const READ_SCOPE = 'read_registrations';
const WRITE_SCOPE = 'write_registrations';

const READ_NS_SCOPE = 'read_namespaces';
const WRITE_NS_SCOPE = 'write_namespaces';

describe('/registrations', () => {

    let devUserId = '';
    let adminUserId = '';
    let noobUserId = '';

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                utils.createUser('Noob', null, true, function (id) {
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

    function addNamespaceIfNotPresent(poolId, namespace, callback) {
        if (!namespace)
            return callback();
        // console.log(`Checking namespace ${namespace}`);
        request.get({
            url: consts.BASE_URL + `pools/${poolId}/namespaces/${namespace}`,
            headers: utils.makeHeaders(adminUserId, READ_NS_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            if (res.statusCode === 404) {
                request.put({
                    url: consts.BASE_URL + `pools/${poolId}/namespaces/${namespace}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_NS_SCOPE),
                    json: true,
                    body: {
                        description: `Namespace ${namespace}`
                    }
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    // console.log(body);
                    assert.equal(res.statusCode, 204, 'Create Namespace: Unexpected status code');
                    return callback();
                });
            } else {
                assert.equal(200, res.statusCode);
                return callback();
            }
        });
    }

    function putRegistration(poolId, userId, name, namespace, callback) {
        if (!callback && typeof (namespace) === 'function')
            callback = namespace;
        addNamespaceIfNotPresent(poolId, namespace, () => {
            request.put({
                url: baseUrl + `pools/${poolId}/users/${userId}`,
                headers: utils.makeHeaders(userId, WRITE_SCOPE),
                body: {
                    id: userId,
                    name: name,
                    namespace: namespace
                },
                json: true
            }, (err, res, body) => {
                assert.isNotOk(err);
                if (res.statusCode !== 204)
                    console.error(body);
                assert.equal(res.statusCode, 204);
                callback();
            });
        });
    }

    function deleteRegistration(poolId, userId, namespace, accept404, callback) {
        // console.log(`deleteRegistration(poolId: ${poolId}, userId: ${userId}, namespace: ${namespace})`);
        if (typeof (accept404) === 'function' && !callback) {
            callback = accept404;
            accept404 = false;
        }
        let url = baseUrl + `pools/${poolId}/users/${userId}`;
        if (namespace)
            url += `?namespace=${namespace}`;
        request.delete({
            url: url,
            headers: utils.makeHeaders(userId, WRITE_SCOPE),
        }, (err, res, body) => {
            assert.isNotOk(err);
            if (!accept404) {
                const isOk = res.statusCode === 204;
                if (!isOk)
                    console.error(body);
                assert.isTrue(isOk, 'Status not equal 204');
            } else {
                const isOk = res.statusCode === 204 || res.statusCode === 404;
                if (!isOk)
                    console.error(body);
                assert.isTrue(isOk, 'Status not equal to 204 or 404');
            }
            callback();
        });
    }

    function deleteAllRegistrations(userId, callback) {
        // console.log(`deleteAllRegistrations(${userId})`);
        request.get({
            url: `${consts.BASE_URL}registrations/users/${userId}`,
            headers: utils.makeHeaders(userId, READ_SCOPE)
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            const jsonBody = utils.getJson(body);
            const regList = [];
            for (let p in jsonBody.pools) {
                jsonBody.pools[p].forEach(r => regList.push(r)); // jshint ignore:line
            }
            // console.log(regList);
            async.eachSeries(regList, (r, callback) => deleteRegistration(r.poolId, userId, r.namespace, true, callback), callback);
        });
    }

    function addSomeRegistrations(done) {
        putRegistration(poolId, adminUserId, 'Admin User', 'ns1', (err) => {
            assert.isNotOk(err);
            putRegistration(poolId, devUserId, 'Dan Developer', 'ns1', (err) => {
                assert.isNotOk(err);
                putRegistration(poolId, noobUserId, 'Norah Noob', 'ns2', (err) => {
                    assert.isNotOk(err);
                    done();
                });
            });
        });
    }

    function deleteSomeRegistrations(done) {
        deleteRegistration(poolId, adminUserId, 'ns1', true, (err) => {
            deleteRegistration(poolId, devUserId, 'ns1', true, (err2) => {
                deleteRegistration(poolId, noobUserId, 'ns2', true, (err3) => {
                    assert.isNotOk(err);
                    assert.isNotOk(err2);
                    assert.isNotOk(err3);
                    done();
                });
            });
        });
    }

    describe('/pools/{poolId} GET', () => {

        before(done => {
            addNamespaceIfNotPresent(poolId, 'ns1', done);
        });

        describe('basic usage', () => {

            it('should return an empty list without registrations (admin)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    // console.error(body);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(0, jsonBody.items.length);
                    assert.equal(0, jsonBody.count);
                    done();
                });
            });

            it('should reject calls with a 403 which do not have the right scope', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1',
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE) // wrong scope
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });

            it('should return a 403 for non-admins', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1',
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });

            it('should return a 400 for an invalid pool ID', (done) => {
                request.get({
                    url: baseUrl + 'pools/ìnvälid',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });

            it('should return a 404 for an non-existing pool ID', (done) => {
                request.get({
                    url: baseUrl + 'pools/non-existing',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });
        }); // basic usage

        describe('basic usage (2)', () => {

            before(addSomeRegistrations);
            after(deleteSomeRegistrations);

            it('should return a list of registrations', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1&no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(2, jsonBody.items.length);
                    assert.equal(2, jsonBody.count);
                    assert.isTrue(jsonBody.hasOwnProperty('count_cached'));
                    done();
                });
            });

            it('should return a filtered list of registrations (filter)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1&' + utils.makeFilter({ name: 'Developer' }),
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    //console.log(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(1, jsonBody.items.length);
                    assert.equal('Dan Developer', jsonBody.items[0].name, 'Name did not match');
                    done();
                });
            });

            it('should return a filtered list of registrations (namespace filter)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(2, jsonBody.items.length);
                    done();
                });
            });

            it('should return a filtered list of registrations (namespace+name filter)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1&' + utils.makeFilter({ name: 'Developer' }),
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(1, jsonBody.items.length);
                    assert.equal('Dan Developer', jsonBody.items[0].name, 'Name did not match');
                    done();
                });
            });

            it('should return an empty filtered list of registrations (namespace+name filter, no match)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns2&' + utils.makeFilter({ name: 'Developer' }),
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(0, jsonBody.items.length);
                    done();
                });
            });

            it('should return a 400 when filtering for faulty namespace', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=öäü',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });
        });
    }); // {poolId} GET

    describe('/{poolId}/users/{userId}', () => {
        before(addSomeRegistrations);
        after(deleteSomeRegistrations);

        describe('GET', () => {
            it('should be possible to get a single registration', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.equal(1, jsonBody.items.length);
                    assert.equal(devUserId, jsonBody.items[0].userId, 'User id mismatch');
                    done();
                });
            });

            it('should answer with an empty array if there is no such registration', (done) => {
                // woo and user both exist, but no registration
                request.get({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'Expected an "items" property in response');
                    assert.equal(0, jsonBody.items.length);
                    done();
                });
            });

            it('should reject calls with the wrong scope', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to get a single registration as a different user', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to get a single registration as a different user, if admin', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items);
                    assert.equal(1, jsonBody.items.length);
                    assert.equal(devUserId, jsonBody.items[0].userId, 'User id mismatch');
                    done();
                });
            });
        });

        describe('PUT', () => {
            const newDevName = 'Daniel Developer';
            const newNamespace = 'ns3';
            // TODO: This is not supposed to upsert an existing registration, as
            // each user can have multiple registrations (in different namespaces).
            it('should be possible to add another single registration', (done) => {
                putRegistration(poolId, devUserId, newDevName, newNamespace, (err) => {
                    assert.isNotOk(err);
                    done();
                });
            });

            it('should reject calls with a 403 which have the wrong scope', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Does Not Matter'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            // // Sue me, this is checking a side effect
            // it('should have updated the information in the registration', (done) => {
            //     request.get({
            //         url: baseUrl + `pools/${poolId}/users/${devUserId}`,
            //         headers: utils.makeHeaders(devUserId, READ_SCOPE)
            //     }, (err, res, body) => {
            //         assert.isNotOk(err);
            //         assert.equal(200, res.statusCode, 'Unexpected status code');
            //         const jsonBody = utils.getJson(body);
            //         assert.equal(devUserId, jsonBody.userId, 'User id mismatch');
            //         assert.equal(jsonBody.name, newDevName);
            //         assert.equal(jsonBody.namespace, newNamespace);
            //         done();
            //     });
            // });

            // Sue me some more
            it('should return the updated registration in the new namespace', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}?namespace=${newNamespace}`,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'property items not found');
                    assert.equal(1, jsonBody.items.length);
                    assert.equal(newDevName, jsonBody.items[0].name, 'Name mismatch after upsert!');
                    done();
                });
            });

            it('should not be possible to upsert a single registration as a different user', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to update a single registration as a different user, if admin', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Dan Developer',
                        namespace: 'ns2'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to create a registration for non-existing user (even if admin)', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/bad-user-id`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
                    body: {
                        id: 'bad-user-id',
                        name: 'Not Existing',
                        namespace: 'ns1'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });


            it('should be possible to have two registrations for a single user', (done) => {
                request.put({
                    url: baseUrl + `pools/wicked/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Daniel Developer',
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possibe to retrieve both registrations', (done) => {
                request.get({
                    url: baseUrl + `users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools, 'items property is missing');
                    assert.isOk(jsonBody.pools[poolId], `Registration for ${poolId} not found`);
                    assert.isOk(jsonBody.pools.wicked, 'registration for pool wicked not found.');
                    // Delete it to clean up again
                    deleteRegistration('wicked', devUserId, null, () => {
                        done();
                    });
                });
            });

            it('should be possible to have two registrations for the same pool with different namespaces', (done) => {
                async.series([
                    callback => {
                        request.put({
                            url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                            headers: utils.makeHeaders(noobUserId, WRITE_SCOPE),
                            body: {
                                id: noobUserId,
                                namespace: 'ns1',
                                name: 'Daniel Developer',
                            },
                            json: true
                        }, (err, res, body) => {
                            assert.isNotOk(err);
                            assert.equal(res.statusCode, 204);
                            return callback(null);
                        });
                    },
                    callback => {
                        request.put({
                            url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                            headers: utils.makeHeaders(noobUserId, WRITE_SCOPE),
                            body: {
                                id: noobUserId,
                                namespace: 'ns2',
                                name: 'Daniel Developer2',
                            },
                            json: true
                        }, (err, res, body) => {
                            assert.isNotOk(err);
                            assert.equal(res.statusCode, 204);
                            return callback(null);
                        });
                    }
                ], (err, results) => {
                    assert.isNotOk(err);
                    done();
                });
            });

            it('should be possibe to retrieve both registrations (same pool)', (done) => {
                request.get({
                    url: baseUrl + `users/${noobUserId}`,
                    headers: utils.makeHeaders(noobUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools, 'items property is missing');
                    assert.isOk(jsonBody.pools[poolId], `Registrations for pool ${poolId} not found`);
                    // Delete it to clean up again
                    deleteRegistration(poolId, noobUserId, 'ns1', () => {
                        assert.equal(2, jsonBody.pools[poolId].length, 'Did not receive correct amount of registrations');
                        const ns1 = jsonBody.pools[poolId].find(r => r.namespace === 'ns1');
                        const ns2 = jsonBody.pools[poolId].find(r => r.namespace === 'ns2');
                        assert.isOk(ns1, 'Registration for ns1 not found');
                        assert.isOk(ns2, 'Registration for ns2 not found');
                        done();
                    });
                });
            });
        }); // PUT

        describe('PUT (with validation)', () => {
            it('should reject registrations without required fields', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        namespace: 'ns3'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should reject registrations with a too long name', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: utils.generateCrap(260),
                        namespace: 'ns3'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should filter out excess properties', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Hello World',
                        namespace: 'ns3',
                        company: 'This is okay',
                        excess_crap: 'Arghjaghr'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    request.get({
                        url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                        headers: utils.makeHeaders(devUserId, READ_SCOPE),
                    }, (err, res, body) => {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode, 'Unexpected status code');
                        const jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.items);
                        const ns3 = jsonBody.items.find(r => r.namespace === 'ns3');
                        assert.isOk(ns3, 'Did not find registration for namespace ns3');
                        assert.isNotOk(ns3.excess_crap);
                        assert.equal('This is okay', ns3.company, 'Defined field missing');
                        done();
                    });
                });
            });
        });

        describe('DELETE', () => {
            beforeEach((done) => {
                async.series([
                    callback => putRegistration('woo', devUserId, 'Dan Developer', null, callback),
                    callback => putRegistration(poolId, devUserId, 'Dan Developer', 'ns5', callback),
                ], done);
            });

            afterEach((done) => {
                const accept404 = true;
                async.series([
                    callback => deleteRegistration('woo', devUserId, null, accept404, callback),
                    callback => deleteRegistration(poolId, devUserId, 'ns5', accept404, callback),
                ], done);
            });

            after(done => deleteAllRegistrations(devUserId, done));

            it('should return a 404 if user is not found', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/bad-user-id`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should return a 400 if pool ID contains invalid characters', (done) => {
                request.delete({
                    url: baseUrl + `pools/pööl/users/${adminUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to delete a registration as yourself', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should actually have deleted the registration after you delete it', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    request.get({
                        url: baseUrl + `pools/woo/users/${devUserId}`,
                        headers: utils.makeHeaders(devUserId, READ_SCOPE)
                    }, (err, res, body) => {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode, 'Unexpected status code when reading registrations');
                        const jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.items);
                        assert.isArray(jsonBody.items);
                        // console.log(body);
                        assert.equal(0, jsonBody.items.length, 'Registration was never deleted.');
                        done();
                    });
                });
            });

            it('should be possible to delete a registration as yourself (with namespace)', (done) => {
                request.delete({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}?namespace=ns5`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should reject calls with the wrong scope', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to delete a registration as somebody else', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(noobUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to delete a registration as somebody else (with namespace)', (done) => {
                request.delete({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}?namespace=ns5`,
                    headers: utils.makeHeaders(noobUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to delete a registration as an admin', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to delete a registration as an admin (with namespace)', (done) => {
                request.delete({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}?namespace=ns5`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to delete a registration requiring namespace, without a namespace', (done) => {
                request.delete({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to delete a registration requiring namespace (as admin), without a namespace', (done) => {
                request.delete({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });
        });
    });

    describe('/users/{userId}', () => {
        describe('GET', () => {
            it('should return an empty pools object if no registrations were made', (done) => {
                request.get({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools);
                    // console.log(JSON.stringify(jsonBody));
                    assert.equal(0, Object.keys(jsonBody.pools).length, 'pools is not an empty object');
                    done();
                });
            });

            it('should return a single registration', (done) => {
                putRegistration(poolId, devUserId, 'Daniel Developer', 'ns4', () => {
                    request.get({
                        url: baseUrl + 'users/' + devUserId,
                        headers: utils.makeHeaders(devUserId, READ_SCOPE)
                    }, (err, res, body) => {
                        deleteRegistration(poolId, devUserId, 'ns4', () => {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode, 'Unexpected status code');
                            const jsonBody = utils.getJson(body);
                            assert.isOk(jsonBody.pools);
                            assert.isOk(jsonBody.pools[poolId], 'pool registration not found');
                            assert.isArray(jsonBody.pools[poolId]);
                            assert.equal(1, jsonBody.pools[poolId].length);
                            assert.equal(devUserId, jsonBody.pools[poolId][0].userId);
                            done();
                        });
                    });
                });
            });

            it('should return 403 if accessing with other user', (done) => {
                request.get({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(noobUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should return something if accessing as an admin', (done) => {
                request.get({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools);
                    assert.equal(0, Object.keys(jsonBody.pools).length, 'pools is not an empty object');
                    done();
                });
            });
        });
    });

    describe('/registrations with namespaces', () => {

        before(done => {
            async.series([
                callback => addNamespaceIfNotPresent(poolId, 'more-ns1', callback),
                callback => addNamespaceIfNotPresent(poolId, 'more-ns2', callback),
            ], done);
        });

        it('should not be possible to create a registration for a non-existing namespace', (done) => {
            request.put({
                url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                body: {
                    id: devUserId,
                    name: 'Some Developer',
                    namespace: 'non-existing-ns'
                },
                json: true
            }, (err, res, body) => {
                assert.isNotOk(err);
                if (res.statusCode !== 400)
                    console.error(body);
                assert.equal(res.statusCode, 400);
                done();
            });
        });

        it('should be possible to create a registration for myself in one namespace', (done) => {
            request.put({
                url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                body: {
                    id: devUserId,
                    name: 'Some Developer',
                    namespace: 'more-ns1'
                },
                json: true
            }, (err, res, body) => {
                assert.isNotOk(err);
                if (res.statusCode !== 204)
                    console.error(body);
                assert.equal(res.statusCode, 204);
                done();
            });
        });

        it('should, as an admin, be possible to create a registration for another user in one namespace', (done) => {
            request.put({
                url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
                body: {
                    id: devUserId,
                    name: 'Some Developer',
                    namespace: 'more-ns2'
                },
                json: true
            }, (err, res, body) => {
                assert.isNotOk(err);
                if (res.statusCode !== 204)
                    console.error(body);
                assert.equal(res.statusCode, 204);
                done();
            });
        });

        it('should not, as a non-admin user, be possible to create a registration for another user', (done) => {
            request.put({
                url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                body: {
                    id: noobUserId,
                    name: 'Noob Developer',
                    namespace: 'more-ns1'
                },
                json: true
            }, (err, res, body) => {
                assert.isNotOk(err);
                if (res.statusCode !== 403)
                    console.error(body);
                assert.equal(res.statusCode, 403);
                done();
            });
        });

        it('should be possible to retrieve both registrations as a user', (done) => {
            request.get({
                url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                headers: utils.makeHeaders(devUserId, READ_SCOPE)
            }, (err, res, body) => {
                assert.isNotOk(err);
                const jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.items);
                assert.equal(jsonBody.items.length, 2);
                done();
            });
        });
    });
});
