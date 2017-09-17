**Note**: This is work in progress.

# Using redis as a session store

From version 1.0 on, the only possible session management store will be redis. This enables scaling and/or HA support for the API Portal, and also for the [Authorization Server](oauth2-support.md).

Open questions:

* Do the Authorization Server and the Portal need separate redis instances? The two applications MUST NOT share the sessions.
* Thoughts: They usually wouldn't, as they are served over separate hosts (portal host and gateway host, respectively).

## Fallback sessions in files (like before)

For local testing purposes, the `portal` should still be able to use a file based session management, so that a redis servers is not necessarily needed for local development.

## Implementation Packages

### Changes in `portal`

### Authorization Server
