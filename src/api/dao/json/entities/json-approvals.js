'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:approvals');
const fs = require('fs');
const path = require('path');

class JsonApprovals {

    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }

    // =================================================
    // DAO contract
    // =================================================

    getAll(callback) {
        debug('getAll()');
        this.jsonUtils.checkCallback(callback);
        let approvalList;
        try {
            approvalList = this.loadApprovals();
        } catch (err) {
            return callback(err);
        }
        return callback(null, approvalList);
    }

    create(approvalInfo, callback) {
        debug('create()');
        this.jsonUtils.checkCallback(callback);
        let newApproval;
        try {
            newApproval = this.createSync(approvalInfo);
        } catch (err) {
            return callback(err);
        }
        return callback(null, newApproval);
    }

    deleteByApp(appId, callback) {
        debug('deleteByApp()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteByAppSync(appId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    deleteByAppAndApi(appId, apiId, callback) {
        debug('deleteByAppAndApi()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.deleteByAppAndApiSync(appId, apiId);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    createSync(approvalInfo) {
        debug('createSync()');
        return this.jsonUtils.withLockedApprovals(() => {
            const approvals = this.loadApprovals();
            approvals.push(approvalInfo);
            this.saveApprovals(approvals);
            return approvalInfo;
        });
    }

    deleteByAppSync(appId) {
        debug('deleteByAppSync()');

        const approvalInfos = this.loadApprovals();

        let notReady = true;
        let foundApproval = false;
        while (notReady) {
            notReady = false;
            let approvalIndex = -1;
            for (let i = 0; i < approvalInfos.length; ++i) {
                if (appId == approvalInfos[i].application.id) {
                    approvalIndex = i;
                    break;
                }
            }
            if (approvalIndex >= 0) {
                foundApproval = true;
                notReady = true;
                approvalInfos.splice(approvalIndex, 1);
            }
        }
        if (foundApproval) {
            // Persist the approvals again
            this.saveApprovals(approvalInfos);
        }
    }

    static findApprovalIndex(approvalInfos, appId, apiId) {
        let approvalIndex = -1;
        for (let i = 0; i < approvalInfos.length; ++i) {
            const appr = approvalInfos[i];
            if (appr.application.id == appId &&
                appr.api.id == apiId) {
                approvalIndex = i;
                break;
            }
        }
        return approvalIndex;
    }

    deleteByAppAndApiSync(appId, apiId) {
        debug('deleteByAppAndApiSync()');
        const instance = this;
        return this.jsonUtils.withLockedApprovals(() => {
            const approvalInfos = instance.loadApprovals();
            const approvalIndex = JsonApprovals.findApprovalIndex(approvalInfos, appId, apiId);
            if (approvalIndex >= 0) {
                approvalInfos.splice(approvalIndex, 1);
                instance.saveApprovals(approvalInfos);
            }
        });
    }

    loadApprovals() {
        debug('loadApprovals()');
        const approvalsDir = path.join(this.jsonUtils.getDynamicDir(), 'approvals');
        const approvalsFile = path.join(approvalsDir, '_index.json');
        if (!fs.existsSync(approvalsFile)) {
            throw new Error('Internal Server Error - Approvals index not found.');
        }
        return JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
    }

    saveApprovals(approvalInfos) {
        debug('saveApprovals()');
        debug(approvalInfos);
        const approvalsDir = path.join(this.jsonUtils.getDynamicDir(), 'approvals');
        const approvalsFile = path.join(approvalsDir, '_index.json');
        fs.writeFileSync(approvalsFile, JSON.stringify(approvalInfos, null, 2), 'utf8');
    }
}

module.exports = JsonApprovals;
