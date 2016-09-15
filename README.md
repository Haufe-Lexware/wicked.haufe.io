# Wicked (Good) API Management

General information can be seen at the wicked microsite over at [wicked.haufe.io](http://wicked.haufe.io).

Things we are currently finishing currently:

* CI and Build processes, setting up official repositories
* [Documentation](/Haufe-Lexware/wicked.haufe.io/blob/master/doc/index.md)

Feel free to reach out if you have any questions.

/Martin

## Getting Started

* Read the [Getting Started Guide](http://wicked.haufe.io/gettingstarted.html) to try out how easy it is to deploy an API Portal and Gateway
* To start incorporating your own APIs, head over to the [documentation](/Haufe-Lexware/wicked.haufe.io/blob/master/doc/index.md), and read the how-to on [creating a portal configuration](/Haufe-Lexware/wicked.haufe.io/blob/master/doc/creating-a-portal-configuration.md)

## Related repositories

The following repositories contain the actual source code (this repo contains mostly documentation):

* [wicked.portal](https://github.com/Haufe-Lexware/wicked.portal): The API Portal UI
* [wicked.portal-api](https://github.com/Haufe-Lexware/wicked.portal-api): The API Portal backend API
* [wicked.portal-kong-adapter](https://github.com/Haufe-Lexware/wicked.portal-kong-adapter): The API Portal's Kong Adapter service
* [wicked.portal-mailer](https://github.com/Haufe-Lexware/wicked.portal-mailer): The API Portal's Mailer service
* [wicked.portal-chatbot](https://github.com/Haufe-Lexware/wicked.portal-chatbot): The API Portal' Chatbot service
* [wicked.portal-kickstarter](https://github.com/Haufe-Lexware/wicked.portal-kickstarter): The API Portal's Configuration Editor and Kickstarter
* [wicked.portal-tools](https://github.com/Haufe-Lexware/wicked.portal-tools): Tooling and sample integration code
* [wicked.portal-test](https://github.com/Haufe-Lexware/wicked.portal-test): The Integration Test Suite
* [wicked.kong](https://github.com/Haufe-Lexware/wicked.kong): The Kong Docker image used by the API Portal
* [wicked.mashape.kong](https://github.com/Haufe-Lexware/wicked.mashape.kong): The official Kong Docker image, fork from Mashape

### Home page

![](public/screenshot.png)

### Logged in

![](public/screenshot-login.png)

### API screen

![](public/apis.png)

## More documentation

* [Version History](VERSION.md)
* [Todo List](TODO.md) (will go into the Issues backlog)
* [Blog post: Why we implemented our own API Portal](http://dev.haufe.com/introducing-wicked-haufe-io/)
* [Blog post: State of our API strategy (by our CTO Holger)](http://dev.haufe.com/state-of-our-api-strategy/)
