# OAuth 2.0 - Implicit Grant Flow

The OAuth2 Implicit Grant flow is a simplified version of the Authorization Code Grant.
The flow also implies the use of a user agent, and usually the implicit grant is used for
[public applications/clients](client-types.md), i.e. applications which 
cannot be trusted with a client secret.

---

**Important:** The Implicit Grant is considered deprecated by the IETF; it is recommended
against implementing new applications using this flow, even though there are no new threats
known against it. The [Authorization Code Grant PKCE Extension](oauth-authorization-code.md) is the recommended
way. Wicked also supports this, but will keep the Implicit Grant for backwards compatibility.

Typical examples of such applications can be single page applications which do not have a
server part but only uses stateless APIs to communicate with some backend.

In a short overview, the flow works like this:
  
* The application which needs access to the API redirects the user (the user's user agent, usually a web browser) to the authorization server, stating that it wants a token back
* The Authorization Server verifies the end user's identity (over some suitable means), verifies the client ID and redirect URI, and then immediately issues a token.
* The token is now passed back to the calling application **as a fragment** (using a `#` hash). Fragments are not passed on to the backend service (which can be a static web server) but is only kept client side.
* The client application can now use the access token to access the API on behalf of the end user.

## Getting an Access Token

The calling application must redirect to the correct Authorization Server `/authorize` end point.
The URL of this endpoint depends on the authentication method, and on the API. The URL is displayed
for each supported Authentication Method at the top of each API page.

```
https://api.yourcompany.com/auth/(auth method id)/api/(api id)/authorize?client_id=(your client id)&redirect_uri=(redirect URI of your application)&response_type=token&scope=(space separated list of scopes)
```

All parameteters except the scope (depending on the API) are mandatory. The correct URL for valid combinations
of API and Authentication Method can be seen on the API page.

Note the use of `response_type=token`, as opposed to `response_type=code` for the Authorization Code Grant.

The Authorization Server will now verify the user's identity, and also check whether the application is either
implicitly (because it is a [trusted application/subscription](trusted-applications.md), or explicitly
allowed to access the API on behalf of the user. In case the user has not yet consented to the application accessing
the API on behalf of the user, wicked will ask the user to grant access to the application, so that it can access
the API on behalf of the user.

If the end user's identity can be verified, and the client ID and redirect URI are correct, the Authorization
Server will immediately create an access token which is passed back to the calling application in a redirect
of the user agent:

```
https://app.yourcompany.com/#access_token=(access token)&expires_in=3600&token_type=bearer
```

Note that this flow does not give the application a refresh token back. The token expiration depends on the API
configuration and can vary between APIs.

## Accessing the API

With the returned access token, you may now access the API using the token as a bearer token:

```
curl -H 'Authorization: Bearer (access token)' https://api.yourcompany.com/(api endpoint)
```

The actual API endpoint is also displayed on the API's page.

## Refreshing the Access Token

As already described, the implicit grant does not return a refresh token to the calling application. It is still
possible to renew the access token under certain circumstances:

* The user agent supports hidden `iframe`s
* The user agent still has a session with the Authorization Server

By calling the same authorization end point again, but with an additional parameter `&amp;prompt=none`,
the Authorization Server will try to perform a headless authorization for the client application, and immediately
return a new access token via `302` redirect:

```
https://api.yourcompany.com/auth/(auth method id)/api/(api id)/authorize?client_id=(your client id)&redirect_uri=(redirect URI of your application)&response_type=token&scope=(space separated list of scopes)&prompt=none
```

By letting this run in a hidden `iframe`, the renewal of the access token can be done without the end
user actually noticing.
