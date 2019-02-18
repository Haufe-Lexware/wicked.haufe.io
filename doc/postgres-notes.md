# Postgres Persistence

Since version 1.0.0 of wicked, the default storage for wicked.haufe.io is Postgres, just like for Kong. This means that the two core components of wicked, the wicked API and Kong, both make use of Postgres as a storage.

Important to note here is that the databases of wicked and Kong are completely indedendent of each other. Neither of the products read or write to the databases of the other. Kong has a separate database and schema, and so does wicked.

## Default databases

In the default installation of wicked, Kong uses the database `kong`, and creates a schema `kong`, where it stores all its data. Similarly, wicked creates (or uses) a database called `wicked`, and a schema called `wicked`.

Kong will **not** create the database if it does not exist. Inside the database, Kong will create its schema `kong`.

Wicked will create the database if it does not exist, but obviously the user also needs the rights to do so. If the configured database already exists, wicked will only create a new schema `wicked`.

**The wicked and Kong databases are not shared.** This means that even if typically the same user (e.g. `kong`) is used both in Kong and for wicked, it does not have to be like that. Everything can be as separate as wanted and needed.

## Configuring the Postgres databases

The following sections assume that the configuration was created with a wicked Kickstarter v1.0.0-rc.1 or newer. Older 1.0.0 static configurations must pass through the Kickstarter once to get an updated static configuration before the overriding of the Postgres connection can work.


### When deploying in other ways (not Kubernetes)

In case you are deploying wicked in a custom way, e.g. using `docker-compose` or similarly, you will have to make sure that the following environment variables are set correctly:

Environment variable | Container | Default | Description
---------------------|-----------|---------|------------
`KONG_PG_HOST` | Kong | `wicked-database` | The FQDN or IP of the Postgres server, as seen from the Kong container
`KONG_PG_PORT` | Kong | `5432` | The port of the Postgres server
`KONG_PG_USER` | Kong | `kong` | The Kong Postgres user (with sufficient rights to create a schema)
`KONG_PG_PASSWORD` | Kong | `kong` | The password of the Kong Postgres user
`KONG_PG_DATABASE` | Kong | `kong` | The (existing!) database into which Kong persists its data; must be writable with the given user
`KONG_PG_SSL` | Kong - | The SSL mode for Postgres from Kong; set to `require` to require SSL mode

In case of the wicked Postgres connection, there are two different ways of configuring it. Either you can work directly with the [deployment environments](deployment-environments.md), or you can also pass in the values as environment variables from the outside, given that you have not changed the initial configuration of the environment variables:

Environment variable | Container | Default | Description
---------------------|-----------|---------|------------
`PORTAL_STORAGE_PGHOST` | wicked API | (_from env_) `wicked-database` | The FQDN or IP of the Postgres server, as seen from the Kong container
`PORTAL_STORAGE_PGPORT` | wicked API | (_from env_) `5432` | The port of the Postgres server
`PORTAL_STORAGE_PGUSER` | Kong | (_from env_) `kong` | The Kong Postgres user (with sufficient rights to create a schema)
`PORTAL_STORAGE_PGPASSWORD` | Kong | (_from env_) `kong` | The password of the Kong Postgres user
`PORTAL_STORAGE_PGDATABASE` | Kong | (_from env_) `wicked` | The database into which wicked persists its data; must be writable with the given user. If the database does not exist, the given user must have sufficient rights to create it.
`PGSSLMODE` | Kong - | The SSL mode for Postgres from wicked; set to `require` to require SSL mode

In the end, the most important thing is what is eventually resolved into the `globals.json` file's `storage` section. There are useful defaults defined there, and by overriding the environment variables above, the content of `globals.json` can be altered from the outside.

### When deploying to Kubernetes

The wicked [Helm Chart](../wicked) has support for configuring both the Kong database connection and the wicked database connection. There are predefined values in the [`values.yaml`](../wicked/values.yaml), both for the Kong connection and for the wicked connection.

If you have a closer look, the values from `values.yaml` only just map to envirionment variables for the deployments, so there is no real technical difference at runtime, it's just configured with slightly different mechanisms.
