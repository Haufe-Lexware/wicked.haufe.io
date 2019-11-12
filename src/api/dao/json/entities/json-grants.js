'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:registrations');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');
const daoUtils = require('../../dao-utils');

class JsonGrants {
    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getByUserApplicationAndApi(userId, applicationId, apiId, callback) {
        debug(`getByUserApplicationAndApi(${userId}, ${applicationId}, ${apiId})`);
        this.jsonUtils.checkCallback(callback);
        let grantInfo;
        try {
            grantInfo = this.getByApiApplicationAndUserSync(userId, applicationId, apiId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, grantInfo);
    }

    getByUser(userId, callback) {
        debug(`getByUser(${userId})`);
        this.jsonUtils.checkCallback(callback);
        let grantList;
        try {
            grantList = this.getByUserSync(userId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, grantList, { count: grantList.length, cached: false });
    }

    deleteByUser(userId, deletingUserId, callback) {
        debug(`deleteByUser(${userId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteByUserSync(userId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    upsert(userId, applicationId, apiId, upsertingUserId, grantsInfo, callback) {
        debug(`upsert(${userId}, ${applicationId}, ${apiId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.upsertSync(userId, applicationId, apiId, grantsInfo);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    delete(userId, applicationId, apiId, deletingUserId, callback) {
        debug(`delete(${userId}, ${applicationId}, ${apiId})`);
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteSync(userId, applicationId, apiId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    getByApiApplicationAndUserSync(userId, applicationId, apiId) {
        debug(`getByApiApplicationAndUserSync(${userId}, ${applicationId}, ${apiId})`);
        // Delegate to getByUserSync
        const grantList = this.getByUserSync(userId);
        const grantIndex = grantList.findIndex(g => g.apiId === apiId && g.applicationId === applicationId);
        if (grantIndex < 0) {
            throw utils.makeError(404, `User ${userId} does not have a grants record for API ${apiId} for application ${applicationId}`);
        }
        return grantList[grantIndex];
    }

    getByUserSync(userId) {
        debug(`getByUserSync(${userId})`);
        const grantList = this.readGrants(userId);
        return grantList;
    }

    deleteByUserSync(userId) {
        debug(`deleteByUserSync(${userId})`);
        const grantsFile = this.getGrantsFile(userId);
        if (fs.existsSync(grantsFile)) {
            debug(`deleting file ${grantsFile}`);
            fs.unlinkSync(grantsFile);
        } else {
            debug(`file ${grantsFile} not found, ignoring`);
        }
    }

    upsertSync(userId, applicationId, apiId, grantsInfo) {
        debug(`upsert(${userId}, ${applicationId}, ${apiId})`);
        debug(grantsInfo);

        const grantsIndex = this.readGrants(userId);
        const prevIndex = grantsIndex.findIndex(g => g.apiId === apiId && g.applicationId === applicationId);
        let prevGrants = null;
        if (prevIndex >= 0) {
            prevGrants = grantsIndex[prevIndex];
        }
        daoUtils.mergeGrantData(prevGrants, grantsInfo);
        if (prevIndex >= 0) {
            grantsIndex[prevIndex] = grantsInfo;
        } else {
            grantsIndex.push(grantsInfo);
        }
        this.writeGrants(userId, grantsIndex);
    }

    deleteSync(userId, applicationId, apiId) {
        debug(`deleteSync(${userId}, ${applicationId}, ${apiId})`);

        const grantsIndex = this.readGrants(userId);
        const prevIndex = grantsIndex.findIndex(g => g.apiId === apiId && g.applicationId === applicationId);
        if (prevIndex < 0) {
            throw utils.makeError(404, `User ${userId} does not have any grants for API ${apiId} and application ${applicationId}`);
        }
        grantsIndex.splice(prevIndex, 1);
        this.writeGrants(userId, grantsIndex);
    }

    /*
    Grants files look like this:
    
    [
        {
            "apiId": "some-api",
            "applicationId": "some-application"
            "userId": "<the user id>",
            "grants": [
                {
                    "scope": "<some scope>",
                    "grantedDate": "<date/time>"
                }
            ]
        },
        ...
    ]
     */

    getGrantsFile(userId) {
        const grantsDir = path.join(this.jsonUtils.getDynamicDir(), 'grants');
        const grantsFile = path.join(grantsDir, `${userId}.json`);
        return grantsFile;
    }

    readGrants(userId) {
        const grantsFile = this.getGrantsFile(userId);
        if (!fs.existsSync(grantsFile)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    }

    static sanityCheckGrants(userId, grants) {
        const apiIdMap = {};
        for (let i = 0; i < grants.length; ++i) {
            const apiAppId = `${grants[i].apiId}#${grants[i].applicationId}`;
            if (apiIdMap[apiAppId]) {
                throw utils.makeError(500, `Grants: Invalid state, API#Application ${apiAppId} is duplicate`);
            }
            if (grants[i].userId !== userId) {
                throw utils.makeError(500, `Grants: User ID mismatch (${userId} != ${grants[i].userId})`);
            }
            apiIdMap[apiAppId] = true;
        }
    }

    writeGrants(userId, grants) {
        const grantsFile = this.getGrantsFile(userId);
        JsonGrants.sanityCheckGrants(userId, grants);
        fs.writeFileSync(grantsFile, JSON.stringify(grants, null, 2), 'utf8');
    }
}

module.exports = JsonGrants;
