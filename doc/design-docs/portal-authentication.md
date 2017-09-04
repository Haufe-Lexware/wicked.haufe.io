# Authenticating for using the Portal

Until version 0.11 of wicked, the authentication for using the portal was separate from the authentication and/or authorization for using the APIs. This will change for release 1.0, where a generic authorization server will always be part of the wicked package, so that you can always use the built-in user database also for your own APIs, if needed.

This document describes how the Portal behaves in terms of accessing the Portal API, and how the access to the API changes when a user also authenticates with one of the configured identity providers.

## User Stories

### Same Auth Methods for Portal and APIs

As an administrator of the APIm (Portal and Gateway), I want to be able to use the same authorization server, and the same auth methods, both for the portal UI as for securing access to any of my APIs.

### Selectable Auth Methods for the Portal authentication

As an adminstrator of the APIm, I want to be able to specify only a subset of auth methods for authentication from the Authorization Server for authentication in the API Portal (e.g. only allow GitHub login to Portal, but SAML access to APIs, both supported by the default Authorization Servers via differently named Auth Methods).

### Easier OAuth2 flows

As a developer, I want to be able to test my OAuth2 flows using my identity from the API portal, if this is allowed by the APIm administrator.
