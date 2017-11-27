**Note**: This is work in progress.

# Postgres DB Migration

wicked.haufe.io's database until 0.12 was a plain JSON file store, which had the following issues:

* Difficult to index for various ids
* Impossible to run highly available, as the data store was inside the `portal-api` container

The reason for this in the beginning was the need to have a simple implementation which did not require additional components, such as a database. Since then, the need has arisen to enable highly available instances of the Portal API, plus that using a database as a service (DBaaS) on various cloud providers makes backing up and restoring things a lot easier than handling plain JSON files inside a container.

As of version 1.0, wicked.haufe.io will use Postgres as a storage backed for it's Portal API; this design document describes the approach, and what has to be done to implement the changes.

## Static vs. Dynamic Configuration

The API stores two types of configuration: Static and Dynamic configuration. The static configuration (`/var/portal-api/static`) is what is typically configured using the Kickstarter, and which needs a redeployment of the Portal API to take effect. The dynamic data (`/var/portal-api/dynamic`) is the user specified data, such as application registrations, user data or subscriptions.

The dynamic data is the only thing which is migrated to using a Mongo DB; the static data remains like before.

## Postgres DB entities

The following describes the necessary entities (collections) in the Postgres DB, with their indexes. The actual payload is left out.

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

TBD: Configuration of which DAO is to be used, and the connection to the data store. 

#### DAO for Mongo DB

_Component design TBD._

#### DAO for Cassandra

_Component design TBD._

#### Migration of previous JSON data

1. Check state of Mongo connection, are there entities (TBD: Which data should be used to determine whether a migration has to be done? Probably the already existing DB version; if `null` or not present --> Do a full migration of the previous data).

In case a migration JSON -> DAO is needed, continue as follows:

2. If necessary, perform previous database updates on the old data, so that the migration step has a canonical starting point, e.g. all data is in the latest format (0.11.x probably, as there were no updates to the dynamic data in the last couple of releases)
3. Read the entities and use the DAO to store the data. The DAO must be pluggable, so that it is still possible to use other types of DAOs (if that is going to be implemented).

#### Integration Testing

Tests for all DAOs must be implemented in the `portal-test` repository.

#### DAO for local storage

The previous implementation of the storage is still maintained as a "JSON DAO". The JSON DAO is not intended for any other use than local development, and should not be used for production scenarios anymore, even if it will still work. The Postgres DAO is the recommended storage DAO.

All integration tests are run both against the Postgres and the JSON storage, and will also be run with any additional DAOs which may be implemented in the future (such as Cassandra).