# PKCE: Proof Key for Code Exchange

wicked.haufe.io supports the PKCE (Proof Key for Code Exchange) extension of the OAuth 2.0 Authorization Code Grant.

The Authorization Code Grant can also be used for **public clients**, i.e. clients which are not able to keep a secret. Examples for
such applications are Single Page Applications, or very typically, Mobile Apps (native or web based).

The most dangerous threat for such applications is that the Authorization Code is hijacked during the redirect call; if then the
client secret can be reverse engineered, it's possible to fully impersonate an application, stealing the logged in user's identity.
This is what the PKCE OAuth2 extension mitigates, by a fairly simple exchange of hashed proof keys.

More information on this specification can be found here: [https://tools.ietf.org/html/rfc7636](https://tools.ietf.org/html/rfc7636).

**IMPORTANT**: The PKCE extension is highly recommended also for **Confidential Clients**. It is not only
applicable for public clients.

## How does PKCE work?

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
