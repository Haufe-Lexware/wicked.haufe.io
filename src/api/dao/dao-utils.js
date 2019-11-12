'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:utils');
const utils = require('../routes/utils');

const daoUtils = function () { };

daoUtils.isUserAdmin = (userInfo) => {
    debug('isUserAdmin()');
    const groups = utils.loadGroups();

    let isAdmin = false;
    if (!userInfo.groups) {
        warn('isUserAdmin: userInfo.groups is not defined.');
        warn(userInfo);
    } else {
        for (let i = 0; i < userInfo.groups.length; ++i) {
            let groupId = userInfo.groups[i];
            for (let groupIndex = 0; groupIndex < groups.groups.length; ++groupIndex) {
                const group = groups.groups[groupIndex];
                if (groupId != group.id) {
                    continue;
                }
                if (group.adminGroup) {
                    isAdmin = true;
                    break;
                }
            }
            if (isAdmin) {
                break;
            }
        }
    }
    return isAdmin;
};

daoUtils.isUserApprover = (userInfo) => {
    debug('isUserApprover()');
    const groups = utils.loadGroups();

    let isApprover = false;
    if (!userInfo.groups) {
        warn('isUserApprover: userInfo.groups is not defined.');
        warn(userInfo);
    } else {
        for (let i = 0; i < userInfo.groups.length; ++i) {
            const groupId = userInfo.groups[i];
            for (let groupIndex = 0; groupIndex < groups.groups.length; ++groupIndex) {
                const group = groups.groups[groupIndex];
                if (groupId != group.id) {
                    continue;
                }
                if (group.approverGroup) {
                    isApprover = true;
                    break;
                }
            }
            if (isApprover) {
                break;
            }
        }
    }
    return isApprover;
};

daoUtils.checkValidatedUserGroup = (userInfo) => {
    debug('checkValidatedUserGroup()');
    if (utils.isMigrationMode()) {
        return; // Do nothing
    }
    if (!userInfo.validated) {
        return;
    }
    const globalSettings = utils.loadGlobals();
    if (!globalSettings.validatedUserGroup) {
        return;
    }
    const devGroup = globalSettings.validatedUserGroup;
    if (!userInfo.groups.find(function (group) { return group == devGroup; })) {
        userInfo.groups.push(devGroup);
    }
};

daoUtils.makeName = (userInfo) => {
    if (userInfo.firstName && userInfo.lastName) {
        return userInfo.firstName + ' ' + userInfo.lastName;
    } else if (!userInfo.firstName && userInfo.lastName) {
        return userInfo.lastName;
    } else if (userInfo.firstName && !userInfo.lastName) {
        return userInfo.firstName;
    }
    return 'Unknown User';
};

daoUtils.decryptApiCredentials = (subsList) => {
    for (let i = 0; i < subsList.length; ++i) {
        const sub = subsList[i];
        if (sub.apikey) {
            sub.apikey = utils.apiDecrypt(sub.apikey);
        }
        if (sub.clientId) {// For old installations, this may still be encrypted
            sub.clientId = utils.apiDecrypt(sub.clientId);
        }
        if (sub.clientSecret) {
            sub.clientSecret = utils.apiDecrypt(sub.clientSecret);
        }
    }
};

daoUtils.encryptApiCredentials = (subsList) => {
    for (let i = 0; i < subsList.length; ++i) {
        const sub = subsList[i];
        if (sub.apikey) {
            sub.apikey = utils.apiEncrypt(sub.apikey);
        }
        // We don't encrypt the clientId (anymore); it's needed to retrieve subscriptions
        // by client ID, and it's not a real secret anyway.
        // if (sub.clientId)
        //     sub.clientId = utils.apiEncrypt(sub.clientId);
        if (sub.clientSecret) {
            sub.clientSecret = utils.apiEncrypt(sub.clientSecret);
        }
    }
};

const listParametersImpl = (prefixArray, functionArray, o) => {
    for (let k in o) {
        const p = o[k];
        if (prefixArray.length === 0 && k === 'meta') {
            continue;
        }
        if (prefixArray.length > 0 && typeof (p) === 'function') {
            try {
                const paramList = utils.getFunctionParams(p);
                functionArray.push({
                    path: prefixArray,
                    name: k,
                    params: paramList
                });
            } catch (err) {
                error('Caught exception while inspecting: ' + prefixArray.join('.') + '.' + k);
                error(err);
            }
        } else if (typeof (p) === 'object') {
            // recurse, but clone the array as we're changing it
            const moreArray = utils.clone(prefixArray);
            moreArray.push(k);
            listParametersImpl(moreArray, functionArray, p);
        }
    }
};

// DAO Validation functions
daoUtils.listParameters = (o) => {
    const functionArray = [];
    listParametersImpl([], functionArray, o);
    return functionArray;
};

function dumpSignatures(p1, p2) {
    debug('First function');
    for (let p in p1) {
        debug(p1[p]);
    }
    debug('Second function');
    for (let p in p2) {
        debug(p2[p]);
    }
}

daoUtils.checkParameters = (desc, daoToCheck, functionList) => {
    debug(`checkParameters(${desc})`);
    let success = true;
    for (let i = 0; i < functionList.length; ++i) {
        const funcToCheck = functionList[i];
        const funcDesc = funcToCheck.path.join('.') + '.' + funcToCheck.name;
        try {
            let tmpFunc = daoToCheck;
            // Iterate down the object tree
            for (let j = 0; j < funcToCheck.path.length; ++j) {
                tmpFunc = tmpFunc[funcToCheck.path[j]];
            }
            // Finally select the function to check
            tmpFunc = tmpFunc[funcToCheck.name];
            if (!tmpFunc) {
                throw new Error(`Function ${funcDesc} was not found.`);
            }
            const paramList = utils.getFunctionParams(tmpFunc);

            if (paramList.length !== funcToCheck.params.length) {
                dumpSignatures(paramList, funcToCheck.params);
                throw new Error(`Parameter list length mismatch: ${paramList.length} !== ${funcToCheck.params.length}`);
            }

            for (let j = 0; j < paramList.length; ++j) {
                // Each param entry has a name and default value as an array, we'll only check name
                const paramNameToCheck = paramList[j][0];
                const paramName = funcToCheck.params[j][0];
                if (paramName !== paramNameToCheck) {
                    dumpSignatures(paramList, funcToCheck.params);
                    throw new Error(`Parameter naming mismatch: ${paramNameToCheck} != ${paramName}`);
                }
            }

            debug(`checkParameters ${desc}: ${funcDesc} - ok`);
        } catch (err) {
            error(`An error occurred while checking ${desc}, ${funcDesc}: ${err.message}`);
            //console.error(JSON.stringify(funcToCheck, null, 2));
            //console.error(err.stack);
            success = false;
        }
    }

    if (!success) {
        throw new Error('DAO sanity check did not pass');
    }
};

// Grants utilities

// mergeGrantData checks a previous record (prevGrants) for already existing scope grants, and takes
// over the dates to the updated grants information record (nextGrants),
daoUtils.mergeGrantData = (prevGrants, nextGrants) => {
    debug(`mergeGrantData()`);
    const now = (new Date()).toISOString();

    if (prevGrants) {
        const newGrants = [];
        for (let i = 0; i < nextGrants.grants.length; ++i) {
            const thisScope = nextGrants.grants[i];
            const prevGrantIndex = prevGrants.grants.findIndex(g => g.scope === thisScope.scope); // jshint ignore:line
            if (prevGrantIndex >= 0) {
                // Copy previous grantedDate
                newGrants.push({
                    scope: thisScope.scope,
                    grantedDate: prevGrants.grants[prevGrantIndex].grantedDate
                });
            } else {
                // New grant, use "now"
                newGrants.push({
                    scope: thisScope.scope,
                    grantedDate: now
                });
            }
        }

        // Now overwrite previous grant scopes
        nextGrants.grants = newGrants;
    } else {
        // Add current date for all scope grants
        for (let i = 0; i < nextGrants.grants.length; ++i) {
            nextGrants.grants[i].grantedDate = now;
        }
    }
};

daoUtils.ClientType = {
    Confidential: 'confidential',
    Public_SPA: 'public_spa',
    Public_Native: 'public_native'
};

// Data on the fly migration utilities; this function is used both on read and write
// to write default settings on the application data, and enables on the fly conversion
// of existing applications to a more specific client type.
daoUtils.migrateApplicationData = (appInfo) => {
    debug(`migrateApplicationOnRead(${appInfo.id})`);
    if (appInfo.clientType) {
        switch (appInfo.clientType) {
            case daoUtils.ClientType.Confidential:
                appInfo.confidential = true;
                break;
            default:
                appInfo.confidential = false;
                break;
        }
    } else {
        if (appInfo.confidential) {
            appInfo.clientType = daoUtils.ClientType.Confidential;
        } else {
            // Default to SPA type
            appInfo.clientType = daoUtils.ClientType.Public_SPA;
        }
    }
};

module.exports = daoUtils;
