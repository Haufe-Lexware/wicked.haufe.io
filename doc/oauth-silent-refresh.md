# OAuth 2.0 Silent Refresh

A "Silent Refresh" is a technique which is applicable to the [Implicit Grant](oauth-implicit-grant.md) and [Authorization Code Grant](oauth-authorization-code.md) of OAuth 2.0, especially when using [Single Page Applications/Browser Based Applications](client-types.md) as API Clients.

Such clients neither receive refresh tokens, nor are able to store client secrets in their code. To still enable refreshing access tokens, they rely on an additional resource for making sure that the access to the API resource should be prolonged: The session with the Authorization Server.

By leveraging this session and an additional query parameter for the `/authorize` end point, namely `&prompt=none`, the authorization server will immediately return either an Authorization Code (for the Authorization Code Grant) or an access token (for the Implicit Grant) in a `302` redirect. In case the session with the Authorization Server is not valid, the Authorization Server will **not** present a form to interactively log in (as it would do otherwise), but rather immediately redirect back with an error message, in the following form (for the Authorization Code Grant):

```
https://app.yourcompany.com/oauth2/callback?error=invalid_state&error_description
```

Or, for the Implicit Grant, the `error` and `error_description` are returned in the **fragment**:

```
https://app.yourcompany.com/oauth2/callback#error=invalid_state&error_description
```
