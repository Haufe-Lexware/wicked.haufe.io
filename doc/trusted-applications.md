# Application/Subscription Trust

The concept of "Application/Subscription Trust" only applies to APIs which are secured using OAuth2.

In terms of API subscriptions, an application can have a "trusted", or a "normal" subscription to an
API. The difference between the two is that a trusted subscription will implicitly always be trusted
by the API Management system to access all scopes of the API, even without asking for permission to the user.

Usually, when an application wants to access an API on behalf of an end user, the API Management system
will ask the user to "grant access" to the API for the application on behalf of himself. If the application's
subscription is a "trusted" subscription, the API Management will automatically assume that the user grants
all scopes to the application, without asking.

Normally, only the "main" application which uses an API, i.e. the application which is tied most to the API,
has a trusted subscription (as this is what the end user also would expect). All other subscriptions to the
API are usually "normal" subscriptions which would require the end user to explicitly grant access to the
application for his own personal data.

## What does this mean?

The concept of trusted subscriptions has the following implications which are also important to the application developer:

* Only trusted subscriptions can make use of the [Resource Owner Password Grant](oauth-password-grant.md) flow; this flow does not have a user interface which could enable the user grant access to the API. Normal subscriptions must use either the [Authorization Code](oauth-authorization-code.md) or [Implicit Grant](oauth-implicit-grant.md) flows (depending on their nature), which allow the user to, by UI, grant access on its behalf.
* Only Admins can create trusted subscriptions without approval.
* Even if a subscription is created for a plan which does not need approval, creating a trusted subscription would **still** require approval.
* The scope which can be requested by a trusted subscriptions cannot be limited using a set of [allowed scopes](oauth-allowed-scopes.md); this only works with non-trusted subscriptions.
