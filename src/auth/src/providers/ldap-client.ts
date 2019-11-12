'use strict';

import { Client } from 'ldapts';
const { debug, info, warn, error } = require('portal-env').Logger('portal-auth:ldap-client');

export class LdapClient {
    constructor(options) {
        debug(`constructor(${JSON.stringify(options)})`);
        this.ldapClient = new Client(options);
        this.hasBound = false;
        this.isDestroyed = false;
    }

    private ldapClient: any;
    private hasBound: boolean;
    private isDestroyed: boolean;

    async connect(username: string, password: string): Promise<any> {
        debug(`connect(${username}, ***)`);
        const instance = this;
        if (instance.isDestroyed) {
            throw new Error('LdapClient instance has already been destroyed. Please create a new one.');
        }
        await instance.ldapClient.bind(username, password);
        instance.hasBound = true;
    }

    async search(base: string, attributes: string[], filter: string): Promise<any[]> {
        debug(`search(${base}, ${JSON.stringify(attributes)}, ${filter}})`);
        const instance = this;
        if (instance.isDestroyed) {
            throw new Error('LdapClient instance has already been destroyed. Please create a new one.');
        }
        if (!instance.hasBound) {
            throw new Error('The client must have been connected before.')
        }
        const {
            searchEntries
        } = await instance.ldapClient.search(base, {
            scope: 'sub',
            attributes,
            filter
        });
        return searchEntries;
    }

    async checkDNPass(userDN: string, password: string): Promise<any> {
        debug(`checkDNPass(${userDN}, ***)`);
        const instance = this;
        if (instance.isDestroyed) {
            throw new Error('LdapClient instance has already been destroyed. Please create a new one.');
        }
        await instance.ldapClient.bind(userDN, password);
    }

    async destroy(): Promise<any> {
        debug('destroy()');
        const instance = this;
        if (!instance.hasBound) {
            return;
        }
        await instance.ldapClient.unbind();
    }
};