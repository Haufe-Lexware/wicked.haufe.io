'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:meta');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const utils = require('../../routes/utils');

class JsonMeta {

    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
        this._isLegacyData = false;
    }

    // =================================================
    // DAO contract
    // =================================================

    getInitChecks() {
        const instance = this;
        return [
            (glob, callback) => instance.dataWasMigratedOrIsEmpty(glob, callback),
            (glob, callback) => instance.cleanupSubscriptionIndex(glob, callback),
            (glob, callback) => instance.cleanupSubscriptionApiIndex(glob, callback),
            (glob, callback) => instance.checkDynamicConfigDir(glob, callback),
            (glob, callback) => instance.cleanupLockFiles(glob, callback),
            (glob, callback) => instance.runMigrations(glob, callback),
        ];
    }

    wipe(callback) {
        debug('wipe()');
        return this.wipeImpl(callback);
    }

    isLegacyData() {
        return this._isLegacyData;
    }

    getMetadata(propName, callback) {
        debug(`getMetadata(${propName})`);
        let propValue;
        try {
            propValue = this.getMetadataSync(propName);
        } catch (err) {
            return callback(err);
        }
        return callback(null, propValue);
    }

    setMetadata(propName, propValue, callback) {
        debug(`setMetadata(${propName}, ${propValue})`);
        try {
            this.setMetadataSync(propName, propValue);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    wipeImpl(callback) {
        debug('wipeImpl()');
        const basePath = this.jsonUtils.getDynamicDir();
        rimraf(basePath, callback);
    }

    // INIT CHECKS

    dataWasMigratedOrIsEmpty(glob, callback) {
        debug('dataWasMigratedOrIsEmpty()');
        try {
            const baseDir = this.jsonUtils.getDynamicDir();
            // Does the directory exist at all?
            if (!fs.existsSync(baseDir)) {
                // No, let's create it
                fs.mkdirSync(baseDir);
            }
            const files = fs.readdirSync(baseDir);
            // Is this a completely empty directory?
            if (files.length === 0) {
                return callback(null);
            } else {
                debug('File list prior to start up:');
                debug(files);
            }
            // Otherwise, this must be a migrated data directory; we will see that in the metadata
            const metadata = this.loadMetadata();
            if (!metadata.hasOwnProperty('dynamicVersion')) {
                // Is this during migration?
                if (!utils.isMigrationMode()) {
                    throw new Error('Wicked >= 1.0.0 cannot operate on legacy dynamic data; it must be run through the migration process first.');
                }
                this._isLegacyData = true;
            }
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    cleanupSubscriptionIndex(glob, callback) {
        debug('cleanupSubscriptionIndex()');
        this.cleanupDirectory('subscription_index', callback);
    }

    cleanupSubscriptionApiIndex(glob, callback) {
        debug('cleanupSubscriptionApiIndex()');
        this.cleanupDirectory('subscription_api_index', callback);
    }

    checkDynamicConfigDir(glob, callback) {
        debug('checkDynamicConfigDir()');

        const neededFiles = [
            {
                dir: 'applications',
                file: '_index.json'
            },
            {
                dir: 'approvals',
                file: '_index.json'
            },
            {
                dir: 'subscriptions',
                file: 'dummy'
            },
            {
                dir: 'subscription_index',
                file: 'dummy'
            },
            {
                dir: 'subscription_api_index',
                file: 'dummy'
            },
            {
                dir: 'users',
                file: '_index.json'
            },
            {
                dir: 'registrations',
                file: 'dummy'
            },
            {
                dir: 'verifications',
                file: '_index.json'
            },
            {
                dir: 'webhooks',
                file: '_listeners.json'
            },
            {
                dir: 'grants',
                file: 'dummy'
            },
            {
                dir: 'namespaces',
                file: 'dummy'
            },
            {
                dir: null,
                file: 'meta.json',
                content: {}
            }
        ];
        try {
            let dynamicDir = this.jsonUtils.getDynamicDir();
            if (!this.isExistingDir(dynamicDir)) {
                debug('Creating dynamic base directory ' + dynamicDir);
                fs.mkdirSync(dynamicDir);
            }

            for (let fileDescIndex in neededFiles) {
                let fileDesc = neededFiles[fileDescIndex];
                let subDir;
                if (fileDesc.dir) {
                    subDir = path.join(dynamicDir, fileDesc.dir);
                    if (!this.isExistingDir(subDir)) {
                        debug('Creating dynamic directory ' + fileDesc.dir);
                        fs.mkdirSync(subDir);
                    }
                } else {
                    subDir = dynamicDir;
                }
                let fileName = path.join(subDir, fileDesc.file);
                if (!fs.existsSync(fileName)) {
                    if (!fileDesc.content) {
                        debug('Creating file ' + fileName + ' with empty array.');
                        fs.writeFileSync(fileName, JSON.stringify([], null, 2), 'utf8');
                    } else {
                        debug('Creating file ' + fileName + ' with predefined content.');
                        fs.writeFileSync(fileName, JSON.stringify(fileDesc.content, null, 2), 'utf8');
                    }
                }
            }

            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    cleanupLockFiles(glob, callback) {
        debug('cleanupLockFiles()');
        let error = null;
        try {
            const dynDir = this.jsonUtils.getDynamicDir();
            this.cleanupDir(dynDir);
            if (this.jsonUtils.hasGlobalLock()) {
                this.jsonUtils.globalUnlock();
            }
            debug("checkForLocks() Done.");
        } catch (err) {
            error(err);
            error(err.stack);
            error = err;
        }
        callback(error);
    }

    // HELPER METHODS

    cleanupDir(dir) {
        debug('cleanupDir(): ' + dir);
        const fileList = [];
        this.gatherLockFiles(dir, fileList);

        for (let i = 0; i < fileList.length; ++i) {
            debug('cleanupDir: Deleting ' + fileList[i]);
            fs.unlinkSync(fileList[i]);
        }
    }

    gatherLockFiles(dir, fileList) {
        const fileNames = fs.readdirSync(dir);
        for (let i = 0; i < fileNames.length; ++i) {
            const fileName = path.join(dir, fileNames[i]);
            const stat = fs.statSync(fileName);
            if (stat.isDirectory()) {
                this.gatherLockFiles(fileName, fileList);
            }
            if (stat.isFile()) {
                if (fileName.endsWith('.lock') &&
                    !fileName.endsWith('global.lock')) {
                    debug("Found lock file " + fileName);
                    fileList.push(fileName);
                }
            }
        }
    }

    isExistingDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return false;
        }
        let dirStat = fs.statSync(dirPath);
        return dirStat.isDirectory();
    }

    cleanupDirectory(dirName, callback) {
        debug('cleanupDirectory(): ' + dirName);
        try {
            let dynamicDir = this.jsonUtils.getDynamicDir();
            if (!this.isExistingDir(dynamicDir)) {
                return callback(null); // We don't even have a dynamic dir yet; fine.
            }
            let subIndexDir = path.join(dynamicDir, dirName);
            if (!this.isExistingDir(subIndexDir)) {
                return callback(null); // We don't have that directory yet, that's fine
            }
            // Now we know we have a dirName directory.
            // Let's kill all files in there, as we'll rebuild this index anyway.
            let filenameList = fs.readdirSync(subIndexDir);
            for (let i = 0; i < filenameList.length; ++i) {
                const filename = path.join(subIndexDir, filenameList[i]);
                fs.unlinkSync(filename);
            }
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    getMetaFileName() {
        debug(`getMetaFileName()`);
        const dynamicDir = this.jsonUtils.getDynamicDir();
        const metaDir = path.join(dynamicDir, 'meta');
        const metaFile = path.join(metaDir, 'meta.json');
        if (!fs.existsSync(metaDir)) {
            throw new Error(`JSON DAO: Directory "meta" does not exist, expected ${metaDir}`);
        }
        if (!fs.existsSync(metaFile)) {
            throw new Error(`JSON DAO: File "meta.json" does not exist, expected ${metaFile}`);
        }

        return metaFile;
    }

    getDynamicVersion() {
        debug(`getDynamicVersion()`);
        return this.getMetadataSync('dynamicVersion');
    }

    setDynamicVersion(newDynamicVersion) {
        debug(`setDynamicVersion(${newDynamicVersion})`);
        return this.setMetadataSync('dynamicVersion', newDynamicVersion);
    }

    static findMaxIndex(o) {
        let maxIndex = -1;
        for (let key in o) {
            let thisIndex = -1;
            try {
                thisIndex = Number.parseInt(key);
            } catch (err) {
                error(`findMaxIndex(): Key ${key} could not be parsed as an int (Number.parseInt())`);
                throw err;
            }
            if (thisIndex === 0) {
                throw new Error(`findMaxIndex(): Key ${key} was parsed to int value 0; this must not be correct.`);
            }
            if (thisIndex > maxIndex) {
                maxIndex = thisIndex;
            }
        }
        if (maxIndex === -1) {
            throw new Error('findMaxIndex: Given object does not contain any valid indexes');
        }
        return maxIndex;
    }

    // ==============================================

    runMigrations(glob, callback) {
        debug('runMigrations()');

        const instance = this;
        const migrations = {
            1: () => instance.nullMigration(),
            // 2: migrateUsersToRegistrations_wicked1_0_0
        };

        const targetDynamicVersion = JsonMeta.findMaxIndex(migrations);

        const currentVersion = this.getDynamicVersion();
        if (currentVersion < targetDynamicVersion) {
            info(`Current dynamic data version is ${currentVersion}, target is ${targetDynamicVersion}. Attempting to run migrations.`);

            for (let v = currentVersion + 1; v <= targetDynamicVersion; ++v) {
                info(`Running dynamic migration to version ${v}`);

                if (!migrations[v]) {
                    throw new Error(`Dynamic version migration step ${v} was not found.`);
                }

                const err = migrations[v]();
                if (!err) {
                    info(`Dynamic migration to version ${v} succeeded.`);
                } else {
                    error(`Dynamic migration to version ${v} FAILED.`);
                    error(err);
                    throw err;
                }

                // Update meta.json
                instance.setDynamicVersion(v);
            }
        }

        return callback(null);
    }

    nullMigration() {
        debug(`nullMigration()`);
        return null;
    }

    // Metadata

    getMetadataFileName() {
        const fileName = path.join(this.jsonUtils.getDynamicDir(), 'meta.json');
        return fileName;
    }

    loadMetadata() {
        debug(`loadMetadata()`);
        const fileName = this.getMetadataFileName();
        if (!fs.existsSync(fileName)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(fileName, 'utf8'));
    }

    saveMetadata(metadata) {
        debug(`saveMetadata()`);
        const fileName = this.getMetadataFileName();
        return fs.writeFileSync(fileName, JSON.stringify(metadata, null, 2), 'utf8');
    }

    getMetadataSync(propName) {
        debug(`getMetadataSync(${propName})`);
        const metadata = this.loadMetadata();
        if (metadata.hasOwnProperty(propName)) {
            return metadata[propName];
        }
        return null;
    }

    setMetadataSync(propName, propValue) {
        debug(`getMetadataSync(${propName}, ${propValue})`);
        const instance = this;
        return this.jsonUtils.withLockedMetadata(function () {
            const metadata = instance.loadMetadata();
            if (propValue) {
                metadata[propName] = propValue;
            } else {
                delete metadata[propName];
            }
            instance.saveMetadata(metadata);
            return propValue;
        });
    }
}

module.exports = JsonMeta;
