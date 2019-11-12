'use strict';

/* global setImmediate */

const async = require('async');
const ncp = require('ncp');
const rimraf = require('rimraf');
const fs = require('fs');

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:migrate');
const utils = require('../../routes/utils');
const daoUtils = require('../dao-utils');
const JsonDao = require('../json/json-dao');
const PgDao = require('../postgres/pg-dao');

/*
{
    "wipeTarget": true,
    "source": {
        "type": "json"
        "config": {
            "basePath": "/Users/someuser/whatever/dynamic"
        }
    },
    "target": {
        "type": "postgres",
        "config": {
            "host": "localhost",
            "port": 5432,
            "user": "kong",
            "password": "kong"
        }
    }
}
*/

class DaoMigrator {

    constructor(migrationConfig) {
        debug('constructor()');
        this._config = migrationConfig;
        this.sanityCheckConfig();
        this._cleanupHooks = [];
        this._warnings = [];
        this._skippedSubscriptions = new Set();
        this._migrationFromLegacy = false;
    }

    // PUBLIC method

    migrate(callback) {
        debug('migrate()');
        const instance = this;
        this.migrateImpl((err) => {
            instance.cleanup(err, callback);
            instance.printWarnings();
        });
    }

    // IMPLEMENTATION DETAILS

    migrateImpl(callback) {
        debug('migrateImpl()');
        info('Starting Migration');
        utils.setMigrationMode(true, this._config);
        async.series({
            source: callback => this.createDao(this._config.source, false, false, callback),
            target: callback => this.createDao(this._config.target, this._config.wipeTarget, true, callback)
        }, (err, results) => {
            if (err) {
                return callback(err);
            }

            const sourceDao = results.source;
            const targetDao = results.target;

            async.series({
                validate: callback => this.validateSource(sourceDao, this._config, callback),
                migrate: callback => this.migrateEntities(sourceDao, targetDao, callback)
            }, callback);
        });
    }

    cleanup(passthroughErr, callback) {
        debug('cleanup()');
        info('Cleaning up');
        async.eachSeries(this._cleanupHooks, (hook, callback) => hook(callback), (err) => {
            if (err) {
                error(err);
            }
            return callback(passthroughErr);
        });
    }

    hookCleanup(cleanupFunction) {
        this._cleanupHooks.push(cleanupFunction);
    }

    addSevereWarning(message, description, payload, type) {
        this._warnings.push({
            message,
            description,
            payload,
            type
        });
    }

    printWarnings() {
        for (let i = 0; i < this._warnings.length; ++i) {
            const w = this._warnings[i];
            if (w.type) {
                error(`${w.type}: ${w.message}`);
            } else {
                error(`WARNING: ${w.message}`);
            }
            error(w.description);
            if (w.payload) {
                error(w.payload);
            }
        }
    }

    validateSource(source, migrationConfig, callback) {
        debug('validateSource()');
        info('Validating source DAO with given migration configuration');
        const instance = this;
        async.series([
            callback => instance.validateMeta(source, migrationConfig, callback),
            callback => instance.validateSourceUsers(source, migrationConfig, callback)
        ], callback);
    }

    validateMeta(source, migrationConfig, callback) {
        debug('validateMeta()');
        this._migrationFromLegacy = source.meta.isLegacyData();
        if (this._migrationFromLegacy) {
            info('Migrating from a legacy wicked < 1.0.0 data source');
        } else {
            info('Migrating from a wicked >= 1.0.0 data source');
        }
        return callback(null);
    }

    isLegacyMigration() {
        return this._migrationFromLegacy;
    }

    static getCustomIdPrefix(customId) {
        const colonIndex = customId.indexOf(':');
        if (colonIndex < 0) {
            return null;
        }
        const prefix = customId.substring(0, colonIndex);
        if (prefix.indexOf(' ') >= 0) {
            return null;
        }
        return prefix;
    }

    static getCustomIdWithoutPrefix(customId) {
        const colonIndex = customId.indexOf(':');
        return customId.substring(colonIndex + 1);
    }

    mapCustomId(customId) {
        if (!customId) {
            return null;
        }
        const prefix = DaoMigrator.getCustomIdPrefix(customId);
        if (!prefix) {
            const defaultPrefix = this._config.customIdMappings.defaultPrefix;
            return `${defaultPrefix}:${customId}`;
        }
        // We have a prefix, and we checked in the validation that it's valid
        const newPrefix = prefix !== 'internal' ? this._config.customIdMappings.prefixes[prefix] : 'internal';
        const idWithoutPrefix = DaoMigrator.getCustomIdWithoutPrefix(customId);
        return `${newPrefix}:${idWithoutPrefix}`;
    }

    validateSourceUsers(source, migrationConfig, callback) {
        debug('validateSourceUsers()');

        // We only need to do this if we have a migration from legacy (<1.0.0) data.
        // Otherwise we assume that the data comes from a wicked 1.0.0+ installation,
        // and there we needn't map the auth method prefixes.
        if (this.isLegacyMigration()) {
            return callback(null);
        }

        const instance = this;
        let hasEmptyCustomIdPrefixes = false;
        const customIdPrefixSet = new Set();
        pagePerUser(source, (userId, callback) => {
            source.users.getById(userId, (err, userInfo) => {
                if (err) {
                    return callback(err);
                }
                if (!userInfo.customId) {
                    return callback(null);
                }
                const prefix = DaoMigrator.getCustomIdPrefix(userInfo.customId);
                if (!prefix) {
                    hasEmptyCustomIdPrefixes = true;
                } else {
                    if (prefix !== 'internal' && !customIdPrefixSet.has(prefix)) {
                        customIdPrefixSet.add(prefix);
                    }
                }
                callback(null);
            });
        }, (err) => {
            if (err) {
                return callback(err);
            }
            // Validate that all prefixes have a mapping, and in case we have empty
            // prefixes, validate that there's a default prefix mapping.

            // If we don't have any users with a customId, we are finished
            if (!hasEmptyCustomIdPrefixes && customIdPrefixSet.size === 0) {
                return callback(null);
            }

            let success = true;
            if (hasEmptyCustomIdPrefixes) {
                if (!migrationConfig.customIdMappings || !migrationConfig.customIdMappings.defaultPrefix) {
                    success = false;
                    instance.addSevereWarning('Migration configuration for empty customId prefixes missing.',
                        'In your data, there are users having a custom ID (federated identity) without a prefix mapping; this is not allowed in wicked 1.0.0, all custom IDs must have a prefix mapping. Specify the default mapping in your migration configuration as customIdMappings.defaultPrefix (see example payload). This prefix must match the Auth Method ID for this Identity Provider.',
                        {
                            customIdMappings: {
                                defaultPrefix: 'someprefix'
                            }
                        }, 'ERROR');
                }
            }

            if (customIdPrefixSet.size > 0) {
                if (migrationConfig.customIdMappings && migrationConfig.customIdMappings.prefixes) {
                    for (let authMethodPrefix of customIdPrefixSet) {
                        if (!migrationConfig.customIdMappings.prefixes[authMethodPrefix]) {
                            success = false;
                            const examplePayload = {
                                customIdMappings: {
                                    prefixes: {}
                                }
                            };
                            examplePayload.customIdMappings.prefixes[authMethodPrefix] = authMethodPrefix.toLowerCase();
                            instance.addSevereWarning(`Migration configuration for custom ID prefix ${authMethodPrefix} to auth method ID missing.`,
                                'For the above custom ID prefix there must exist a mapping to a new auth method ID for the default authorization server. See example payload.',
                                examplePayload,
                                'ERROR');
                        }
                    }
                } else {
                    success = false;
                    instance.addSevereWarning('Migration configuration for custom ID/auth method ID prefix mapping missing',
                        'In order to ensure a correct mapping of identities between your previous installation and the wicked 1.0.0+ installation, there has to be a list of custom ID prefix mappings to auth method IDs in your migration configuration. See payload for an example.',
                        {
                            customIdMappings: {
                                prefixes: {
                                    Google: 'google',
                                    Github: 'github'
                                }
                            }
                        }, 'ERROR');
                }
            }


            if (!success) {
                return callback(new Error('validateSourceUsers failed; see warning list.'));
            }
            return callback(null);
        });
    }

    migrateEntities(source, target, callback) {
        debug('migrateEntities()');

        const steps = [
            DaoMigrator.migrateUsers,
            DaoMigrator.migrateRegistrations,
            // DaoMigrator.migrateVerifications,
            DaoMigrator.migrateApplications,
            DaoMigrator.migrateSubscriptions,
            DaoMigrator.migrateApprovals
        ];

        const instance = this;
        buildDupeAppsSet(source, (err, dupeAppsSet) => {
            if (err) {
                return callback(err);
            }
            this._dupeAppsSet = dupeAppsSet;
            async.eachSeries(steps, (step, callback) => setImmediate(step, instance, source, target, callback), callback);
        });
    }

    static migrateUsers(instance, source, target, callback) {
        debug('migrateUsers()');
        info('Migrating Users');
        pagePerUser(source, (userId, callback) => DaoMigrator.migrateUser(instance, source, target, userId, callback), callback);
    }

    static migrateUser(instance, source, target, userId, callback) {
        debug(`migrateUser(${userId})`);
        source.users.getById(userId, (err, userInfo) => {
            if (err) {
                return callback(err);
            }
            info(`Migrating user ${userInfo.id}`);
            if (instance.isLegacyMigration()) {
                userInfo.customId = instance.mapCustomId(userInfo.customId);
            }

            target.users.create(userInfo, (err) => {
                if (err) {
                    return callback(err);
                }
                if (instance.isLegacyMigration()) {
                    return DaoMigrator.createWickedRegistration(target, userInfo, callback);
                }
                return callback(null);
            });
        });
    }

    static createWickedRegistration(target, userInfo, callback) {
        debug(`createWickedRegistration(${userInfo.id})`);
        const name = daoUtils.makeName(userInfo);
        const regInfo = {
            poolId: 'wicked',
            userId: userInfo.id,
            name: name
        };
        target.registrations.upsert('wicked', userInfo.id, null, regInfo, callback);
    }

    static migrateRegistrations(instance, source, target, callback) {
        debug('migrateRegistrations()');
        // We'll have to go by user here; no way of retrieving ALL registrations currently.
        pagePerUser(source, (userId, callback) => DaoMigrator.migrateRegistrationsForUser(source, target, userId, callback), callback);
    }

    static migrateRegistrationsForUser(source, target, userId, callback) {
        debug(`migrateRegistrationsForUser(${userId})`);
        info(`Migrating registrations for user ${userId}`);
        source.registrations.getByUser(userId, (err, userRegs) => {
            if (err) {
                return callback(err);
            }
            const poolArray = [];
            for (let poolId in userRegs.pools) {
                poolArray.push(poolId);
            }
            async.eachSeries(poolArray, (poolId, callback) => {
                const regInfo = userRegs.pools[poolId];
                debug(`Migrating registration for pool ${poolId} for user "${regInfo.name}" (${regInfo.userId})`);
                target.registrations.upsert(poolId, regInfo.userId, null, regInfo, callback);
            }, callback);
        });
    }

    // I don't think it really makes sense to migrate verifications; they expire
    // within one hour anyway.

    // static migrateVerifications(source, target, callback) {
    //     debug('migrateVerifications()');
    //     return callback(null);
    // }

    static migrateApplications(instance, source, target, callback) {
        debug('migrateApplications()');
        info('Migrating Applications');
        pagePerApplication(source, (appId, callback) => {
            info(`Migration application ${appId}`);
            DaoMigrator.migrateApplication(instance, source, target, appId, callback);
        }, callback);
    }

    static migrateApplication(instance, source, target, appId, callback) {
        source.applications.getById(appId, (err, appInfo) => {
            if (err) {
                return callback(err);
            }
            if (!appInfo) {
                warn(`migrateApplication: Could not load application with id ${appId}`);
                return callback(null);
            }
            debug(appInfo);
            // This thing also contains the owners, so let's add those as well afterwards.
            const ownerList = appInfo.owners;
            // But first add the app without owners
            appInfo.owners = [];
            if (instance._dupeAppsSet.has(appInfo.id)) {
                warn(`migrationApplication: Skipping migration of duplicate application ${appInfo.id}`);
                instance.addSevereWarning(`APPLICATION: Migration of "${appInfo.id}" was skipped, as it is duplicate.`,
                    'Such applications are not migrated at all, as the subscriptions may under certain circumstances have been mixed up. This requires action from your side; you will need to contact the owner of the application (see owner list)',
                    ownerList);
            }
            appInfo.id = appInfo.id.toLowerCase();
            target.applications.create(appInfo, null, (err, _) => {
                if (err) {
                    return callback(err);
                }

                // And now we add the owners
                async.eachSeries(ownerList, (ownerInfo, callback) => {
                    if (err) {
                        return callback(err);
                    }
                    target.applications.addOwner(appInfo.id, ownerInfo.userId, ownerInfo.role, appInfo.changedBy, callback);
                }, callback);
            });
        });
    }

    static migrateSubscriptions(instance, source, target, callback) {
        debug('migrateSubscriptions()');
        info('Migrating Subscriptions');
        pagePerApplication(source, (appId, callback) => DaoMigrator.migrateSubscriptionsForApplication(instance, source, target, appId, callback), callback);
    }

    static migrateSubscriptionsForApplication(instance, source, target, appId, callback) {
        debug(`migrateSubscriptionsForApplication(${appId})`);
        source.subscriptions.getByAppId(appId, (err, subsInfoList) => {
            debug(subsInfoList);
            async.eachSeries(subsInfoList, (subsInfo, callback) => {
                if (instance._dupeAppsSet.has(subsInfo.application)) {
                    warn(`migrateSubscriptionsForApplication: Skipping dupe application ${subsInfo.application}`);
                    instance.addSevereWarning(`SUBSCRIPTIONS: Skipping subscription to API ${subsInfo.api} for application ${subsInfo.application}`,
                        'The migration has detected a subscription to an API for an application which is duplicate. These subscriptions will NOT have been migrated. See above for a list of duplicate applications.');
                    instance._skippedSubscriptions.add(subsInfo.id);
                    return callback(null);
                }
                subsInfo.application = subsInfo.application.toLowerCase();
                info(`Migrating subscription to API ${subsInfo.api} for application ${subsInfo.application}`);
                if (err) {
                    return callback(err);
                }
                target.subscriptions.create(subsInfo, subsInfo.changedBy, callback);
            }, callback);
        });
    }

    static migrateApprovals(instance, source, target, callback) {
        debug('migrateApprovals()');
        info('Migrating Approvals');
        // The approvals endpoint does not support paging
        source.approvals.getAll((err, approvalList) => {
            if (err) {
                return callback(err);
            }

            async.eachSeries(approvalList, (approvalInfo, callback) => {
                if (instance._skippedSubscriptions.has(approvalInfo.subscriptionId)) {
                    warn(`Skipped approval records for subscription ${approvalInfo.subscriptionId} (application ${approvalInfo.application.id})`);
                    return callback(null);
                }
                // Older versions of wicked did not create a dedicated ID for approvals; so check for that.
                if (!approvalInfo.id) {
                    approvalInfo.id = utils.createRandomId();
                }
                target.approvals.create(approvalInfo, callback);
            }, callback);
        });
    }

    sanityCheckConfig() {
        debug('sanityCheckConfig()');
        const c = this._config;
        if (!c.source) {
            throw new Error('configuration does not contain a "source" property.');
        }
        if (!c.target) {
            throw new Error('configuration does not contain a "target" property.');
        }
        this.validateDaoConfig(c.source);
        this.validateDaoConfig(c.target);
    }

    validateDaoConfig(c) {
        debug('validateDaoConfig()');
        if (c.type === 'json') {
            return this.validateJsonConfig(c);
        } else if (c.type === 'postgres') {
            return this.validatePostgresConfig(c);
        }
        throw new Error(`validateDaoConfig: unknown DAO type ${c.type}`);
    }

    validateJsonConfig(c) {
        debug('validateJsonConfig()');
        if (!c.config || !c.config.basePath) {
            throw new Error('JSON configuration does not contain a "config" or "config.basePath" property.');
        }
    }

    validatePostgresConfig(c) {
        debug('validatePostgresConfig()');
        if (!c.config) {
            throw new Error('Postgres configuration does not contain a "config" property.');
        }
        if (!c.config.host) {
            throw new Error('Postgres configuration does not contain a "config.host" property.');
        }
        if (!c.config.port) {
            throw new Error('Postgres configuration does not contain a "config.port" property.');
        }
        if (!c.config.user) {
            throw new Error('Postgres configuration does not contain a "config.user" property.');
        }
        if (!c.config.password) {
            throw new Error('Postgres configuration does not contain a "config.password" property.');
        }
        if (!c.config.database) {
            warn('Using default database name "wicked".');
            c.config.database = 'wicked';
        }
        if (!c.config.pgDatabase) {
            c.config.pgDatabase = c.config.database;
        }

    }

    createDaoByType(config, isTarget, callback) {
        if (config.type === 'json') {
            return this.createJsonDao(config, isTarget, callback);
        } else if (config.type === 'postgres') {
            return this.createPostgresDao(config, callback);
        }
        return callback(new Error(`Unknown DAO type ${config.type}`));
    }

    createDao(config, wipeDao, isTarget, callback) {
        debug('createDao()');
        this.createDaoByType(config, isTarget, (err, dao) => {
            if (err) {
                return callback(err);
            }

            const wipeIfNecessary = (_, callback) => {
                debug('wipeIfNecessary()');
                if (wipeDao) {
                    return dao.meta.wipe(callback);
                }
                debug('wipeIfNecessary(): Not necessary');
                return callback(null);
            };

            const initChecks = dao.meta.getInitChecks();
            const checks = [wipeIfNecessary, ...initChecks];

            async.eachSeries(checks, (check, callback) => check(null, callback), (err) => {
                if (err) {
                    return callback(err);
                }
                info(`Successfully created ${config.type} DAO.`);
                return callback(null, dao);
            });
        });
    }

    createJsonDao(daoConfig, isTarget, callback) {
        debug('createJsonDao()');
        if (!isTarget) {
            // Make a copy of the original first, and then work off that; clean up the copy post-fact
            const tmpDir = fs.mkdtempSync('wicked_migration');
            debug(`createJsonDao(): Using tmp dir ${tmpDir}`);
            this.hookCleanup((callback) => {
                debug(`cleanupJsonDao(): Cleaning up ${tmpDir}`);
                rimraf(tmpDir, callback);
            });
            ncp(daoConfig.config.basePath, tmpDir, (err) => {
                if (err) {
                    return callback(err);
                }
                debug(`createJsonDao(): Successfully copied files to ${tmpDir}`);
                return callback(null, new JsonDao(tmpDir));
            });
        } else {
            // The DAO is the target, so we'll work directly on the given path
            return callback(null, new JsonDao(daoConfig.config.basePath));
        }
    }

    createPostgresDao(daoConfig, callback) {
        return callback(null, new PgDao(daoConfig.config));
    }
}

const LIMIT = 5;

function page(count, iterator, callback) {
    debug(`page(${count})`);
    const iterations = Math.ceil(count / LIMIT);
    debug(`page() will call iterator ${iterations} times.`);
    async.timesSeries(iterations, (n, callback) => {
        const offset = n * LIMIT;
        let limit = LIMIT;
        if (count - offset < LIMIT) {
            limit = count - offset;
        }
        debug(`page(offset: ${offset}, limit: ${limit})`);
        return iterator(offset, limit, callback);
    }, callback);
}

function pagePerUser(source, iterator, callback) {
    debug(`pagePerUser()`);
    source.users.getCount((err, userCount) => {
        if (err) {
            return callback(null);
        }
        debug(`User count: ${userCount}`);

        const dupeMap = new Set();

        page(userCount, (offset, limit, callback) => {
            source.users.getIndex(offset, limit, (err, userIndex) => {
                if (err) {
                    return callback(err);
                }
                async.eachSeries(userIndex, (userInfo, callback) => {
                    if (dupeMap.has(userInfo.id)) {
                        warn(`pagePerUser(): Detected duplicate user id ${userInfo.id} in index, skipping.`);
                        return callback(null);
                    }
                    dupeMap.add(userInfo.id);
                    return iterator(userInfo.id, callback);
                }, callback);
            });
        }, callback);
    });
}

function pagePerApplication(source, iterator, callback) {
    debug(`pagePerApplication()`);
    source.applications.getCount((err, appCount) => {
        if (err) {
            return callback(err);
        }
        debug(`Application count: ${appCount}`);

        const dupeMap = new Set();
        page(appCount, (offset, limit, callback) => {
            source.applications.getIndex(offset, limit, (err, appIndex) => {
                if (err) {
                    return callback(err);
                }
                async.eachSeries(appIndex, (appInfo, callback) => {
                    const lowerAppId = appInfo.id.toLowerCase();
                    if (dupeMap.has(lowerAppId)) {
                        warn(`Detected duplicate Application id ${appInfo.id} in index, skipping`);
                        return callback(null);
                    }
                    dupeMap.add(lowerAppId);
                    return iterator(appInfo.id, callback);
                }, callback);
            });
        }, callback);
    });
}

function buildDupeAppsSet(source, callback) {
    source.applications.getCount((err, appCount) => {
        if (err) {
            return callback(err);
        }
        debug(`Application count: ${appCount}`);

        const appMap = new Map();
        const dupeMap = new Set();
        page(appCount, (offset, limit, callback) => {
            source.applications.getIndex(offset, limit, (err, appIndex) => {
                if (err) {
                    return callback(err);
                }
                for (let i = 0; i < appIndex.length; ++i) {
                    const appId = appIndex[i].id;
                    const a = appIndex[i].id.toLowerCase();
                    if (appMap.has(a)) {
                        const aa = appMap.get(a);
                        warn(`buildDupeMap: Found duplicate application ID ${appId} (also as ${aa})`);
                        dupeMap.add(appId);
                        dupeMap.add(aa);
                        continue;
                    }
                    appMap.set(a, appId);
                }
                return callback(null);
            });
        }, (err) => {
            if (err) {
                return callback(err);
            }
            return callback(null, dupeMap);
        });
    });
}

module.exports = DaoMigrator;