# OAuth 2.0 - Resource Owner Password Grant

The Resource Owner Password Grant is the third OAuth2 flow which uses end user identities. In this
case, the method of establishing a user identity within the Authorization Server is given in the
name of the flow: By using a username and password.

---

**Important:** The Resource Owner Password Grant is being strongly adviced against,
as it is not addressing the main advantage of the OAuth2 framework - that the application which needs
the authorization should never see username and password of the authenticated user. In most situations,
it is recommended to use the [Authorization Code Grant](oauth-authorization-code.md)
with the PKCE extension (mandatory in case you have a public client, such as a mobile application or an SPA).

---

As stated above, the Resource Owner Password Grant is not recommended for many use cases; but it can be a
useful flow for certain special cases of integrations.

Wicked supports the Resource Owner Password Grant only for [Authentication Methods](auth-methods.md) which use the
[local email and password database](auth-local.md) of wicked itself, or for authentication methods which consult an [external
service](auth-external.md) for verification of username and password. It is (currently) not possible to use any
other authentication method with this flow, as most other identity providers do not support this
either. Mostly out of security reasons (to prevent brute force email/password checking). Check the
supported Authentication methods on each API for more information.

The Resource Owner Password Grant can be used both with [confidential and public clients](client-types.md), i.e.
applications which can, or cannot, keep a client secret in the application. Public clients
applications are single page applications, or in the case of this Grant, usually Mobile Clients.
**Once more:** This is not a recommended use case for Mobile Clients anymore; please use the
[Authorization Code Grant with the PKCE extension](oauth-authorization-code.md).

**IMPORTANT:** Currently, only [trusted subscriptions](trusted-applications.md) can use the Resource Owner Password Grant.
When creating a subscription, tick the "Trusted" check box to create such a subscription. Please note
that trusted subscriptions **always** require approval by either an Administrator or an Approver.

Trying to use the Resource Owner Password Grant with a non-trusted subscription/application will
result in an error message from the Authorization Server.

## Getting an Access Token

To get an access token for this grant, the client application must first collect username (email)
and password of the end user, using the application's own UI. This Grant, as seen from the API
Management perspective, is headless.

For confidential clients (which are defined as such in the API Portal), the call, in curl syntax,
has to be done in the following way:

```  
curl -X POST -d 'grant_type=password&client_id=(your client id)&client_secret=(your client secret)&username=(user email)&password=(password)' https://api.yourcompany.com/auth/(auth method id)/api/(api id)/token
```

Public clients <b>must not</b> present their client secret, so the request looks a little different:

```
curl -X POST -d 'grant_type=password&client_id=(your client id)&username=(user email)&password=(password)' https://api.yourcompany.com/auth/(auth method id)/api/(api id)/token
```

**IMPORTANT:** As this flow only works with trusted applications, there is no need to pass in the `scope<`
parameter to the request. The Authorization Server will always return a token which is valid for the **full scope**
of the API, disregarding what the application is requesting.

The reason behind this is that there is no means of requesting user consent when accessing the API; either
the application is allowed to fully access the API on behalf of the user, or not at all.

If the Authorization Server can successfully verify the user/email/password combination and the client credentials,
it will craft an access token and a refresh token:

```
{
    "access_token": "<b style="color:#0a0">(access token)</b>",
    "refresh_token": "<b style="color:#0a0">(refresh token)</b>",
    "token_type": "bearer",
    "expires_in": 3600
}
```

The token expiration depends on the API configuration and can vary between APIs.

## Accessing the API

With the returned access token, you may now access the API using the token as a bearer token:

```
curl -H 'Authorization: Bearer (access token)' https://api.yourcompany.com(api endpoint)
```

The actual API endpoint is also displayed on the API's page.

## Refreshing the Access Token

Your application can refresh the access token using a specific call to the same `/token` end point
as before. Using curl syntax, the call will look like this (for confidential clients):

```
curl -X POST -H 'Content-Type: application/json' -d 'grant_type=refresh_token&client_id=(your client id)&client_secret=(your client secret)&refresh_token=(refresh token)' https://api.yourcompany.com/auth/(auth method id)/api/(api id)</b>/token
```

As above, public clients (non-confidential clients) **must not** present their client secret when refreshing the token:

```
curl -X POST -H 'Content-Type: application/json' -d 'grant_type=refresh_token&client_id=(your client id)&refresh_token=(refresh token)' https://api.yourcompany.com/auth/(auth method id)/api/(api id)</b>/token
```

If successful, the Authorization Server will return a new access token and a new refresh token.

**Important:** After refreshing the access token using the refresh token, the refresh token which was
used for this, is **no longer valid**. You must then use the new refresh token.
