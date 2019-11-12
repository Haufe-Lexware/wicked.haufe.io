'use strict';

import * as wicked from 'wicked-sdk';
import { WickedError } from 'wicked-sdk';

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('kong-adapter:monitor');

import * as utils from './utils';

export const kongMonitor = {
    init: function (callback) {
        debug('init()');

        utils.setKongUrl(wicked.getInternalKongAdminUrl());

        pingKong(function (err) {
            if (err)
                return callback(err);
            // Set up Kong Monitor every ten seconds (retrieve version and cluster status)
            setInterval(pingKong, 10000);

            // OK, we're fine!
            callback(null);
        });
    },
};

function checkKongVersion(callback) {
    utils.kongGetGlobals(function (err, body) {
        if (err)
            return callback(err);
        if (!body.version) {
            const err = new WickedError('Did not get expected "version" property from Kong.', 500, body);
            return callback(err);
        }
        const expectedVersion = utils.getExpectedKongVersion();
        if (expectedVersion !== body.version) {
            const err = new WickedError('Unexpected Kong version. Got "' + body.version + '", expected "' + expectedVersion + '"', 500, body);
            return callback(err);
        }
        return callback(null, body.version);
    });
};

function checkKongCluster(callback) {
    utils.kongGetStatus(function (err, body) {
        if (err)
            return callback(err);
        if (!body.database) {
            const err = new WickedError('Kong answer from /status did not contain "database" property.', 500, body);
            return callback(err);
        }
        return callback(null, body);
    });
};

var _pingInProgress = false;
function pingKong(callback) {
    debug('pingKong()');

    if (!wicked.isApiReachable()) {
        warn(`Monitor: wicked API is currently not reachable.`);
    }

    if (_pingInProgress) {
        debug('pingKong() There already is a ping in progress.');
        return;
    }

    if (!utils.isKongAvailable()) {
        warn(`Monitor: Will not ping Kong; somebody marked Kong as unavailable.`);
        return;
    }

    _pingInProgress = true;
    async.series([
        callback => checkKongVersion(callback),
        callback => checkKongCluster(callback)
    ], function (err, results) {
        _pingInProgress = false;
        if (err) {
            error('*** KONG does not behave!');
            error(err);
            // utils.markKongAvailable(false, err.message, null);
            setTimeout(forceExit, 2000);
            if (callback)
                return callback(err);
            return;
        }
        info('Monitor: Kong is answering.');
        utils.setKongClusterStatus(results[1]);
        // utils.markKongAvailable(true, null, results[1]);
        if (callback)
            return callback(null);
    });
};

function forceExit() {
    error('Exiting component due to misbehaving Kong (see log).');
    process.exit(0);
}
