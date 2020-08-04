# wicked-in-a-box

In the past, one of the more challenging things has been to run wicked as a local deployment on your local development machine. As wicked is a distributed application consisting of several different services, usually running as one or more containers each, this took some effort and was somewhat error prone. To make this easier, "wicked-in-a-box" was written.

## What's this?

Wicked-in-a-box is a single container containing all the services, including a Kong instance, wicked needs to operate. It's **not** intended for production use (we recommend running in [Kubernetes](deploying-to-kubernetes.md)), even though it might work for smaller, internal, deployments.

A fully functional wicked-in-a-box deployment consists of two containers:

* A postgres container
* The `wicked.box` container

## Getting started

### Prerequisites

In order to make wicked-in-a-box work, you need to fulfill the following requirements:

* A recent Docker installation on your local machine (Docker for Mac or Docker for Windows recommended, see below for specialties on Linux)
* An empty folder which can be mounted into your Docker environment (by using the "Share" mechanism of Docker)
* A recent [node.js installation](https://nodejs.org/de/download/) (to run the command line interface), preferrably a 10.x version
* You have installed the wicked CLI: `npm install -g wicked-cli`

The installation of [Docker](https://docs.docker.com/install/) and node.js is not covered here. Please refer to the corresponding websites for more information.

### Quick Start

Follow these steps to get a wicked environment up and running, using a fresh wicked configuration directory:

* Create a new directory; make sure that Docker is allowed to share this directory with running containers. For Docker for Mac, this is fairly straightforward; for Docker for Windows on Windows 10, when using corporate (work/school) accounts, [it can be a little more challenging](https://blogs.msdn.microsoft.com/stevelasker/2016/06/14/configuring-docker-for-windows-volumes/)
* Open a command line (`cmd.exe` on Windows, or Terminal on macOS/Linux)
* `cd` into the new directory
* Run `wicked tags list`

From the offered tags, pick the newest version, e.g. `1.0.0-rc.14` (or use `latest` for the latest released build), and run

* `wicked tags set <tag>`: This stores the selected version into `~/.wicked/wicked.json`
* Run `wicked kickstart . --new`

The last command means that the "wicked Kickstarter", the configuration tool for wicked, is called on the current directory `.`, and is told to create a `--new` configuration. The command will first pull the image from the Docker Registry.

For now, you can just stop the Kickstarter again just after it has started (using `Ctrl-C`); this documentation contains a lot more information on how to use the Kickstarter to configure wicked.haufe.io, but for now we just need the standard configuration.

Continue as follows:

* `wicked postgres start`: This starts a local Postgres instance in a container; if the image is not present, it will be pulled automatically
* `wicked box start .`: Start wicked-in-a-box

If everything is correct, you will now be able to start [wicked in a box from localhost:3000](http://localhost:3000). Allow a couple of seconds, up to half a minute, for all the components to start up correctly.

Coming with the default standard configuration, there is a default admin user with the **login name `admin@foo.com` and the password `wicked`** you can use for playing with the portal.

### Changing an existing configuration

Instead of using the `--new` flag, you can use the following command to open the Kickstarter for an existing configuration directory:

```
$ wicked kickstart <config dir>
```

Please note that when changing the configuration which is used in a running wicked box instance, the changes do **not take effect immediately**. You need to reload the configuration first.

### Reloading the configuration

In order to reload the configuration when running a wicked box (or actually, running any wicked installation), log in as an admin user and go to the "System Health" page ([localhost:3000/admin/health](http://localhost:3000/admin/health) for the standard installation). There you will find a "Reload Configuration" box which includes a "Restart Components/Reload Configuration" button. Pressing this button will reload the wicked API component, and subsequently also all other components. Allow up to 20 seconds for the entire system to get back into a running state.

Using this "Reload Configuration" functionality, you can have a fast development cycle of the wicked configuration on your local machine without having to restart the entire system, or without having the need to check in configuration changes to git to test them on a development cluster first. Early misconfiguration can be caught easier this way.

## Usage Reference

### `wicked tags`

The `wicked tags` commands are used to set, get and list the docker tags which can be used to run wicked-in-a-box.

```
$ wicked tags --help
Usage: wicked-tags [options] [command]

Options:
  -h, --help  output usage information

Commands:
  get         get currently selected tag
  list        list available docker tags
  set         set the tag to use as a default
```

### `wicked postgres`

The `wicked postgres` commands help running a Postgres instance as a container which can be used for persisting the data of wicked-in-a-box.

```
$ wicked postgres --help
Usage: wicked-postgres [options] [command]

Options:
  -h, --help  output usage information

Commands:
  start       starts a local Postgres container
  stop        stops the local Postgres container
  status      checks status of the Postgres container; returns 0 if running, 1 if not
```

### `wicked postgres start`

```
$ wicked postgres start --help
Usage: wicked-postgres-start [options]

Options:
  --volume <volume>  specify where to store the Postgres data; leave empty to not write to host storage.
  -p, --port <port>  specify the port to expose to the localhost (default: 5432)
  -t, --tag <tag>    specify which Postgres docker image tag to use (default: "11-alpine")
  --no-pull          do not attempt to pull the image
```

### `wicked box`

The `wicked box` commands manage the actual wicked-in-a-box container. To start up a wicked box container, a Postgres container must already be up and running.

```
$ wicked box --help
Usage: wicked-box [options] [command]

Options:
  -h, --help       output usage information

Commands:
  start [options]  start wicked-in-a-box
  stop [options]   stop wicked-in-a-box
  status           check status if wicked-in-a-box; returns 0 if running, 1 if not.
```

#### `wicked box start`

```
$ wicked box start --help
Usage: wicked-box-start [options] <configdir>

Options:
  -t, --tag <tag>                    wicked Docker tag to use (default: "1.0.0-rc.14")
  -u, --ui-port <ui-port>            port to expose the portal UI on (default: 3000)
  -g, --gateway-port <gateway-port>  port to expose Kong on (API Gateway) (default: 8000)
  -a, --admin-port <admin-port>      port to expose Kong's Admin port on (defaults to off)
  -w, --api-port <api-port>          port to expose wicked's API port on (defaults to off)
  -e, --node-env <node-env>          the NODE_ENV (wicked environment) to use (default: "box")
  -l, --log-level <log-level>        log level to use in the wicked components (debug, info, warn, error) (default: "info")
  --docker-host <docker-host>        DNS name or IP address of the docker host (default: "host.docker.internal")
  --no-pull                          do not attempt to pull the image
  --no-wait                          do not wait (up 60 seconds) until environment has started
  --no-open                          do not open the browser with the portal after it has finished; implied by --no-wait
  --allow-any-redirect-uri           allow any (syntactically valid) redirect URI (sets ALLOW_ANY_REDIRECT_URI)
  -h, --help                         output usage information
```

## Advanced Topics

### How does this work under the hood?

The wicked command line interface is a fairly simple node.js application which runs on the command line. For actually running applications (or Postgres), it leverages the Docker API via the [dockerode](https://github.com/apocas/dockerode) node.js library.

This means that all wicked applications are not actually running locally on your machine, but isolated in Docker containers. They simply behave as local commands via the wicked command line.

Any data which is manipulated (the configuration via the Kickstarter or the Postgres data files via the `--volume` option, see below) has to be **mounted** into the Docker container. This is the reason why the Shares must be set correctly. Otherwise Docker is not allowed to actually mount the data directories into the containers.

The share settings is nothing which wicked can (currently) help configuring, for security reasons. This has to be done (once) manually.

### The `box` environment (and Linux specialties)

As the [wicked deployment environment](deployment-environments.md) the wicked box container needs is very different from the environment needed for e.g. a Kubernetes deployment, there is a separate environment called `box` in each newly create configuration; if your static configuration does not yet have a `box` environment, please run `wicked kickstart <config dir>` on the configuration directory once to add the `box` environment. You will be able to see this in the repository diff as well.

The `box` environment contains the routing between the different services inside the wicked box container. These are mostly simply URLs containing `http://localhost`, as all services run on the `localhost` as seen from inside the container.

The only different host setting is the one for the Postgres; as a default on `box`, this is set to `${DOCKER_HOST}`, which has to be the IP/alias DNS by which the wicked box container can reach the local machine. On Docker for Mac and on Docker for Windows, you can use the alias `host.docker.internal`. This value is already predefined in the `box` environment. On Docker for Linux, this alias **does not work**. This means that you, on Linux, need to pass in the actual IP of the docker host when starting up the wicked box:

```
$ wicked box start <config dir> --docker-host <host IP, as reachable from inside containers>
```

This overwrites the `DOCKER_HOST` environment variable in the wicked box container and thus automatically routes anything which contains the env var `${DOCKER_HOST}` in any of the configuration settings of wicked to the local machine host.

### Routing to services on your host machine

The above trick with `DOCKER_HOST` can be used to achieve a very powerful thing: Enabling routing traffic via wicked's API Gateway to a service which **runs locally on your machine**. This unlocks the possibility to have a full OAuth2.0 enabled development environment running on your local machine, while still routing the traffic to your own services.

Do as follows, using the wicked Kickstarter (`wicked kickstart <config dir>`, remember?):

* The specifying the "upstream service URL", specify the value you would need in production; this should always be the default (e.g. `http://some-service.default.svc.cluster.local` for Kubernetes deployments)
* Create an ENV VAR using the Kickstarter
* Save the API configuration

Now go into the [environments section](http://localhost:3333/envs) of the Kickstarter and open the `box` environment:

* Overwrite the environment variable with the following value: `http://${DOCKER_HOST}:<port>`, filling in the appropriate port to your service running locally
* Save the environment configuration
* Reload the configuration/start the wicked box

You should now be able to route traffic via wicked/Kong, which runs in a container, to your locally running service.

### Persisting Postgres Storage on the host machine

By using the `--volume` option of the `wicked postgres start` command, it is possible to persist the Postgres data to the local machine. This can be useful for development environments where you do not want to lose the subscriptions to APIs inside your local development environment.

Just like with the `wicked kickstart` command, it is important that the Postgres Container (i.e. Docker) is allowed to mount the given data volume directory into the Docker Postgres container. As soon as you have made sure that this is possible (by checking the Share configuration of your Docker installation), use the following command:

```
$ wicked postgres start --volume </path/to/datadir>
```

You can now, after you have finished working, safely shut down the Postgres container (`wicked postgres stop`) but still use the same data when you start the Postgres container the next time. Just use the same data directory `--volume` argument.

**Note**: Postgres must be allowed to `chown` and `chmod` the files inside this directory. On Windows and macOS, this is probably possible out of the box, but it may require some additional permission setting on Linux.

### Working with the wicked SDK and the wicked API

If you want to integrate your own (node.js) application with some of the more advanced features of wicked, or for example write a webhook listener which listens to the wicked events, you can have a look at the [wicked Node SDK](../src/node-sdk). Wicked-in-a-box makes it quite easy develop against wicked using the wicked Node SDK.

In order to expose the wicked API to the local machine, use the `--api-port` switch of the `wicked box start` command, e.g.

```
$ wicked box start <config dir> --api-port 3001
```

This will expose the wicked API on port 3001 (which is the standard port for the wicked API); verify that it the API is responding (allow a couple of seconds for the container to start) using `curl` or Postman (or similar):

```
$ curl http://localhost:3001/globals
```

The wicked API will answer with all the global settings (from the `globals.json` file of the configuration).

### Exposing the Kong Admin API

Just like it's possible to expose the wicked API, it's possible to expose Kong's Admin API Port. Add the `--admin-port` command switch like this:

```
$ wicked box start <config dir> --admin-port 8001
```

Verify that Kong is working correctly by using a command similar to this:

```
$ curl http://localhost:8001
```

Kong should answer with a JSON response on the status of the Kong instance.

### Debugging

In some cases you may encounter issues when running wicked; this especially applies to situations where you changed your configuration (e.g. using the Kickstarter), and wicked does not start up correctly.

#### Measure 1 - Checking the logs

All wicked components (and Kong) log to `stdout` of the wicked box container. To see the logs of the wicked box, use this command:

```
$ docker logs wicked-box
```

To tail the logs, use

```
$ docker logs -f wicked-box
```

In case there are configuration issues which prevent the wicked API to start, you should be able to fairly quickly locate the issue by reading the logs.

#### Measure 2 - Upping the log level

For really tricky issues, it may also be necessary to increase the log level of the wicked components. You can do this by starting the wicked box with an additional `--log-level` option:

```
$ docker box start <config dir> --log-level debug
```

Then use the above-mentioned commands to view the logs.

**Note**: Using `--log-level debug`, wicked will output a **a lot** of debug messages. The logs may also contain sensitive information, such as password, client secrets or API keys, so please handle this option with care, and make sure you handle the log files appropriately.
