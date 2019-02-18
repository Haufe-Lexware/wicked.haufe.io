# OAuth 2.0 Client Types

When dealing with API clients, it is important to distinguish between the different types of clients which are using an API.
This is especially important when looking at the different OAuth2.0 flows. OAuth2.0 in the basic specification only distinguishes
two different types of clients: public and confidential clients.

Wicked also distinguishes two different types of public clients: single page applications (browser based applications) and native
or mobile applications, which usually run on a client's device, e.g. as a desktop application, or as a mobile application on 
an Android or iOS device.

This page describes what the nature of each type of client is.

## Confidential Clients

A confidential client is a client which calls the APIs from a confidential environment, i.e. typically from the backend of a web
server. This means that the client can keep a secret confidential, in the OAuth 2.0 case the client secret.

The OAuth2.0 [Authorization Code Grant Flow](oauth-authorization-code.md) in the standard case requires a confidential client
to be able to work. The [Client Credentials Flow](oauth-client-credentials.md) also requires a confidential client,
as it needs the use of both the client ID and client secret to obtain an access token.

## Public Clients: Single Page Applications

Another typical API client is the so-called Single Page Application (SPA). This is usually a fully browser based application which
makes use of API calls to get and set the data it needs. Due to the fact that an SPA runs fully in a user's browser, the source
code, and so also the OAuth2.0 client credentials (id and secret), can be read out by anybody reading the source code.

Declaring an application as "Public (SPA)" has the following effect on wicked's Authorization Server:

* The Authorization Server will not allow using the [Authorization Code flow without the PKCE extension](oauth-authorization-code.md)
* When requesting the Token from the `/token` endpoint, the authorization server will reject calls containing also the client secret; the request must be performed **without the secret**; the PKCE verifier serves as an extra verification
* With the access token there will **not** be returned a refresh token; token refreshes must be done via the [silent refresh method](oauth-silent-refresh.md), e.g. in an iframe.

## Public Clients: Native/Mobile Applications

The (currently) last class of client types are native and mobile applications. These are in last consequence also public clients
in the sense that the software leaves the vendor and is physically in the hands of the end user, albeit in this case in the form
of an application installed on the user's device (PC, mobile phone, tablet).

In terms of declaring an application confidential, this is not enough; it is possible to reverse engineer such applications, so
the entire class of clients are still called "public" clients.

Declaring an application as "Public (Native)" has the following effect on wicked's Authorization Server:

* The Authorization Server will not allow using the [Authorization Code flow without the PKCE extension](oauth-authorization-code.md)</a>
* When requesting the Token from the `/token` endpoint, the authorization server will reject calls containing also the client secret; the request must be performed **without the secret**; the PKCE verifier serves as an extra verification
* Unlike the "Public (SPA)" type, a refresh token **is issued** for this type of client

The reasons why in this case the refresh token is issued, even if this is a public client are the following:

*  Without the refresh token, the application needs to rely on a browser session to refresh the access token. This means that there is no possibility to refresh the token after the browser session with the Authorization Server has expired. As a consequence, the end user would possibly need to log in each time the application is being used, which is usually not considered acceptable. Using the refresh token, the application can prolong the access to the necessary API without bothering the user to log in again.
* It is by far more difficult to extract the runtime data from a mobile or native application than from a browser based application, where the only possibility to store state is either in (user visible) cookies, local storage or DOM.
