# Design Document: Better OAuth 2 support out of the box

## Outline

Until version 0.11, wicked needed a separate authorization server (such as `wicked.auth-saml` or `wicked.auth-passport`) to support other OAuth 2 flows other than the client credentials flow (which is supported "out of the box" by the API Gateway, i.e. Kong).

This design document describes how the OAuth 2 support shall be increased for a 1.0 release of wicked, to support the full range of OAuth 2 standard flows out of the box, including user management and grants management for end users.

## Main User Stories

The following user stories were considered during the creation of this design document.

### Securing APIs using the same mechanism as for logging in to the Portal

As an operator of wicked for my APIs, I want to be able to secure my API out of the box with the usual social logins, by leveraging the same client credentials (for Google, GitHub,...) as I used for the portal login.

### Using the wicked user database for OAuth 2

Special case of the above: As an API Management operator, I want to be able to use wicked's own user database for doing OAuth 2 flows. This enables me to test flows without having to gather external credentials; this is especially useful when evaluating wicked or when trying out new APIs.

### External API usage

As a developer using the API Portal, I want to be able to use the Portal's API from outside the actual Portal's UI, using standard OAuth 2 flows (implicit or authorization code grant, or, if I choose to use local usernames and passwords, using the resource owner password grant). I want to accomplish this by logging in with the same identity providers as for the portal.

### Enabling custom username/password authentication

(Prio 3)

As an operator of the API Management system, I want to be able to authenticate users via username and password via a REST call to third party system (which I implement myself), instead of using either the built in user database or any federated user store (such as Google or Github).

## Optional/enhancement user stories

### Enabling "license" scopes

As an operator of the API Management system, I want to be able to query an external system (via a REST) call to retrieve licenses/OAuth2 scopes from a third party, based on the authenticated user id.

## Changes in the `portal-api` component

In order to behave as a regular OAuth 2 enabled API, the `portal-api` component needs to be changed.

## Adding a standard authorization server (`wicked.portal-auth`)

wicked.haufe.io will have a standard Authorization Server, which takes over all authentication and authorization tasks from the Portal. The Portal will only be a (trusted) client of the Portal API, like almost any other application.

The Authorization Server (https://github.com/Haufe-Lexware/wicked.portal-auth) will support local users out of the box, a registration process (see [registration process design document](registration-process.md)), and after registration with other IdPs, also various social logins. 

## Enabling custom authorization servers (like before)

...

<a name="trusted_apps" />

## "Trusted" vs. other applications

...
