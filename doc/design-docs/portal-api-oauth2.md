**Note**: This is work in progress.

# Making the portal API OAuth2 compliant

Before wicked 1.0, the portal API only support the client credentials flow for accessing the API, and that was only a hidden feature, as it did not work out nicely with the users the way one would/could/should expect.

For wicked 1.0, the `portal-api` is now exposed via OAuth2, both for use with the wicked UI (`portal`) and other applications. All applications should now be registered with the API Portal itself (the portal UI will automatically be), and should use an OAuth2 flow to access it.

## Supported Flows

The `portal-api` will be automatically registered as an API in the portal (no need to do that manually), and will support the following OAuth2 flows:

* Client Credentials for content not requiring a user
* Authorization Code Grant (for user context)
* Implicit Grant (for user context)
* Resource Owner Password Grant (for users with username/email and password)

### Using the Client Credentials Flow

Access can be had to the portal API via the client credentials flow. This flow does not give a personalized access to the API, and thus can only open up access to content which is publicly available. This is the type of access the portal UI uses if a user is not yet logged in; it does not have a user context, and thus all access which is restricted in some way (to subscriptions, applications, restricted APIs or content,...) cannot be accessed.

If user content/resources needs to be accessed, a token needs to be accessed via any of the other OAuth2 flows.

### Using the Authorization Code Flow

The Authorization Code Flow can be used to access the API with any of the configured Identity Providers; this is the flow which is used by the Portal UI to get access as a logged in user.

This Flow will ask for permission to access the resource owner's data (the logged in user's data) on behalf of non-trusted applications (see below for more information on "trusted applications" and other applications).

### Using the Implicit Flow

The Implicit Flow can also be used with the portal API with any configured Identity Provider; it enables the implementation of other UIs which e.g. make use of Single Page Application techniques, with the portal API, on behalf of a user.

### Using the Resource Owner Password Grant

Access tokens for the API can also be retrieved using the Resource Owner Password Grant. This flow will only work for users which actually have a username and password with wicked, i.e. which were registered using a third party identity provider (such as Google or GitHub).

Further, only trusted applications/subscriptions can be used using the Resource Owner Password Grant, as there is no mechanism to let the end user grant additional scopes to a third party application using this flow (as it is completely user agent-less).

This flow can be used for specific automation purposes with automation user identites, if needed. Usually, the use of either the authorization code grant or the implicit grant is encouraged (as they are more flexible).

## Supported Scopes

For access to the API, a set of scopes will be defined which the user can grant access to for third party applications. Most end points require an end user context, which is only given if an access token was acquired using any flow except the client credentials flow (implicit, authorization code, resource owner password flow).

The scopes are documented in the Swagger documentation of the portal API (see [LINK NEEDED](https://github.com/Haufe-Lexware/wicked.portal-api)).

## "Trusted" application Portal UI

See [OAuth2 Support - trusted applications](oauth2-support.md#trusted_apps) - the Portal UI (`wicked.portal`) will automatically get a trusted subscription to the Portal API, and as such will automatically get access to all scopes it asks for from the Authorization Server.

Read the [design document on OAuth 2 support](oauth2-support.md) for more information on this topic.

### Auto-registration of the Portal UI

The Portal UI must be automatically registered with the Portal API/as an application at startup of the Portal; this can be done using the wicked SDK and a machine user. This should be the only place where the machine user should be automatically used, all other places must explicitly use the token which was issued to the application (to the portal) by the Authorization Server.

The redirect URI can be calculated from the static configuration, which is available at startup of the portal. Likewise can the URL of the Authorization Server be calculated (`<schema>://<gateway host>>/auth).

### Authentication Methods

The auth methods which are allowed for logging in to the Portal are the same which are configured as valid auth methods for the `portal-api`.

Specifying which auth methods are valid for the `portal-api` corresponds to specifying which authentication methods are allowed for the Portal UI. The Kickstarter should transparently take care of this configuration when adding auth methods to the default authorization server, e.g. by displaying a check box "Allow for log in to Portal" at the configuration of the Authorization Server.
