**Note**: This is work in progress.

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

### Keeping track of OAuth2 grants

As a user of the APIm Gateway (using an application which in turn is using an API provided by the APIm), I want the APIm to keep track of the grants I have given to the application, in case it is not a trusted application. The grants must be persisted in the APIm, and if I am using the same application again, the grants are automatically given to the application.

### Seeing granted scopes of applications

_TBD - needed, but not Prio 1_

As an end user of non-trusted application, I want to be able to see which scopes I have granted to which application, inside a special section of some web page (probably: the Authorization Server).

### Enabling custom username/password authentication

_TBD - Lower prio_

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

_to be specified further._

#### Auth Method `custom`

Delegate username and password checking to a third party component, which returns a profile for a matching username/password pair.

_To be specified further._

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

Any scopes which were present before (either because the application is trusted or because it requested and was granted scopes by the end user) will be merged with these scopes.

**Important**: All scopes which are added to the token/grant also need to be registered with the API, otherwise the API Gateway will reject creating such an authenticated scope.

### Injected Scope: `email_verified`

All APIs which use any type of OAuth2 scope, and which makes use of [registration pools](registration-process.md), will get an additional scope `email_verified` injected into its list of scopes. If the scope list is empty until then, this will be the only scope which the API has.

As the registration process supports verifying email addresses (if the `portal-mailer` is configured correctly), this can be used inside any API's business logic to give the end user additional rights (or whatever is desired) whenever the email address has been verified.

This kind of feature is already in use within the portal API - usually it's not allowed for a user to register applications or create subscriptions if the user does not have a validated email address.

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

<a name="trusted_apps"></a>

## "Trusted" vs. other applications

Usually, when requesting access to an API on behalf of a user, the end user has to grant access to his/her data to the requesting application (allow access to scopes). This is (as of wicked 1.0) the default behavior, and grants are stored within the API (the `/grants` endpoint) so that the end user does not have to grant access repeatedly after doing it once (for a single application).

For some applications, notably for main applications of the API, usually maintained by the API maintainer (such as the UI for the API Portal) should by default have full access to all scopes of the API without the need of the end user granting access to it - such applications are defined to be "trusted".

To be more precise, it's not the application which is "trusted", but the subscription of the application to an API which is trusted. API Portal Admins can create trusted subscriptions, or can assign the flag "trusted" to a subscription via the "Approval" workflow which is already in place.

### Creating access tokens for trusted applications

If an application with a trusted subscription wants to create an access token on behalf of an end user, it does not have to ask the end user for any scopes, it will get all asked for scopes when calling the `/authorize` or `/token` end points (depending on the flow which is used). The Authorization Server will automatically grant all needed scopes to the access token - the application may do whatever it wants with the end user's data - it is "trusted" to not do any harm.

In contrast to that, non-trusted applications (or, better, subscriptions) will always have to ask the end user to grant access for that specific application, and has to specify exactly for which scopes it wants access.

### Trusted applications and the Resource Owner Password Grant

_DRAFT_

In the first iteration of the improved OAuth 2 support for wicked 1.0, the Resource Owner Password Grant - which is by nature browserless - is only allowed for trusted applications, and only using the Auth Methods `local` and `custom`.

This is due to the fact that there is no mechanism for the end user to grant additional scopes to the application if it is not already a trusted application. This is only possible using the Authorization Code Grant or the Implicit Grant.

## Specifying allowed Auth Methods for APIs

Each API which is secured with OAuth2 is now required to specify which auth methods are allowed to access the API. This is done by replacing the `authServers` section of the API definition with an `authMethods` array, stating the names of the auth methods allowed to authenticate/authorize for this API.

The syntax is as follows: `<auth-server>:<auth-method>`. If `auth-server` is left out, or is set `*`, all authorization servers registered with the configuration are allowed. If `auth-method` is set to `*`, any auth method is allowed.

Examples (`apis.json`): This allows all auth methods which are defined in the standard wicked Authorization Server. This is the default for the `portal-api`.

```
{
  "apis": [
    {
      "id": "petstore-oauth",
      "name": "Petstore OAuth",
      "desc": "This is a sample Petstore server secured via OAuth 2.0 Client Credentials flow.",
      "auth": "oauth2",
      "settings": {
        "enable_client_credentials": true,
        "enable_implicit_grant": true,
        "token_expiration": "3600",
        "scopes": ""
      },
      "authMethods": [
        "portal-auth:*"
      ],
      "tags": [
        "Sample"
      ],
      "requiredGroup": "dev",
      "plans": [
        "basic",
        "stupid",
        "unlimited",
        "godlike"
      ]
    }
  ]
}
```

Some other valid auth method entries:

* `"*"` - all auth methods of all Authorization Servers are allowed
* `"portal-auth:google"` - Allow only Google Authentication
* `"custom-auth:*"` - Allow all Auth Methods from custom Authorization Server `custom-auth`.

## Authorization Grant Persistence

When adopting OAuth2 flows, you will soon encounter the concept of grants to scopes, allowing an application to access an end user's (resource owner's) data on behalf of that user. Wicked will out of the box be able to store grants which an end user gave to an application, and retrieve those again at a later authorization session.

### Extension of the Portal API

The wicked API will get new end points for storing and retrieving grants, on a per application and per user basis. These end points will be used by the default authorization server to store and retrieve existing grants.

### Example flow

Note that this flow only applies under the following circumstances:

* The application requesting scopes (requiring grants) is not a ["trusted" application](#trusted_apps)
* Either the Authorization Code Grant, oder the Implicit Grant is used

The flows then goes as follows:

1. An application wants to access an API on behalf of an end user ("Resource Owner" in OAuth2 terminology). The application decides to make use of either the Authorization Code Grant, or the Implicit Grant, and thus redirects to the `/authorize` of the desired auth method (this is a property of the Auth Method, different identity providers have different end points for authentication). The input here is an Auth Method, and a set of desired `scopes` to the API.
2. The Authorization Server delegates to the desired identity provider to find out who the end user is (establish identity); this is not important how this is accomplished, either by federating to some other identity provider, or by checking username and password. The main outcome of this step is the `authenticated_userid` (in Kong terms), which is a unique identifier, stable over time, for the identity of the end user, with respect to the given auth method.
3. Using the application, the desired API, and the end user identity, the Authorization Server now queries the portal API for already existing grants, belonging to this tuple of data. If there is, and the grants match the desired `scopes`, the authorization step is done, and either an Authorization Code (for the Authorization Code Grant Flow) or an access token (in case of the Implicit Grant) can be created, and the flow can continue. If there are no stored grants, continue with...
4. The Authorization Server displays a web page which displays (a) which application wants to access (b) which data (scopes) on behalf of the end user. The end user must "nod off", i.e. **grant** access to the API - for these scopes; if the user agrees to let the application access the API on his behalf, the Authorization Server will store these grants into the wicked API. If the user does not agree to share his/her data with the application, the authorization flow is cancelled, and the calling application will get a redirect back with an error code according to RFC 6749.

### Administering granted access rights

For all API grants, an authenticated user should be able to see which grants he/she has made for all non-trusted applications. This should be done as a separate page on the Authorization Server, callable after a user has been logged in.

_TBD - Should this also be a(n optional) property of the Auth Method, i.e `/application-grants` or similar in the Auth Method interface? It might make things easier. The main reason to do this would be that the user has to be logged in using some kind of Auth Method anyway before he/she can review the already given application grants._
