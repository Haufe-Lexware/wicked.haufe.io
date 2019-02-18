# OAuth 2.0 - Allowed Scopes

In certain situations you may want to restrict which scope can be requested by certain applications. With wicked, this can be done using a setting on the subscription of an application to an API.

**Example:** An API has three different scopes: <code>read</code>, <code>write</code> and <code>create</code>, and offers only the <a href="oauth2_client_credentials">Client Credentials</a> Flow. Some applications/subscriptions shall only be able to <code>read</code> from the API, others are allowed to request any scope.

This can be achieved by specifying the allowed scopes. Changing allowed scopes can <b>only</b> be done by API Portal administrators, but any user of the API Portal can review the settings on their own subscriptions, by going to the applications they have a subscription for.

## Possible Settings

The possible settings for the allowed scopes are the following:
  
### ”All"

The application can request any scope from the API; depending on the OAuth2 flow which is used, the request is either immediately granted ([Client Credentials Flow](oauth-client-credentials.md)), or the user has to grant access to the application ([Authorization Code Grant](oauth-authorization-code.md)) and [Implicit Grant](oauth-implicit-grant.md)). The [Resource Owner Password Grant](oauth-password-grant.md) requires trusted applications, for which there is a special case (see below). 

_This is the default for APIs where either the Authorization Code Grant or the Implicit Grant is enabled_.

### "None"

Applications of which the subscription is set to "None" will never be granted any scope. All access tokens will only ever be for the empty scope. Please note that this does not mean that you will not get any access tokens - it's just that the scope will always be empty (in case you request a valid scope).

_This is the default for APIs which **only** have the [Client Credentials](oauth-client-credentials.md) Flow enabled_.

### "Select"

With this setting, a set of scope aspects can be defined on a per-subscription basis. This is the setting which can be used to implement the example from above.

_This setting has to be manually set on a subscription, by an Admin_.

## Trusted Applications/Subscriptions

For [trusted applications/subscriptions](trusted-applications.md), the allowed scopes mode (see previous section) is _implicitly_ set to **All**. It is not possible to restrain the scope which is granted to a trusted application.
