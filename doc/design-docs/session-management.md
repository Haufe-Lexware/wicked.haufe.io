# Using redis as a session store

From version 1.0 on, the only possible session management store will be redis. This enables scaling and/or HA support for the API Portal, and also for the [Authorization Server](oauth2-support.md).

Open questions:

* Do the Authorization Server and the Portal need separate redis instances? The two applications MUST NOT share the sessions.


## Implementation Packages

### Changes in `portal`

### Authorization Server
