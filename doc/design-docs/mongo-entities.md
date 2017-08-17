# Mongo DB Migration

wicked.haufe.io's database until 0.11 was a plain JSON file store, which had the following issues:

* Difficult to index for various ids
* Impossible to run highly available, as the data store was inside the `portal-api` container

The reason for this in the beginning was the need to have a simple implementation which did not require additional components, such as a database. Since then, the need has arisen to enable highly available instances of the Portal API, plus that using a database as a service (DBaaS) on various cloud providers makes backing up and restoring things a lot easier than handling plain JSON files inside a container.

As of version 1.0, wicked.haufe.io will use Mongo DB (or any compatible database, such as Azure Cosmos DB) as a storage backed for it's Portal API; this design document describes the approach, and what has to be done to implement the changes.

## Static vs. Dynamic Configuration

The API stores two types of configuration: Static and Dynamic configuration. The static configuration (`/var/portal-api/static`) is what is typically configured using the Kickstarter, and which needs a redeployment of the Portal API to take effect. The dynamic data (`/var/portal-api/dynamic`) is the user specified data, such as application registrations, user data or subscriptions.

The dynamic data is the only thing which is migrated to using a Mongo DB; the static data remains like before.

## Mongo DB entities

The following describes the necessary entities (collections) in the Mongo DB, with their indexes. The actual payload is left out.

### Users

```
Users
  |
  |-- _id
  |-- customId
  |-- email
```

### Applications

```
Applications
  |
  |-- _id
  |-- appId
```

### Owners



### Subscriptions

### Verifications

### Approvals

### WebhookListeners

### WebhookEvents

### Registrations

### Grants

## Implementation Packages

### Changes in `portal-api`

### Changes in `portal`
