'use strict';

const semver = require('semver');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:principal');

const dao = require('../dao/dao');
const utils = require('./utils');
const versionizer = require('./versionizer');

const principal = () => { };

const LIVENESS_THRESHOLD = 30; // Seconds
const ELECTION_INTERVAL = 15; // Seconds

let _isPrincipal = false;
let _instanceId = utils.createRandomId();

info(`Creating principal ID for this instance: ${_instanceId}`);

principal.isInstancePrincipal = () => {
    return _isPrincipal;
};

principal.initialElection = () => {
    debug('initialElection()');
    if (!dao.isReady()) {
        setTimeout(principal.initialElection, 500);
    }
    electPrincipal();
    setInterval(houseKeeping, ELECTION_INTERVAL * 1000);
};

function houseKeeping() {
    checkConfigHash((err) => {
        if (err) {
            error(err);
        }
        electPrincipal();
    });
}

function electPrincipal() {
    debug(`electPrincipal()`);
    if (!dao.isReady()) {
        warn(`DAO is not ready, cannot elect principal.`);
        return;
    }
    dao.meta.getMetadata('principal', function (err, principalInfo) {
        if (err) {
            error('electPrincipal: Could not get metadata!');
            // TODO: Make this instance unhealthy?
            error(err);
            return;
        }

        const nowUtc = utils.getUtc();

        if (principalInfo && (principalInfo.id === _instanceId)) {
            info(`This instance ${_instanceId} is currently the principal instance`);
            // Update the timestamp to reflect that we are alive
            _isPrincipal = true;
            principalInfo.aliveDate = nowUtc;
            dao.meta.setMetadata('principal', principalInfo, (err) => {
                if (err) {
                    error('electPrincipal: Could not update principal aliveDate metadata.');
                    return;
                }
            });
        } else {
            let immediateTimeout = 500;
            if (!principalInfo) {
                principalInfo = {
                    id: null, 
                    aliveDate: 0,
                    version: utils.getVersion()
                };
                immediateTimeout = 0;
            }
            debug(`This instance ${_instanceId} is currently not the principal instance (${principalInfo.id})`);
            // Try to make it the current instance?
            const livenessAgeSeconds = nowUtc - principalInfo.aliveDate;
            if (livenessAgeSeconds > LIVENESS_THRESHOLD) {
                debug(`Trying to elect current instance to principal instance (previous instance is stale, ${livenessAgeSeconds}s)`);
                principalInfo.id = _instanceId;
                principalInfo.aliveDate = nowUtc;
                principalInfo.version = utils.getVersion();
                dao.meta.setMetadata('principal', principalInfo, (err) => {
                    if (err) {
                        error('electPrincipal: Could not set principal info metadata.');
                        return;
                    }
                    debug(`electPrincipal: Scheduling new election of principal in ${immediateTimeout}ms.`);
                    setTimeout(electPrincipal, immediateTimeout);
                });
            }
        }
    });
}

function checkConfigHash(callback) {
    debug('checkConfigHash()');
    const ourConfigHash = versionizer.getConfigHash();
    versionizer.getConfigHashMetadata(function (err, persistedConfigHash) {
        if (err) {
            error('COULD NOT RETRIEVE CONFIG HASH METADATA, EXITING.');
            return forceQuitApi();
        }
        debug(`our config hash: ${ourConfigHash}, persisted hash: ${persistedConfigHash.hash}`);
        if (ourConfigHash !== persistedConfigHash.hash) {
            warn(`Detected an updated config hash in the database: ${ourConfigHash} !== ${persistedConfigHash.hash} (version: ${persistedConfigHash.version})`);
            let forceQuit = false;
            // Let's see what type of situation we have now; is it the same version of wicked, or even a newer version?
            if (!persistedConfigHash.version) {
                // No version in the config hash; this is a version prior to 1.0.0-rc.11; don't force quit.                
            } else if (semver.gte(persistedConfigHash.version, utils.getVersion())) {
                // The instance which wrote the config hash is the same version as this instance, or even a newer
                // one. We will cave in and force quite now to see what happens next.
                forceQuit = true;
            }

            if (forceQuit) {
                warn('Force quitting due to the updated config hash...');
                return forceQuitApi();
            } else {
                warn('checkConfigHash(): This instance of the API has a newer version than the one writing the config hash. We will override the config hash with our values. NOT force quitting.');
                return versionizer.overwriteConfigHashToMetadata(callback);
            }
        }
        debug('Persisted config hash matches our config hash. Nothing to do.');
        return callback(null);
    });
}

function forceQuitApi() {
    error('Force Quit API');
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}

module.exports = principal;
