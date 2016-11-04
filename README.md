# Wicked Good API Management!

![wicked.haufe.io Logo](public/wicked-logo-300px.png)

General information can be seen at the wicked microsite over at [wicked.haufe.io](http://wicked.haufe.io). If you want to see how the API Portal looks like, check out [wicked-demo.haufe.io](https://wicked-demo.haufe.io).

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
    * And local accounts (if you need that)
* Integrated Swagger (OpenAPI) support
* A lightweight CMS based on your static configuration, coming straight from source control
* Support for API Keys and the OAuth 2.0 Client Credentials Flow out of the box
* APIs to make it easy to implement the OAuth 2.0 Implicit Grant and Resource Owner Password Grant
* Most visual things can be fully customized by configuration, including logos and stylesheets
* A stringent deployment strategy, enforcing immutable servers and infrastructure as code (leveraging docker)

And much more... what's your main reason to use wicked.haufe.io? Tell us!

What's your main reason **not** to use wicked.haufe.io? Then we're even more curious!

### What's not in the box?

The following things which you might expect from an API Management System are explicitly **not** in the box:

* API Analytics
* Log Aggregation

This does not mean it's not possible to do this with wicked, it's just that we decided not to include a prebuilt solution for these things. As the API Gateway is based on a plain vanilla docker image of Mashape Kong, anything you can hook up to Kong will also work with wicked.haufe.io, including e.g. the API Analytics tools provided by [Mashape Galileo](https://getgalileo.io), [DataDog](https://getkong.org/plugins/datadog/), [Runscope](https://getkong.org/plugins/runscope/) or [Loggly](https://getkong.org/plugins/loggly/).

It's also perfectly possible to just hook up your own ELK stack (ElasticSearch, Logstash and Kibana) to your APIs, e.g. using the [`http-log` Kong Plugin](https://getkong.org/plugins/http-log/). And if you have a good recipe for that, tell us!

# Is this for me?

If you are looking for a SaaS API Management do-it-all-for-me type of solution, wicked.haufe.io is not for you.

If you are looking for a super flexible and extensible API Management suite which will tie in with any environment and any type of deployment, wicked.haufe.io is **very much for you**.

# Getting Started

* Read the [Getting Started Guide](http://wicked.haufe.io/gettingstarted.html) to try out how easy it is to deploy an API Portal and Gateway
* To start incorporating your own APIs, head over to the [documentation](doc/index.md), and read the how-to on [creating a portal configuration](doc/creating-a-portal-configuration.md)

# Related repositories

The following repositories contain the actual source code (this repo contains mostly documentation):

* [wicked.portal](https://github.com/Haufe-Lexware/wicked.portal): The API Portal UI
* [wicked.portal-api](https://github.com/Haufe-Lexware/wicked.portal-api): The API Portal backend API
* [wicked.portal-kong-adapter](https://github.com/Haufe-Lexware/wicked.portal-kong-adapter): The API Portal's Kong Adapter service
* [wicked.portal-mailer](https://github.com/Haufe-Lexware/wicked.portal-mailer): The API Portal's Mailer service
* [wicked.portal-chatbot](https://github.com/Haufe-Lexware/wicked.portal-chatbot): The API Portal' Chatbot service
* [wicked.portal-kickstarter](https://github.com/Haufe-Lexware/wicked.portal-kickstarter): The API Portal's Configuration Editor and Kickstarter
* [wicked.portal-tools](https://github.com/Haufe-Lexware/wicked.portal-tools): Tooling and sample integration code
* [wicked.portal-test](https://github.com/Haufe-Lexware/wicked.portal-test): The Integration Test Suite
* [wicked.kong](https://github.com/Haufe-Lexware/wicked.kong): The Kong Docker image used by the API Portal, based directly on the official Kong docker image, `kong`

## More documentation

* [Version History](VERSION.md)
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
