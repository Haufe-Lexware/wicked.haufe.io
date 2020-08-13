'use strict';

const JsonUsers = require('./entities/json-users');
const JsonApplications = require('./entities/json-applications');
const JsonApprovals = require('./entities/json-approvals');
const JsonSubscriptions = require('./entities/json-subscriptions');
const JsonVerifications = require('./entities/json-verifications');
const JsonWebhooks = require('./entities/json-webhooks');
const JsonRegistrations = require('./entities/json-registrations');
const JsonGrants = require('./entities/json-grants');
const JsonNamespaces = require('./entities/json-namespaces');
const JsonAccessTokens = require('./entities/json-accesstokens');
const JsonMeta = require('./json-meta');
const JsonUtils = require('./entities/json-utils');
const JsonAuditlog = require('./entities/json-auditlog');

// ================================================

class JsonDao {
    constructor(dynamicBasePath) {
        this.jsonUtils = new JsonUtils(dynamicBasePath);
        this.jsonMeta = new JsonMeta(this.jsonUtils);
        this.jsonUsers = new JsonUsers(this.jsonUtils);
        this.jsonApprovals = new JsonApprovals(this.jsonUtils);
        this.jsonSubscriptions = new JsonSubscriptions(this.jsonUtils, this.jsonApprovals);
        this.jsonApplications = new JsonApplications(this.jsonUtils, this.jsonUsers, this.jsonSubscriptions, this.jsonApprovals);
        this.jsonGrants = new JsonGrants(this.jsonUtils);
        this.jsonVerifications = new JsonVerifications(this.jsonUtils);
        this.jsonRegistrations = new JsonRegistrations(this.jsonUtils);
        this.jsonWebhooks = new JsonWebhooks(this.jsonUtils);
        this.jsonNamespaces = new JsonNamespaces(this.jsonUtils);
        this.jsonAuditlog = new JsonAuditlog(this.jsonAuditlog);
        this.jsonAccessTokens = new JsonAccessTokens(this.jsonUtils);
    }

    init(app) {
    }

    get meta() { return this.jsonMeta; }
    get users() { return this.jsonUsers; }
    get applications() { return this.jsonApplications; }
    get subscriptions() { return this.jsonSubscriptions; }
    get verifications() { return this.jsonVerifications; }
    get approvals() { return this.jsonApprovals; }
    get registrations() { return this.jsonRegistrations; }
    get grants() { return this.jsonGrants; }
    get namespaces() { return this.jsonNamespaces; }
    get webhooks() { return this.jsonWebhooks; }
    get auditlog() { return this.jsonAuditlog; }
    get accessTokens() { return this.jsonAccessTokens; }
}

module.exports = JsonDao;
