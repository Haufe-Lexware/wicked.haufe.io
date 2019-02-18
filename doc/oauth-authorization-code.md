# OAuth2.0 - Authorization Code Grant

The Authorization Code Grant is the most common authorization flow in OAuth2. It is a three-legged
process which is considered to be the OAuth2 flow to use for best security, both with confidential 
and public clients (then using the PKCE Extension).

The flow works like this in short words:

1. The application which needs access to an API redirects the user agent (usually the browser) to the authorization page of the Authorization Server.
1. The Authorization Server verifies the identity of the end user (depending on the selected auth method), checks the client ID of the calling application, and if everything is fine, issues a so-called "Authorization Code".
1. The Authorization Server redirects (302) back to the calling application, giving the authorization code back as a query parameter (`?code=(authorization code)`).
1. The application now uses the authorization code together with its client credentials (id and secret, or id and code verifier) to retrieve an actual access token, and optionally a refresh token.
1. The application can now use the API with the returned access token.

## Confidential Clients

### Getting an Authorization Code (confidential clients)

The calling application must redirect to the correct Authorization Server <code>/authorize</code> end point.
The URL of this endpoint depends on the authentication method, and on the API. The URL is displayed
for each supported Authentication Method at the top of each API page.

```
https://api.yourcompany.com/auth/(auth method id)/api/(api id)/authorize?client_id=(your client id)&redirect_uri=(redirect URI of your application)&response_type=code&scope=(space separated list of scopes)
```
All parameteters except the scope and redirect URI (depending on the API) are mandatory. The correct URL for valid combinations
of API and Authentication Method can be seen on the API page.

Note the use of `response_type=code`, as opposed to `response_type=token` for the Implicit Grant (see below).

The Authorization Server will now verify the user's identity, and also check whether the application is either
implicitly (because it is a [trusted application/subscription](trusted-applications.md), or explicitly
allowed to access the API on behalf of the user. In case the user has not yet consented to the application accessing
the API on behalf of the user, wicked will ask the user to grant access to the application, so that it can access
the API on behalf of the user.

If the end user's identity could be verified, the Authorization Server will craft an authorization code which
is passed back to your application with a `302` redirect, giving the authorization code as a 
query parameter:

```
http://your.application.com/oauth2/callback?code=(authorization code)
```

### Getting an Access Token (confidential clients)

This authorization code can now be used by your application, which has to call the Token endpoint, passing
the authorization code, and the application's client credentials, to create an access token (and a refresh token).
An example request using `curl` would look as follows:

```
curl -X POST -d 'grant_type=authorization_code&client_id=(your client id)&client_secret=(your client secret)&code=(authorization code)' https://api.yourcompany.com/auth/(auth method id)/api/(api id)/token
```

In case of a success, the token endpoint returns a JSON structure which contains an access token and a refresh token:

```
{
    "access_token": "(access token)",
    "refresh_token": "(refresh token)",
    "token_type": "bearer",
    "expires_in": 3600
}
```

The token expiration depends on the API configuration and can vary between APIs.

### Refreshing the Access Token (confidential clients)

Your application can refresh the access token using a specific call to the same `/token` end point
as before. Using curl syntax, the call will look like this:

```
curl -X POST -d 'grant_type=refresh_token&client_id=(your client id)&client_secret=(your client secret)&refresh_token=(refresh token)' https://api.yourcompany.com/auth/(auth method id)/api/(api id)/token
```

If successful, the Authorization Server will return a new access token and a new refresh token.

**Important:** After refreshing the access token using the refresh token, the refresh token which was used for this, is **no longer valid**. You must then use the new refresh token.

### Accessing the API

With the returned access token, you may now access the API using the token as a bearer token:

```
curl -H 'Authorization: Bearer (access token)' https://api.yourcompany.com/(api endpoint)
```

The actual API endpoint is displayed on the API's page.

  +helpItem('pkce', 'What is PKCE? - Proof Key for Code Exchange')

wicked.haufe.io supports the PKCE (Proof Key for Code Exchange) extension of the OAuth 2.0 Authorization Code Grant.

The Authorization Code Grant can also be used for **public clients**, i.e. clients which are not able to keep a secret. Examples for
such applications are Single Page Applications, or very typically, Mobile Apps (native or web based).

The most dangerous threat for such applications is that the Authorization Code is hijacked during the redirect call; if then the
client secret can be reverse engineered, it's possible to fully impersonate an application, stealing the logged in user's identity.
This is what the PKCE OAuth2 extension mitigates, by a fairly simple exchange of hashed proof keys.

More information on this specification can be found here: [https://tools.ietf.org/html/rfc7636](https://tools.ietf.org/html/rfc7636).

**IMPORTANT**: The PKCE extension is highly recommended also for **Confidential Clients**. It is not only
applicable for public clients.

## Public Clients

### How does PKCE work?

PKCE is an extension for the OAuth2.0 Authorization Code Grant which adds extra security to the exchange of the Authorization Code. To make use of the PKCE extension, proceed as follows.

When using a public client, i.e. a client which does not have the "confidential" flag checked in its settings, wicked will not accept
the Authorization Code Grant for this client unless it supplies an additional `code_challenge` parameter with the call
to the authorization end point.

To obtain this extra parameter, do as follows: 

1. Create a long (43-128 characters) random string, this is your `code_verifier`. The string must only contain digits, characters, `.`, `-`, `_` and `~` (per RFC)
2.mCreate the code challenge as follows: `code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`

Now pass in this as an additional parameter for the authorization call:


```
https://api.yourcompany.com/auth/<auth method>/api/(api id)/authorize?client_id=(your client id)&redirect_uri=(redirect URI of your application)&response_type=code&scope=(space separated list of scopes)&code_challenge=(code challenge)&code_challenge_method=S256
```

The last parts of the above URL are the difference to how the call without PKCE looks (for confidential clients). In case the
application associated with the `client_id` is not a confidential client, the authorize call will fail unless the code challenge
and code challenge method parameters are passed as well.

**Note:** Using PKCE is explicitly allowed also for confidential clients.

## Getting an Access Token (public clients/using PKCE)

The call to the token endpoint is also slightly different when using the PKCE extension. For public clients, the
clients secret **must not** be passed in, but instead the `code_verifier` must be part of the payload
for the token endpoint:


```
curl -X POST -d 'grant_type=authorization_code&client_id=(your client id)&code_verifier=(unhashed code verifier)&code=(authorization code)' https://api.yorcompany.com/auth/(auth method id)/api/(api id)/token
```

This applies to public clients; if you are using PKCE with a confidential client (which is explicitly allowed), wicked still 
expects the `client_secret` to be passed in in addition to the `code_verifier`.

In case of a success, the token endpoint returns a JSON structure which contains an access token, and in some cases also a refresh token (Public SPA coients do not receive a refresh token):

```
{
    "access_token": "(access token)",
    "refresh_token": "(refres token)",
    "token_type": "bearer",
    "expires_in": 3600
}
```

Only when using [confidential or native clients](client-types.md), a refresh token is also returned, even if the PKCE extension is used.

### Refreshing the Access Token (Single Page Applications)

**Note:** Public Clients in the sense of [Native/Mobile Applications](client-types.dm) will be handed a refresh token, just as confidential clients. The below parts only apply for Single Page/Browser Based Applications.

To refresh a token using the Authorization Code Grant using a public client, the same method as with the
implicit grant has to be applied: [A silent refresh](oauth-silent-refresh). In this case, the client needs to call the authorization
end point with a fresh PKCE `code_challenge` (as described above), adding also the `&prompt=none`
parameter to make sure that the call definitely returns, either with a new authorization code, or with
an error.

```
https://api.yourcompany.com/auth/(auth method id)/api/(api id)/authorize?client_id=(your client id)&redirect_uri=(redirect URI of your application)&response_type=code&scope=(space separated list of scopes)&code_challenge=(code challenge)&code_challenge_method=S256&prompt=none
```

By letting this run in a hidden `iframe`, the renewal of the access token can be done without the end
user actually noticing.
