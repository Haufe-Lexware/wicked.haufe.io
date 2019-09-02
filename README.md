# Wicked Good API Management!

![wicked.haufe.io Logo](public/wicked-logo-300px.png)

General information can be seen at the wicked microsite over at [wicked.haufe.io](http://wicked.haufe.io). If you want to see how the API Portal looks like, check out [wicked-demo.haufe.io](https://wicked-demo.haufe.io). You may also want to try out our [Gitter Chatroom](https://gitter.im/wicked-haufe-io/Lobby).

---

# tl;dr: [Getting Started (kicking the tires)](http://wicked.haufe.io/gettingstarted.html)


Install the wicked CLI:

```
$ npm install -g wicked-cli
```

Create a directory for the wicked configuration repository:

```
$ mkdir wicked-test
$ cd wicked-test
```

Specify you want to use the latest stable release and start the kickstarter (you will need [Docker](https://docker.io) installed):

```
$ wicked tags set latest
$ wicked kickstart --new .
```

Now press `Ctrl-C` to stop the configuration. Then run a Postgres instance and [Wicked-in-a-box](doc/wicked-in-a-box.md):

```
$ wicked postgres start
$ wicked box start .
```

Wait around 10 seconds, then open the API portal at [http://localhost:3000](http://localhost:3000). You can play around with the user `admin@foo.com` and password `wicked`.

Still interested? Good. Now you can continue reading on this page.

---

# What's this?

wicked.haufe.io is an open source API Management solution with a slightly different design focus in mind than most other API Management systems:

* Deploy your API Management using your own deployment pipelines, you have full control
* Store your API configuration in source control and do CI/CD with your API Gateway
* Run your API Management on any premises you want, as long as docker is supported

We wrote wicked.haufe.io because we wanted an open source API Management solution we can just "drop in" everywhere. We believe that each team which operates a service should also operate their own API Gateway and Portal, to make it easier for others to consume their services. Most commercial solutions are too pricey not to deploy centrally, but we believe in decentralization also with API Management, and that's what wicked.haufe.io can do: API Management for everyone, for free, anywhere (where you can run docker), with a small footprint.

# What's in the box?

When you use wicked.haufe.io, you get the following things out of the box:

* A great API Gateway (this is [Mashape Kong](http://getkong.org) underneath! Good stuff!)
* A developer portal which enables your developers to sign up for an API by themselves
    * Supports ADFS, Google and Github logins
    * Support for SAML2 login
    * Support for generic OAuth2 logins (also with `user_info` profile loading)
    * Local accounts (managed by wicked)
    * API for arbitrary username/password checking, e.g. against legacy databases
    * LDAP
* Integrated Swagger (OpenAPI) support
* A lightweight CMS based on your static configuration, coming straight from source control
* Support for API Keys and most of OAuth 2.0, out of the box.
    * Client Credentials Flow
    * Authorization Code Grant Flow, including PKCE extension, with **any** supported identity provider (same as for portal login)
    * Implicit Grant Flow
    * Resource Owner Password Grant, for those Identity Providers supporting it (local login, OAuth2, external sources)
* Most visual things can be fully customized by configuration, including logos and stylesheets
* A stringent deployment strategy, enforcing immutable servers and infrastructure as code (leveraging docker)

And much more... what's your main reason to use wicked.haufe.io? Tell us!

What's your main reason **not** to use wicked.haufe.io? Then we're even more curious!

### What's not in the box?

The following things which you might expect from an API Management System are explicitly **not** in the box:

* API Analytics
* Log Aggregation

This does not mean it's not possible to do this with wicked, it's just that we decided not to include a prebuilt solution for these things. As the API Gateway is based on a plain vanilla docker image of Mashape Kong, anything you can hook up to Kong, or plain Docker log forwarding will also work with wicked.haufe.io, including e.g. [DataDog](https://getkong.org/plugins/datadog/), [Runscope](https://getkong.org/plugins/runscope/) or [Loggly](https://getkong.org/plugins/loggly/).

# Is this for me?

If you are looking for a SaaS API Management do-it-all-for-me type of solution, wicked.haufe.io is not for you.

If you are looking for a super flexible and extensible API Management suite which will tie in with any environment and any type of deployment, wicked.haufe.io is **very much for you**.

# Getting Started

* Read the [wicked box guide](doc/wicked-in-a-box.md) to try out how easy it is to deploy an API Portal and Gateway to your local machine
* To start incorporating your own APIs, head over to the [documentation](doc/index.md), and read the how-to on [creating a portal configuration](doc/creating-a-portal-configuration.md)

# Related repositories

The following repositories contain the actual source code (this repo contains mostly documentation):

* [wicked.ui](https://github.com/apim-haufe-io/wicked.ui): The API Portal UI
* [wicked.api](https://github.com/apim-haufe-io/wicked.api): The API Portal backend API
* [wicked.auth](https://github.com/apim-haufe-io/wicked.auth): The wicked Authorization Server implementation, using different social logins or SAML to authorize API usage and Portal login
* [wicked.kong-adapter](https://github.com/apim-haufe-io/wicked.kong-adapter): The API Portal's Kong Adapter service
* [wicked.mailer](https://github.com/apim-haufe-io/wicked.mailer): The API Portal's Mailer service
* [wicked.chatbot](https://github.com/apim-haufe-io/wicked.chatbot): The API Portal' Chatbot service
* [wicked.kickstarter](https://github.com/apim-haufe-io/wicked.kickstarter): The API Portal's Configuration Editor and Kickstarter
* [wicked.tools](https://github.com/apim-haufe-io/wicked.tools): Developer Tooling and sample integration code
* [wicked.test](https://github.com/apim-haufe-io/wicked.test): The Integration Test Suite
* [wicked.kong](https://github.com/apim-haufe-io/wicked.kong): The Kong Docker image used by the API Portal, based on the official Kong docker images, `kong`
* [wicked.k8s-init](https://github.com/apim-haufe-io/wicked.k8s-init): A dedicated wicked init container for Kubernetes to automatically provision client credentials to applications
* [wicked.k8s-tool](https://github.com/apim-haufe-io/wicked.k8s-tool): A tool container for special purposes when deploying the Kubernetes

Most wicked components (at least the ones written in node.js) also rely on the wicked SDK for node.js:

* [wicked.node-sdk](https://github.com/apim-haufe-io/wicked.node-sdk)

## More documentation

* [Version History](VERSION.md), [Release Notes](https://github.com/Haufe-Lexware/wicked.haufe.io/blob/master/doc/release-notes.md)
* [Todo List](TODO.md) (deprecated, new things go into the [issues](https://github.com/Haufe-Lexware/wicked.haufe.io/issues))
* [Blog post: Why we implemented our own API Portal](http://dev.haufe.com/introducing-wicked-haufe-io/)
* [Blog post: State of our API strategy (by our CTO Holger)](http://dev.haufe.com/state-of-our-api-strategy/)

# Screenshots

### Home page

![](public/screenshot.png)

### Logged in

![](public/screenshot-login.png)

### API screen

![](public/apis.png)
