# Using redis as a session store

From version 1.0 on, the only possible session management store will be redis. This enables scaling and/or HA support for the API Portal, and also for the [Authorization Server](oauth2-support.md).

The redis instance is also automatically used for the Kong deployment to store rate limiting data; this can be a lot faster than using the `cluster` policy which stores things in the Postgres database.

