# Using the Sample Portal

## Prerequisites

None.

## Demo/Sample Portal

There is a sample portal using the latest version of wicked at

[wicked-demo.haufe.io](https://wicked-demo.haufe.io)

The sample portal only contains two APIs, of which one is not visible publicly, but only after you have signed up for the API Portal, and have verified your email address.

## Signing up to the portal

Go to [wicked-demo.haufe.io/signup](https://wicked-demo.haufe.io/signup). There you will have the choice to either sign up to the API Portal using an email address and password, or you can use any of the social logins offered there (currently the portal supports Github and Google authentication).

If you choose to sign up using email and password, you will receive an email from the portal where you have to click a link to verify your email address. If you do not do this, you will not be able to actually use the API Portal. This is a configuration setting you can change if you want to (for your own portal), but in the sample portal, this is required.

In case you use the social logins (Github or Google), the sample portal will ask you to grant access to your email address; in these cases, you will not need to verify your email address, as the portal assumes the ones associated with Google or Github are correct.

## Browsing the APIs

After logging in to the portal, you can browse the APIs which are published via this API Portal at the following URL:

* [wicked-demo.haufe.io/apis](https://wicked-demo.haufe.io/apis) 

We have chosen to publish the "classic" Petstore API which is used for demo purposes for Swagger. It's available not only once, but twice for the following reason: The API Portal is able to secure an API backend using (currently) two different approaches: Either using API Keys (which have to passed in a custom header, usually `X-ApiKey`), or using the OAuth 2.0 Client Credentials Flow.

The first Petstore API is secured via API Keys, which is indicated by the following icon:

![API Key Icon](images/key-icon-64.png)

The second API is called Petstore OAuth, and is secured via OAuth, which is indicated by the following icon:

![OAuth Icon](images/oauth2-icon-64.png)

In order to subscribe to one of those APIs, you will first need to tell the Portal which Application (or, "Client") will use the API. This is done by registering an application.

## Registering an Application

Browse to the following location (or use the main menu on the website):

* [wicked-demo.haufe.io/applications](https://wicked-demo.haufe.io/applications) 

Create an application, which corresponds to the client which will use the API in the end, by supplying an application ID and an application name. The application ID can only contain characters `a-z`, hyphens and numbers (`0-9`), whereas the friendly name should contain just that, a friendly name for the application which makes it easier to identify it.

**Note**: The application ID must be unique for the API Portal; for the sample portal it may very well be that `test-app` is already taken ;-).

## Subscribing to an API

Now go back to the [APIs](https://wicked-demo.haufe.io/apis) page and select the "Petstore" API. Now you see your application in a list on the API page, and a big green button which says "Subscribe". Click it, and you will be presented a set of different plans you subscribe to the API with: "Basic Plan", "Stupid Plan" and "Unlimited Plan". The first two plans do not require approval by an admin, so select one of those plans, perhaps even the "Stupid Plan", so that you can see what kind of functionality is behind the API Gateway (which is [Kong](https://getkong.org)).

After clicking "Subscribe!", the portal takes you back to the [Petstore API page](https://wicked-demo.haufe.io/apis/petstore), where your application is now displayed together with the API key which was generated automatically by the Portal. When you use the API from your application, this is your API credential you have to pass in when calling the API. If you do not, the API call will be rejected due to lack of credentials.

Now click the "Try it!" button to the right of the application line.

## Trying out the API with Swagger UI

The API portal supports Swagger/OpenAPI documentation of APIs, and incorporates Swagger UI directly in the portal. Swagger UI can be used in two modes: Either in documentation only mode (when clicking on the "Description" and "View Swagger Definition"), or in an interactive mode ("Try it!"). If you followed the steps from above, you will now be presented Swagger UI in interactive mode, which means that you can actually call the backend API (here: the Petstore API) directly from the website, using AJAX calls.

To quickly try this out, open the `store` section of the documentation, and look for the operation `GET /store/inventory`. Click it and you will see that the operation has an additional parameters `X-ApiKey` which is usually not part of the Petstore Swagger file. This parameter (header) is automatically added by the API portal to make clearer how to use the API over the API Gateway. You will also see that the header has been prefilled with your API key which was generated in the above subscription test.

Now click "Try it out", and the request will go through to the API, via the API Gateway.

### Tweaking and Testing

Now change the last character in your `X-ApiKey` header and retry the request. What will happen is that the API Gateway (remember, Kong), rejects the request with a `403` response (Unauthorized), due to the fact that the API key is wrong.

Take back the change and re-enter your actual API key. Now press "Try it out" again, once or twice quite fast after each other. Depending on the time you took between the last request and the following request, Kong will reject your request with a `429` response code, as your quota of API calls is full (remember: We selected the "Stupid Plan", with a rate limit of 1 call per minute).
