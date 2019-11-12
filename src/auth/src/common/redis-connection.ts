'use strict';

var { debug, info, warn, error } = require('portal-env').Logger('portal:sessionstore');
const redis = require('redis');
const stringifySafe = require('json-stringify-safe');
import * as wicked from 'wicked-sdk';
import { WickedSessionStoreType } from 'wicked-sdk';

interface RedisSettings {
    host: string,
    port: number,
    password?: string
}

export const redisConnection = {

    _redisConnection: null,
    getRedis: function () {
        debug('getRedis()');

        if (redisConnection._redisConnection)
            return redisConnection._redisConnection;

        redisConnection._redisConnection = redis.createClient(resolveRedis());
        return redisConnection._redisConnection;
    },

    createSessionStore: function (session) {
        debug('createSessionStore()');

        const redisSettings = resolveRedis();

        const sessionStoreOptions = <any>{};
        let SessionStore = require('connect-redis')(session);
        // Set options for Redis session store, see https://www.npmjs.com/package/connect-redis
        // Use the predefined client, no need to create a second one.
        sessionStoreOptions.client = redisConnection.getRedis();

        debug('Using redis session store with options ' + stringifySafe(sessionStoreOptions));

        return new SessionStore(sessionStoreOptions);
    }
};

function resolveRedis(): RedisSettings {
    debug('resolveRedis()');

    const globals = wicked.getGlobals();

    let sessionStoreType = WickedSessionStoreType.File;
    if (globals.sessionStore && globals.sessionStore.type) {
        sessionStoreType = globals.sessionStore.type;
    } else {
        throw new Error('Missing sessionStore global property, must be set to "redis".');
    }

    if (sessionStoreType === WickedSessionStoreType.File) {
        throw new Error('Missing sessionStore global property, or type is set to "file", must be set to "redis".');
    }

    const settings = {
        host: globals.sessionStore.host || 'portal-redis',
        port: globals.sessionStore.port || 6379
    } as RedisSettings;
    if (globals.sessionStore.password)
        settings.password = globals.sessionStore.password;

    return settings;
}
