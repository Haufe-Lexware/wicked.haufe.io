'use strict';

const { debug, info, warn, error } = require('portal-env').Logger('portal-api:dao:json:verifications');
const fs = require('fs');
const path = require('path');

const utils = require('../../../routes/utils');

class JsonVerifications {

    constructor(jsonUtils) {
        this.jsonUtils = jsonUtils;
    }


    // =================================================
    // DAO contract
    // =================================================

    create(verifInfo, callback) {
        debug('create()');
        this.jsonUtils.checkCallback(callback);
        let persistedVerif;
        try {
            persistedVerif = this.createSync(verifInfo);
        } catch (err) {
            return callback(err);
        }
        return callback(null, persistedVerif);
    }

    getAll(callback) {
        debug('getAll()');
        this.jsonUtils.checkCallback(callback);
        let verifs;
        try {
            verifs = this.loadVerifications();
        } catch (err) {
            return callback(err);
        }
        return callback(null, verifs);
    }

    getById(verificationId, callback) {
        debug(`getById(${verificationId})`);
        this.jsonUtils.checkCallback(callback);
        let verif;
        try {
            verif = this.getByIdSync(verificationId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, verif);
    }

    delete(verificationId, callback) {
        debug(`delete(${verificationId}`);
        this.jsonUtils.checkCallback(callback);
        let deletedVerif;
        try {
            deletedVerif = this.deleteSync(verificationId);
        } catch (err) {
            return callback(err);
        }
        return callback(null, deletedVerif);
    }

    reconcile(expirySeconds, callback) {
        debug('reconcile()');
        this.jsonUtils.checkCallback(callback);
        try {
            this.reconcileSync(expirySeconds);
        } catch (err) {
            return callback(err);
        }
        return callback(null);
    }

    // =================================================
    // DAO implementation/internal methods
    // =================================================

    loadVerifications() {
        debug('loadVerifications()');
        const verificationsDir = path.join(this.jsonUtils.getDynamicDir(), 'verifications');
        const verificationsFile = path.join(verificationsDir, '_index.json');
        if (!fs.existsSync(verificationsFile)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(verificationsFile, 'utf8'));
    }

    saveVerifications(verificationInfos) {
        debug('saveVerifications()');
        debug(verificationInfos);
        const verificationsDir = path.join(this.jsonUtils.getDynamicDir(), 'verifications');
        const verificationsFile = path.join(verificationsDir, '_index.json');
        fs.writeFileSync(verificationsFile, JSON.stringify(verificationInfos, null, 2), 'utf8');
    }

    createSync(verifInfo) {
        debug('createSync()');
        const instance = this;
        return this.jsonUtils.withLockedVerifications(() => {
            const verifs = instance.loadVerifications();
            verifs.push(verifInfo);
            instance.saveVerifications(verifs);
            return verifInfo;
        });
    }

    getByIdSync(verificationId) {
        debug('getByIdSync()');
        const verifs = this.loadVerifications();
        const thisVerif = verifs.find(verif => verif.id === verificationId);
        if (!thisVerif) {
            return null;
        }
        return thisVerif;
    }

    deleteSync(verificationId) {
        debug('deleteSync()');
        const instance = this;
        return this.jsonUtils.withLockedVerifications(function () {
            const verifs = instance.loadVerifications();
            let verifIndex = -1;
            for (let i = 0; i < verifs.length; ++i) {
                if (verifs[i].id === verificationId) {
                    verifIndex = i;
                    break;
                }
            }
            if (verifIndex < 0) {
                return utils.makeError(404, 'Not found. Verification ID not found.');
            }
            const thisVerif = verifs[verifIndex];
            verifs.splice(verifIndex, 1);

            instance.saveVerifications(verifs);

            return thisVerif;
        });
    }

    reconcileSync(expirySeconds) {
        debug('reconcileSync()');
        let lockedVerifs = false;
        try {
            if (!this.jsonUtils.lockVerifications()) {
                return;
            }
            lockedVerifs = true;

            const verifs = this.loadVerifications();

            let found = true;
            let changedSomething = false;
            const rightNow = utils.getUtc();
            while (found) {
                let expiredIndex = -1;
                for (let i = 0; i < verifs.length; ++i) {
                    const thisVerif = verifs[i];
                    if ((rightNow - thisVerif.utc) > expirySeconds) {
                        debug('Found expired record, removing ' + thisVerif.id);
                        expiredIndex = i;
                        break;
                    }
                }
                if (expiredIndex < 0) {
                    found = false;
                } else {
                    verifs.splice(expiredIndex, 1);
                    changedSomething = true;
                }
            }

            if (changedSomething) {
                this.saveVerifications(verifs);
            }
        } finally {
            if (lockedVerifs) {
                this.jsonUtils.unlockVerifications();
            }
        }
    }
}

module.exports = JsonVerifications;
