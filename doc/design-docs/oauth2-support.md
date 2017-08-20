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

New as of wicked 1.0 will be that the Authorization Server takes over both the Authorize and Token endpoints from Kong, and will only delegate to Kong transparently where needed. Additionally, both (and possibly also a third end point for the OpenID Connect Profile end point) end points are now documented in the configuration of the Authorization Server, and can thus be transparently displayed in the Portal UI. This was a source of confusion in the previous versions.

### Extension of config of Auth Servers

In addition to the settings of the Authorization Server which were valid for wicked <1.0, some new configuration options are needed. Generically, the interface is defined like this:

```json
{
  "id": "auth-server",
  "name": "auth-server",
  "desc": "Description of Authorization Server auth-server",
  // This is like before, the Kong configuration for the auth server
  "config": {
    "api": {
      "name": "auth",
      "upstream_url": "http://wicked-auth:3005",
      "request_path": "/auth"
    },
    "plugins": [
      {
        "config": {
          "header_name": "Correlation-Id",
          "generator": "uuid"
        },
        "name": "correlation-id"
      }
    ]
  },
  "authMethods": [
      {
          "name": "wicked",
          // The "type" is not part of the interface to the portal UI,
          // it's an implementation detail of the Authorization Server.
          "type": "local",
          // Optional:
          "description": "Local username and password authentication",
          "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
          "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
          // Optional - OIDC profile end point:
          "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
      },
      // ...
  ]
}
```

The `name` of the `authMethods` entries is what has to be linked to an API. It will no longer work to just link an `authServer` to an API (perhaps it will, to be discussed), but instead the `name` entries from the Authorization Server(s) have to be added to a new property `authMethods` of the API.

The end point properties can be Mustache templates. The following properties are injected into them (and thus also have to be supported by the Authorization Server, if they are used):

* The `name` of the `authMethod` entry
* The `api` for which an Authorization Request should be done; this is used when displaying the information on the end points on the API page in the Portal UI, so that the end user/developer knows where to go to get access to the API.

### Supported authentication method types

#### Auth Method `local`

The Auth Method `local` uses local usernames and passwords for authentication. Even if you use multiple `authMethods` entries with `local`, they will all use the same local username and password database (TBD).

The syntax for the `local` auth method is like this:

```
{
    "name": "wicked",
    "type": "local",
    "verifyEmail": true,
    "allowSignup": true,
    "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
    "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
    "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
}
```

Set `verifyEmail` to have wicked verify the email address via a verification email sent out to the registered email address; this will only have an effect if the API you select to authenticate for requires a registration (see [registration process](registration-process.md)).

Specifying `true` as `allowSignup` allows for users to sign up for using the resource. This will entrail an additional link to "Sign up" if specified, otherwise only "Forgot password?" will be displayed.

The end points will be prepended with the API Gateway FQDN whe displaying in the Portal UI. Note that these kinds of URLs (the FQDNs) are not configured in the Authorization Server, as they are different for each deployment, and the API Gateway's FQDN is known inside the application and components anyway.

#### Auth Method `google`

Authenticate using Google(+). This requires registration of the Authorization Server with the Google Admin Console.

```
{
    "name": "google",
    "type": "google",
    "verifyEmail": true,
    "clientId": "... (get from Google)",
    "clientSecret": "... (get from Google)",
    "callbackEndpoint": "/auth/{{name}}/callback",
    "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
    "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
    "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
}
```

Note that the `type` has to be `google`, but that the `name` can be something else, e.g. `default` or `superspecial`. For each entry with the `type` set to `google`, you will need to register a new application with Google, as [described in the documentation](https://github.com/Haufe-Lexware/wicked.haufe.io/blob/master/doc/auth-google.md).

#### Auth Method `github`

Authenticate using GitHub. This requires registration of the Authorization Server with GitHub.

```
{
    "name": "github",
    "type": "github",
    "verifyEmail": true,
    "clientId": "... (get from GitHub)",
    "clientSecret": "... (get from GitHub)",
    "callbackEndpoint": "/auth/{{name}}/callback",
    "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
    "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
    "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
}
```

For each entry with the `type` set to `github`, you will need to register a new application with GitHub, as [described in the documentation](https://github.com/Haufe-Lexware/wicked.haufe.io/blob/master/doc/auth-github.md).

#### Auth Method `facebook`

Authenticate using Facebook. This requires registration of the Authorization Server with Facebook.

```
{
    "name": "facebook",
    "type": "facebook",
    "verifyEmail": true,
    "clientId": "... (get from Facebook)",
    "clientSecret": "... (get from Facebook)",
    "callbackEndpoint": "/auth/{{name}}/callback",
    "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
    "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
    "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
}
```

For each entry with the `type` set to `facebook`, you will need to register a new application with Facebook (TODO: Add documentation).

#### Auth Method `twitter`

Authenticate using Twitter. This requires registration of the Authorization Server with Twitter.

```
{
    "name": "twitter",
    "type": "twitter",
    "verifyEmail": true,
    "consumerKey": "... (get from Twitter)",
    "consumerSecret": "... (get from Twitter)",
    "callbackEndpoint": "/auth/{{name}}/callback",
    "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
    "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
    "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
}
```

For each entry with the `type` set to `twitter`, you will need to register a new application with Twitter (TODO: Add documentation).

#### Auth Method `saml`

Authenticate with a SAML Identity Provider, such as OpenAM.

TODO ... this will be like [wicked.auth-saml](https://github.com/Haufe-Lexware/wicked.auth-saml). Most of the code can be taken from there.

```
{
    "name": "openam",
    "type": "saml",
    "verifyEmail": false,
    "authorizeEndpoint": "/auth/{{name}}/api/{{api}}/authorize",
    "tokenEndpoint": "/auth/{{name}}/api/{{api}}/token",
    "profileEndpoint": "/auth/{{name}}/api/{{api}}/profile",
    "profile": {
      "authenticated_userid": "saml:{{{userid}}}",
      "first_name": "{{{first_name}}}",
      "last_name": "{{{family_name}}}",
      "name": "{{{name}}}",
      "email": "{{{email}}}",
      "company": "{{{company}}}"
    },
    "spOptions": {
      "entity_id": "/auth/{{name}}/metadata.xml",
      "assert_endpoint": "/auth/{{name}}/assert",
      "nameid_format": "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
      "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
    },
    "idpOptions": {
      "sso_login_url": "https://your.idp.com:443/auth/SSORedirect/metaAlias/idp1",
      "certificates": [
        "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
      ]
    }
    
}
```

TODO: Needs to also implement the logout method! This has not yet been done.

#### Auth Method `adfs`

Authenticate with Active Directory Federation Services (ADFS), using its OAuth 2 functionality.

TODO (see [wicked.auth-passport](https://github.com/Haufe-Lexware/wicked.auth-passport)).

#### Auth Method `oidc`

Authenticate with a generic OpenID Connect Identity Provider.

TODO.

#### Auth Method `custom`

Delegate username and password checking to a third party component, which returns a profile for a matching username/password pair.

### Calculated Scopes

_DRAFT_

In some cases, you do not want to let your applications choose the scopes, or you do not need the end user to authorize access to your API (e.g. because **you** are the resource owner, and not the user, and the scopes are rather licenses than anything else). Or, you want to do this in addition to the end user granting scopes to a third party application accessing data/the API on their behalf.

All authenticatation methods accept an end point which takes a profile and/or authenticated user id which is inquired to retrieve scopes for an API for a specific user.

This can be useful for paid services which want to retrieve license data for specific users when getting access tokens for an API.

Example Auth Method JSON:

```
{
    "name": "special",
    "type": "local"
    "scopesEndpoint": "http://scope-server:3006/scopes",
    // ...
}
```

After the usual scope negotiating (checking grants, trusted applications,...), the scopes endpoint (which has to be implemented by you) is called with the available profile (what would be returned by the `/profile` end point) and the authenticated user id, which lets you change or add scopes (e.g. licenses) to the authenticated scope programmatically.

## Enabling custom authorization servers (like before)

It is also possibly to create fully custom authoriazation servers (like before) in addition to the wicked default authorization server (which as of wicked 1.0 **always** has to be part of the deployment of wicked).

The only requirement is that the authorization server fulfills the JSON "interface" defined above, i.e. has the following properties in its auth server JSON file:

* Main `id` and `name`
* Main `desc` decription property
* A `config` property containing `api` and `plugins` properties (as configurable via the Kickstarter)
* An array of `authMethods` in the `authMethods` property, each containing
    * A `name` property
    * A `description` property
    * The `authorizeEndpoint` URI (template, see above)
    * The `tokenEndpoint` URI (template)
    * Optionally, if the Auth Server supports OIDC (OpenID Connect), the `profileEndpoint`. If this property is set, it is assumed that the Auth Server has full support for OIDC, otherwise it's assumed to be a standard plain OAuth 2 Authorization Server.

<a name="trusted_apps" />

## "Trusted" vs. other applications

...
