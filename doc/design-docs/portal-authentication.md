# Authenticating for using the Portal

Until version 0.11 of wicked, the authentication for using the portal was separate from the authentication and/or authorization for using the APIs. This will change for release 1.0, where a generic authorization server will always be part of the wicked package, so that you can always use the built-in user database also for your own APIs, if needed.

This document describes how the Portal behaves in terms of accessing the Portal API, and how the access to the API changes when a user also authenticates with one of the configured identity providers.

## User Stories

