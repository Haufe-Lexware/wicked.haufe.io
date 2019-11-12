'use strict';

/* global __dirname */

const async = require('async');
const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:pg:meta');
const path = require('path');
const utils = require('../../routes/utils');

const CURRENT_DATABASE_VERSION = 3;

class PgMeta {
    constructor(pgUtils) {
        this.pgUtils = pgUtils;
    }

    getInitChecks() {
        debug('getInitChecks()');
        const instance = this;
        return [
            (glob, callback) => instance.runMigrations(glob, callback)
        ];
    }

    wipe(callback) {
        debug('wipe()');
        // Woooowahjkhkssdfarghl
        this.pgUtils.dropWickedDatabase(callback);
    }

    isLegacyData() {
        // If it's in Postgres, it's definitely wicked 1.0.0+
        return false;
    }

    getMetadata(propName, callback) {
        debug(`getMetadata(${propName})`);
        return this.getMetadataImpl(propName, callback);
    }

    setMetadata(propName, propValue, callback) {
        debug(`setMetadata(${propName}, ${propValue})`);
        return this.setMetadataImpl(propName, propValue, callback);
    }

    // ================================================
    // Implementation
    // ================================================

    runMigrations(glob, callback) {
        debug('runMigrations()');
        // Note: At first run, this "getMetadata" will trigger database creation,
        // including adding the core schema.
        const instance = this;
        this.pgUtils.getMetadata((err, metadata) => {
            if (err) {
                return callback(err);
            }
            debug('runMigrations: Current version is ' + metadata.version);
            if (metadata.version < CURRENT_DATABASE_VERSION) {
                debug('runMigrations: Desired version is ' + CURRENT_DATABASE_VERSION);
                // We need to run migrations
                const migrationSteps = [];
                for (let i = metadata.version + 1; i <= CURRENT_DATABASE_VERSION; ++i) {
                    migrationSteps.push(i);
                }

                async.mapSeries(migrationSteps, (stepNumber, callback) => {
                    const migrationSqlFile = path.join(__dirname, 'schemas', `migration-${stepNumber}.sql`);
                    instance.pgUtils.runSql(migrationSqlFile, (err) => {
                        if (err) {
                            debug(`runMigrations: Migration ${stepNumber} failed.`);
                            return callback(err);
                        }
                        metadata.version = stepNumber;
                        instance.pgUtils.setMetadata(metadata, callback);
                        if (stepNumber === 3) {
                            this.populateSubscriptionApiGroup();
                        }
                    });
                }, (err) => {
                    if (err) {
                        return callback(err);
                    }
                    debug('runMigrations successfully finished.');
                    return callback(null);
                });
            } else {
                debug('runMigrations: No migrations needed.');
                return callback(null);
            }
        });
    }

    populateSubscriptionApiGroup() {
        if (utils.isMigrationMode()) {
            info('Skipping "populateSubscriptionApiGroup() in migration mode.');
            return;
        }
        const apis = utils.loadApis();
        for (let i = 0; i < apis.apis.length; ++i) {
            const api = apis.apis[i];
            const group = api.requiredGroup;
            const id = api.id;
            this.pgUtils.populateSubscriptionApiGroup([id, group]);
        }
    }

    getMetadataImpl(propName, callback) {
        debug(`getMetadataImpl(${propName})`);
        const instance = this;
        instance.pgUtils.getMetadata(function (err, metadata) {
            if (err) {
                return callback(err);
            }
            if (metadata.hasOwnProperty(propName)) {
                return callback(null, metadata[propName]);
            }
            return callback(null);
        });
    }

    setMetadataImpl(propName, propValue, callback) {
        debug(`setMetadataImpl(${propName}, ${propValue})`);
        const instance = this;
        instance.pgUtils.withTransaction((err, client, callback) => {
            if (err) {
                return callback(err);
            }
            instance.pgUtils.getMetadata(client, function (err, metadata) {
                if (err) {
                    return callback(err);
                }
                if (propValue) {
                    metadata[propName] = propValue;
                } else {
                    delete metadata[propName];
                }
                instance.pgUtils.setMetadata(metadata, client, callback);
            });
        }, callback);
    }
}

module.exports = PgMeta;
