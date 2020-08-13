'use strict';

// All models have an implicit "id" field which is not mentioned in the properties.
// Additionally, all tables are assumed to have a field "data" which can store JSON
// data. This is where all additional payload, which does not have to be indexed, is
// stored.
//
// This model is supposed to be DAO independent, but is currently possibly biased
// towards the Postgres DAO implementation.
const model = {

    users: {
        properties: {
            custom_id: {
                property_name: 'customId',
                optional: true
            },
            // name: {},
            email: {}
        }
    },

    applications: {
        properties: {}
    },

    owners: {
        properties: {
            users_id: {
                property_name: 'userId'
            },
            applications_id: {
                property_name: 'appId'
            }
        }
    },

    subscriptions: {
        properties: {
            applications_id: {
                property_name: 'application'
            },
            plan_id: {
                property_name: 'plan'
            },
            api_id: {
                property_name: 'api'
            },
            client_id: {
                optional: true,
                property_name: 'clientId'
            },
            api_group: {
                property_name: 'api_group',
                optional: true
            },
        },
    },

    verifications: {
        properties: {
            users_id: {
                property_name: 'userId'
            }
        }
    },

    approvals: {
        properties: {
            subscriptions_id: {
                property_name: 'subscriptionId'
            }
        }
    },

    webhook_listeners: {
        properties: {}
    },

    webhook_events: {
        properties: {
            webhook_listeners_id: {
                property_name: 'listenerId'
            }
        }
    },

    registrations: {
        properties: {
            pool_id: {
                property_name: 'poolId'
            },
            users_id: {
                property_name: 'userId'
            },
            namespace: {
                optional: true
            },
            name: {}
        }
    },

    grants: {
        properties: {
            users_id: {
                property_name: 'userId'
            },
            application_id: {
                property_name: 'applicationId'
            },
            api_id: {
                property_name: 'apiId'
            }
        }
    },

    namespaces: {
        properties: {
            pool_id: {
                property_name: 'poolId'
            },
            namespace: {},
            description: {}
        }
    },

    audit_log: {
        properties: {}
    },


    access_tokens: {
        properties: {
            access_token: {},
            refresh_token: {
                optional: true
            },
            authenticated_userid: {
                optional: true
            },
            users_id: {
                optional: true
            },
            expires: {},
            expires_refresh: {
                optional: true
            },
        }
    },

};

module.exports = model;
