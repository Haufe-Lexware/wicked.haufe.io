'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal:sessionstore');

function initSessionStore(globals, session){
    let sessionStoreType = 'file';
    if (globals.sessionStore && globals.sessionStore.type) {
        sessionStoreType = globals.sessionStore.type;
    }  else {
        warn('WARNING: Missing sessionStore global property, defaulting to file session store - THIS WILL NOT SCALE.');
        globals.sessionStore = { type: 'file' };
    }
    debug('SESSION_STORE_TYPE: ' + sessionStoreType);

    const sessionStoreOptions = {};
    let SessionStore;
    switch (sessionStoreType){
        case 'file':
            SessionStore = require('session-file-store')(session);
            // Use default options for file session store, see https://www.npmjs.com/package/session-file-store
            break;
        case 'redis':
            SessionStore = require('connect-redis')(session);
            // Set options for Redis session store, see https://www.npmjs.com/package/connect-redis
            sessionStoreOptions.host = globals.sessionStore.host || 'portal-redis';
            sessionStoreOptions.port = globals.sessionStore.port || 6379;
            if (globals.sessionStore.password)
                sessionStoreOptions.pass = globals.sessionStore.password;
            break;
        default:
            throw new Error("Invalid session-store type: '" + sessionStoreType + "'");
    }

    debug('Using session store \'' + sessionStoreType + '\' with options ' + JSON.stringify(sessionStoreOptions));

    return new SessionStore(sessionStoreOptions);
}

module.exports = initSessionStore;
