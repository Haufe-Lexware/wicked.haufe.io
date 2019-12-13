'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:versionizer');
const folderHash = require('folder-hash');
const semver = require('semver');

const utils = require('./utils');
const dao = require('../dao/dao');

const versionizer = function () { };

versionizer._configHash = null;
versionizer._previousHash = null;
versionizer._startupTime = null;
versionizer.sendConfigHash = function (req, res, next) {
    debug('getConfigHash()');
    res.send(versionizer.getConfigHash());
};

versionizer.initConfigHash = function (callback) {
    if (null === versionizer._configHash) {
        const staticPath = utils.getStaticDir();
        // See https://github.com/Haufe-Lexware/wicked.haufe.io/issues/190
        const hashOptions = {
            folders: {
                exclude: ['.git']
            }
        };
        folderHash.hashElement('.', staticPath, hashOptions, (err, configHash) => {
            if (err) {
                return callback(err);
            }
            // See https://github.com/marc136/node-folder-hash
            versionizer._configHash = configHash.hash;
            return callback(null, versionizer._configHash);
        });
    } else {
        return callback(null, versionizer._configHash);
    }
};

versionizer.writeConfigHashToMetadata = function (callback) {
    debug('writeConfigHashToMetadata()');
    dao.meta.getMetadata('config_hash', (err, previousHash) => {
        if (err) {
            return callback(err);
        }
        const prevHash = previousHash && previousHash.hash;
        dao.meta.setMetadata('config_hash', {
            hash: versionizer.getConfigHash(),
            previous_hash: prevHash,
            version: utils.getVersion()
        }, (err) => {
            dao.meta.getMetadata('config_hash', (err, persistedConfigHash) => {
                if (err) {
                    return callback(err);
                }
                info(`Persisted config hash: ${persistedConfigHash.hash}, previous config hash: ${persistedConfigHash.previous_hash}`);
                versionizer._previousHash = persistedConfigHash.previous_hash;
                versionizer._startupTime = Date.now();
                return callback(null);
            });
        });
    });
};

// This is used in the special situation that we have an older version of the
// wicked API running which is overwriting the config hash, even though it
// actually shouldn't - there is a newer version of wicked already running
// against the current database, and we have to make sure *that* version of
// the API does not get force-quitted (Bug #190).
versionizer.overwriteConfigHashToMetadata = function (callback) {
    debug('overwriteConfigHashToMetadata()');
    dao.meta.setMetadata('config_hash', {
        hash: versionizer.getConfigHash(),
        previous_hash: versionizer.getPreviousConfigHash(),
        version: utils.getVersion()
    }, (err) => {
        if (err) {
            error('overwriteConfigHashToMetadata(): Failed to write config hash to database.');
            error(err);
            return callback(err);
        }
        warn('Force-overwrote the config hash to the metadata. This happens if there is another API instance with a lower version currently running against the same database.');
        warn('If this happens continuously, please review your deployment mechanisms, or ask for assistance on Github: https://github.com/Haufe-Lexware/wicked.haufe.io/issues');
        return callback(null);
    });
};

versionizer.getConfigHashMetadata = function (callback) {
    debug('getConfigHashMetadata()');
    dao.meta.getMetadata('config_hash', callback);
};

versionizer.getConfigHash = function () {
    if (!versionizer._configHash) {
        throw new Error('Config hash retrieved without being initialized.');
    }
    return versionizer._configHash;
};

versionizer.getPreviousConfigHash = function () {
    return versionizer._previousHash;
};

versionizer.checkVersions = function (req, res, next) {
    debug('checkVersions()');
    // X-Config-Hash, User-Agent
    const configHash = req.get('x-config-hash');
    const userAgent = req.get('user-agent');
    if (configHash && !isConfigHashValid(req.app, configHash)) {
        debug('Invalid config hash: ' + configHash);
        return res.status(428).json({ message: 'Config Hash mismatch; restart client to retrieve new configuration' });
    }
    if (userAgent && !isUserAgentValid(userAgent)) {
        debug('Invalid user agent: ' + userAgent);
        return res.status(428).json({ message: 'Invalid client version; has to match API version (' + utils.getVersion() + ')' });
    }
    next();
};

function isConfigHashValid(app, configHash) {
    if (versionizer.getConfigHash() === configHash) {
        return true;
    }
    const prevHash = versionizer.getPreviousConfigHash();
    // Only accept the previous content hash for three minutes
    if (prevHash && configHash === prevHash && (Date.now() - versionizer._startupTime < 180000)) {
        warn('isConfigHashValid: Allowing access with previous config hash.');
        return true;
    }
    return false;
}

function isUserAgentValid(userAgent) {
    const slashIndex = userAgent.indexOf('/');
    if (slashIndex < 0) {
        return true;
    }
    const agentString = userAgent.substring(0, slashIndex);
    const versionString = userAgent.substring(slashIndex + 1).trim();

    // Only check versions for wicked clients.
    if (!agentString.startsWith('wicked')) {
        return true;
    }

    // Allow older or equal versions access, but not newer clients to an older API.
    return semver.lte(versionString, utils.getVersion());
}

module.exports = versionizer;
