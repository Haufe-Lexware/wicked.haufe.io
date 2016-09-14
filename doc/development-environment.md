# Setting up a local development environment for wicked

When deploying either locally or to production, things always start with creating a new environment. This also applies to when you want to set up a development environment for actually developing the components of the API Portal.

## Prerequisites

* You will need a configuration repository; you may also just create a new one (see [creating a portal configuration](creating-a-portal-configuration.md))
* A working node.js environment (currently, Wicked is built on 4.x, but will also work on 6.x)

### Development Setups

There are multiple things you may want to do when developing for Wicked:

* Core Development (on `wicked.portal`, `wicked.portal-api` and such)
* Webhook/Plugin Development (development of a new webhook listener)

This page deals with Core Development. For Webhook development, see [webhook development](webhook-development.md).

### Minimum Development Setups

Depending on which components you want to work with, there are minimal component setups which need to run.

* **Portal and/or Portal API**: You will need to run `wicked.portal-api` and `wicked.portal`.
* **Kong Adapter**: In addition to the above, `wicked.portal-kong-adapter` needs to run, and you will need a running Kong instance
* **Webhooks**: In addition to Portal and API, run the Webhook you want to work with (e.g. `wicked.portal-mailer` or `wicked.portal-chatbot`).

It is easier not to run the components behind the HAproxy component when developing locally. All the following steps assume that this is not the case, and that you are working in a safe environment for development, and/or using non-sensitive data (testing data).

## Get the source code

The source code for Wicked is split into multiple repositories. The most usual ones for code changes are usually:

* `wicked.portal-api`
* `wicked.portal`

If you intend to create pull requests or want to remote-track the repositories, please fork the repositories you want to work on. When getting the sources, it is recommended arrange the downloaded repositories into one sub directory, like this:

```
- wicked
   |
   +- wicked.portal
   |
   +- wicked.portal-api
   |
   +- wicked.portal-env
   |
   +- ...
```

Any future scripting (such as integration testing scripts for local running) will most probably have to rely on the repositories being arranged like this.

For each repository, don't forget to run `npm install` before you actually try to run anything.

## Wiring Components for running locally

Do the following steps to set up your configuration repository for running locally. Please **note** that you will need to change the configuration repository, so use a testing repository or keep backups.

### Create a `localhost` environment

Start the [Kickstarter for your configuration repository](creating-a-portal-configuration.md). If you have done this using Kickstarter 0.9.2 or later, the default configuration will already contain environment variable definitions for the environment variables we need to override using a new environment.

The path to the directory **below** the `static` directory will be referred to as `/path/to/config`.

Create a new environment called `localhost` (see [deployment environments](deployment-environments.md)). Kickstarter (as of v0.9.2) will automatically override a number of environment variables with values which point to the local IP address instead of to the internal Docker DNS names (such as `portal` or `kong`), leveraging the internal environment variable `LOCAL_IP`, e.g. `http://${LOCAL_IP}:3000`.

### Start the Portal API

The base component of Wicked is the Portal API component. This component always has to run, and it has to know where to retrieve the static and dynamic configuration from. When it runs in `docker`, the configuration directory is always `/var/portal-api`, but when you run locally, you will have a different path.

To start the Portal API component, `cd` into the `wicked.portal-api` repository and issue the following command:

```
$ NODE_ENV=localhost PORTAL_CONFIG_BASE=/path/to/config node bin/api
```

Replace `/path/to/config` with the path to the base directory of your configuration repository (`static` is a sub directory of this directory).

The Portal API should now start, and you can check that it's running by issuing the following `curl` command in a different terminal:

```
$ curl http://localhost:3001
{"message":"OK"}
```

#### Known Issues

If you get an error message that the environment variable `PORTAL_CONFIG_KEY` could not be found, the Portal API could not find the `deploy.envkey` file in the static repository.

* Either place such a file in the `static` directory, containing the correct value (this file was created when creating the repository),
* or pre-fill the environment variable `PORTAL_CONFIG_KEY` with the correct value. 

### Start the Portal (UI)

The UI/Web Component is inside the `wicked.portal` repository. It relies 100% on the API being available, so make sure the API is running before you try to start the Web Application.

Using a fresh terminal, `cd` into the `wicked.portal` directory (issue `npm install` if you haven't already). Type the following command to start the UI:

```
$ NODE_ENV=localhost node bin/www
```

If everything is successful, you will now be able to access the API Portal at [`http://localhost:3000`](http://localhost:3000).

**Reminder**: In a fresh configuration, you will usually have a predefined Admin user `admin@foo.com` having the password `wicked`.

### Starting `kong-adapter`, `mailer` or `chatbot`

Starting other components is done in exactly the same way as starting the Portal: 

* Start a new terminal, 
* `cd` in to the corresponding directory,
* Run `npm install` (if you haven't done that already)
* Run `NODE_ENV=localhost node bin/[kong-adapter | mailer | chatbot]`.

All of the (webhook) components require the API to run. When running the `kong-adapter`, Kong also needs to run before starting the Kong adapter.

### Running Kong locally   

To run Kong locally (in order to test the Kong adapter for example), clone the `wicked.portal-tools` repository, either from your own fork, or from the official Wicked repository. Then run `docker-compose` to start Kong.

```
$ git clone https://github.com/Haufe-Lexware/wicked.portal-tools
...
$ cd wicked.portal-tools
$ docker-compose up -d
...
$
```

After a while (5-20 seconds), Kong should respond with a lenghty JSON answer to the following request (it's the Admin interface):

```
$ curl http://localhost:8001
```

If this does not succeed, you may try to remove the `-d` flag in order to see the logs of the containers in your terminal.

To stop Kong, switch into the `local-kong` directory of the `wicked.portal-tools` directory and issue the following:

```
$ docker-compose down
```
