# wicked.haufe.io SDK

## DISCLAIMER

**IMPORTANT**: This is the documentation of the wicked.haufe.io node SDK as of version 1.0.0! It will **NOT** work with previous versions of wicked.haufe.io.

Full documentation at [apim-haufe-io.github.com/wicked.node-sdk](https://apim-haufe-io.github.io/wicked.node-sdk/).

## Introduction

This node.js module is an SDK for building plugins and additions to the wicked.haufe.io API Management system.

You can find more information on wicked.haufe.io here:

* [Official Website wicked.haufe.io](http://wicked.haufe.io)
* [wicked.haufe.io Github repository](https://github.com/Haufe-Lexware/wicked.haufe.io)

This package is the base for the following wicked modules:

* Kong Adapter
* Mailer
* Chatbot
* Portal

It may be used for simpler interaction with the wicked User Management API, e.g. for creating users and registrations
from the outside, and not using the wicked Portal UI. This makes using wicked as an Identity Provider for your own
applications a lot easier.

# Usage

To install the SDK into your node.js application, run

```bash
$ npm install wicked-sdk --save --save-exact
```

The common initialization of the wicked SDK is like this, creating a machine user for the component which uses the wicked SDK to enable admin
access to the wicked API directly from your node.js, including type declarations:

```javascript
const async = require('async');
const wicked = require('wicked-sdk');

const wickedOptions = {
    userAgentName: 'your-component',
    userAgentVersion: '1.0.0',
    apiMaxTries: 10, // optional, defaults to 10
    apiRetryDelay: 500, // optional, defaults to 500
};

// Init wicked SDK and register a machine user.
async.series([
    callback => wicked.initialize(wickedOptions, callback),
    callback => wicked.initMachineUser('yourcomponent', callback),
], function (err) {
    if (err) {
        debug('Failed waiting for API.');
        throw err;
    }

    // Remember some URLs
    app.set('api_url', wicked.getInternalApiUrl());
    ...

    // Now you can use wicked as you wish.
    wicked.getUserRegistrations('regpool', someUserId, (err, registrationCollection) => {
        if (err) // ...

        //
    });
});
```

## Interface description

### Initialization Functionality

The `initialize()` function waits for the wicked API to be available and returns a `null` error if successful, otherwise an error message. If you want to change the way the SDK waits for the Portal API, you may supply `options` as [WickedInitOptions](interfaces/_interfaces_.wickedinitoptions.html).

The `initialize()` call will look for the Portal API URL in the following way:

* If the environment variable `PORTAL_API_URL` is set, this will be used
* Otherwise, if the environment is a containerized Linux (where it assumes it runs in `docker`), it will default to `http://portal-api:3001`
* Otherwise, if the environment is Windows or Mac, it will assume a local development environment, and use `http://localhost:3001`

Please consider this behaviour when deploying your own applications alongside of wicked, and pass in the correct `PORTAL_API_URL` so that the SDK can retrieve the correct settings automatically from the wicked API.

### Machine Users

It is convenient to use the [`initMachineUser`](modules/_index_.html#initmachineuser) function to create a machine user for your component to use to talk with the wicked API. **IMPORTANT**: Automatically, this machine user will have complete and full admin rights to the wicked API, so that you must handle this user with care, and e.g. not tunnel calls directly from an end user to the wicked API. This end user would then automatically have admin rights in wicked, which probably is not what you want.

### SDK functionality

The functions this SDK offers can best be viewed on the [wicked SDK index page](modules/_index_.html).

Most functions have two different versions: One simple version which automatically uses the machine user identity, and one function suffixed `As`, which takes an additional user ID so that this function can also be called in the context of a different user. In most cases, these functions aren't needed, but it may be necessary to use them. Either to show on behalf of whom an action on the wicked API was done, or to reduce risk by not using the machine user.

### API Interaction

As mentioned above, the entire wicked API is encapsulated in this SDK, so that it's usually not necessary to call the API directly, using any of the generic purpose `apiGet`, `apiPost`, `apiDelete`, `apiPatch` and `apiPut` functions. It is recommended to rather use the dedicated functions, as they also contain type information of the return values. This is especially useful if you are already developing using TypeScript, but also from JavaScript certain editors can take advantage of the type information (e.g. Visual Studio Code).

**IMPORTANT**: As of version 0.11.0 of the wicked SDK, the SDK will continuously poll the `/confighash` end point of the portal API to detect configuration changes. Changes are detected by comparing the `confighash` retrieved at initialization (the SDK does this as a default) with the current value returned by `/confighash`. In case the values do not match, the SDK will **forcefully exit the entire node process in order to make the component restart and retrieve a new configuration**.

In case you do not want this behavior, but rather would want to control yourself when to restart or reconfigure your component, specify `doNotPollConfigHash: true` in the initialization options (see above).


## Convenience Functionality

### `wicked.correlationIdHandler()`

The wicked SDK comes with a [correlation ID handler](modules/_index_.html#correlationidhandler) you can use as an express middleware. It will do the following thing:

* For incoming requests, check whether there is a header `correlation-id`, and if so, store that internally in the SDK, and in the `req.correlationId` property
* If there is no such header, create a new GUID and store it as `req.correlationId` and internally in the SDK
* For outgoing API calls (using any of the `api*()` functions), the correlation ID will be passed on as a `Correlation-Id` header

Upstream wicked functionality will pick up this header and display it in logs.

**Usage**:

```javascript
const wicked = require('wicked-sdk');
const app = require('express')();

app.use(wicked.correlationIdHandler());
// ...
```

## Promise support

All functions have an overload which also supports returning a promise instead of using the callback. If you do not supply the `callback` parameter, all functions will return a `Promise` instead.

**Example**:

```
const wicked = require('wicked-sdk');

const wickedOptions = {
    userAgentName: 'your-component',
    userAgentVersion: '1.0.0',
    apiMaxTries: 10, // optional, defaults to 10
    apiRetryDelay: 500, // optional, defaults to 500
};

// You wouldn't do it like this, this is just an example.
(async () => {
    // Init wicked SDK and register a machine user.
    try {
        const wickedGlobals = await wicked.initialize(wickedOptions);
        await wicked.initMachineUser('yourcomponent');
    } catch (err) {
        console.error('Failed to initialize wicked:');
        console.error(err);
        throw err;
    }

    // Remember some URLs
    app.set('api_url', wicked.getInternalApiUrl());
    ...

    // Now you can use wicked as you wish.
    const registrationCollection = await wicked.getUserRegistrations('regpool', someUserId);
    // ...
})();
```
