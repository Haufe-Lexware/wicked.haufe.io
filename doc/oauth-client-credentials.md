# OAuth2.0 - Client Credentials Flow

The OAuth2 Client Credentials Flow is intended for machine to machine communication. The "client credentials"
authenticate the application which tries to access the API, but there is no notion of an end user context
with the calls. The API which is being called only will know for sure which the application is, but not
necessarily on behalf of which end user the call is done.

Only [Confidential Clients](client-types.md) can use the Client Credential flow. If you
try to get an access token using a public client, wicked's Authorization Server will refuse this.

## Getting an access token

The token endpoint which is needed to get an access token for an API which is secured via client credentials
is different from API to API, so insert the correct auth method ID, API ID, client ID, client Secret and scope in the following URL:

```
curl -X POST -d 'grant_type=client_credentials&client_id=(your client id)&client_secret=(your client secret)&scope=(space separated list)' https://api.yourcompand.com/auth/(auth method id)/api/(api id)/token
```

The token endpoint per API and auth method is always displayed on the top of each API page.

The `scope` parameter is optional (depending on the API you need to access), and can contain a space separated (and URI encoded) list
of API scopes for which the access token shall be created.

If successful, the Authorization Server will return an access token:

```
{
    "access_token": "(access token)",
    "token_type": "bearer",
    "expires_in": 3600
}

Please note the absence of a refresh token. This concept is not supported with the client credentials flow.
If the access token has expired, request a new access token using the same kind of request as initially.

## Accessing the API

With the returned access token, you may now access the API using the token as a bearer token:

````
curl -H 'Authorization: Bearer (access token)' https://api.yourcompany.com/(api endpoint)
```

The actual API endpoint is also displayed on the API's page.
