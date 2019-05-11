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

## Support for `prompt`

The additional query parameter `prompt` on an OAuth2 call to the `/authorize` endpoint has the following impact on the wicked Authorization Server; it is implemented as follows:

* If the user is already logged in and has a current session with the wicked Authorization Server, this identity is used to immediately serve the `/authorize` request (given that all permissions and grants are available)
* If the user is **not** logged in, the wicked Authorization Server tried to delegate the login process to the upstream identity provider, either by also using `prompt=...` (for upstream OAuth2/OIDC identity providers), or using some semantically similar means

### `prompt=none`

For `prompt=none`, if the authentication can be done without user interaction, the wicked Authorization Server will immediately return with a new access token (in case of the implicit grant), or a new authorization code (for the authorization code grant). If the authentication process **can not** be done automatically/without user interaction, it will still immediately redirect back, with an `error` and `error_description` as query parameters for the callback URL, e.g. like this:

```
https://your.app.com/callback?error=login_required&error_description=user%20interaction%20needed
```

This means that you will always get a response back as a callback, even if the authentication process was not successful; this means that your SPA can react correspondingly, e.g. display a warning message "You need to log in again" or similar in case the silent login in the background did not work as expected.

The following Auth Method types support `prompt=none` also when the Authorization Server does not have a session with the user agent (browser) anymore:

* Generic OAuth2 identity providers (in case the upstream IdP supports it)
* Google
* SAML2 (translates to using `isPassive`)

**Important**: All other auth methods also support `prompt=none`, but only as long as the user agent (the browser) has a session with the Authorization Server. This means that it's a very good idea to support silent refresh for all types of authentication; some authentication methods work even better though (if they support a "remember me" type of login process).

### `prompt=login`

As the opposite of `prompt=none`, `prompt=login` tries to enforce an interactive login, even if the Authorization Server has an active session with the user agent (browser). This feature is available for the following authentication methods:

* Generic OAuth2 (if the upstream IdP supports it)
* Google
* SAML2 (using `forceAuthn`)
* Local (wicked user databases)

### Other `prompt` options

Google also supports other `prompt` options, such as `select_account`; these are forwarded by wicked to Google, even if wicked does not do anything with them in addition to passing them on to Google's IdP.
