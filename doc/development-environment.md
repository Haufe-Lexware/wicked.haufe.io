# Development Tooling

## Prerequisites

The tool chain for setting up a wicked development environment has primarily been tested on macOS 10.13+, and may have issues on other operating systems. It has been confirmed to be working on Ubuntu systems, and with some additional effort it also works on Windows 10 using WSL. If you run into issues, please feel free to report them, or even file pull requests against this repository.

## MAC OS: Additional Prerequisites

I strongly encourage you to use `nvm` for installing node.js also on macOS. See https://github.com/nvm-sh/nvm

## WINDOWS: Additional prerequisites

To run the development environment on Windows, proceed as follows before continuing with the below steps:

* Install Docker for Windows
    * https://docs.docker.com/docker-for-windows/install/
    * Even if we're using WSL for everything, the Docker engine is still going to be the one from Docker for Windows (docker does not natively support running under WSL, as this already is a virtualized environment in itself)
* Install WSL (Windows Subsystem for Linux):
    * See e.g., https://www.windowscentral.com/install-windows-subsystem-linux-windows-10
    * Running `wsl.exe` must open a bash terminal window
* Install docker command line tools inside WSL
    * Follow e.g.: https://nickjanetakis.com/blog/setting-up-docker-for-windows-and-wsl-to-work-flawlessly
    * Includes: Open up Docker for Windows via tcp://localhost:2375 
    * Link `DOCKER_HOST` on WSL to above docker instance
    * There is also a way to do this securely, but this works, IF you have a safe network environment - don’t do this on a public network
    * In the end, the docker command must work just like on Windows (or on any other machine), from inside the WSL
    * Known caveat: WSL uses `.bashrc` instead of the suggested `.bash_profile` in the medium article; add the export command to .bashrc instead of creating a new `.bash_profile` (which will kill everything else)
* Install `docker-compose` inside WSL:
    * `sudo apt-get install -y python python-pip`
    * `pip install --user docker-compose`
* Install `nvm`
    * https://github.com/nvm-sh/nvm
    * Install node.js 12: `nvm install 12 && nvm use 12`
* If you have not already: Install VS Code
    * https://code.visualstudio.com/download
    * Install VS Code WSL Remote Extension to be able to work on the files inside the WSL subsystem; see also https://code.visualstudio.com/docs/remote/wsl
* Clone wicked repo *inside* WSL home directory!

```
$ cd # to go to your home directory
$ pwd # to show your current path
/home/someuser
$ # here you may want to cd somewhere else - stay within the WSL file system!
$ git clone https://github.com/Haufe-Lexware/wicked.haufe.io
$ cd wicked.haufe.io
$ git checkout next
```

Then follow the normal prereq check and the normal setup procedure to download all dependencies and to build a local Kong image.

## Generic prerequisites

Generally, the following are the current known prerequisites:

* node.js 10 or later, npm 6 or later (node 12 also works)
* The latest TypeScript installed globally (`npm install -g typescript`; the command `tsc` must be available)
* A `bash` compatible shell
* A recent Docker installation, presumably Docker for Mac or Docker for Windows, or a `docker` installation (with `docker-compose`) on Linux
* `git`
* A good internet connection
* [PM2](http://pm2.keymetrics.io) installed globally: `npm install -g pm2`
* A local installation of `envsubst` ([see here, for example](https://stackoverflow.com/questions/23620827/envsubst-command-not-found-on-mac-os-x-10-8))
* **Important**: Your local machine needs an IPv4 address, such as a `10.x`, a `192.168.x` or similar; this means you cannot develop wicked without being connected to a network of some kind.

## Setting up the environment

### Step 1: Clone the wicked.haufe.io repository

To get your wicked development environment up and running as fast as possible, perform the following steps in a new blank directory, which is presumed to be called `wicked` here:

```bash
~/Projects$ git clone https://github.com/Haufe-Lexware/wicked.haufe.io
...
~/Projects$ cd wicked.haufe.io
~/Projects/wicked.haufe.io$ git checkout next
~/Projects/wicked.haufe.io$ cd src/tools/development
~/Projects/wicked/wicked.tools/development$ ./install.sh
```

### Step 2: Build a local Kong image

As wicked adds a couple of minor things to the original Kong docker image, you will need to build your Kong image locally before you can start it:

```
~/Projects/wicked.haufe.io/src/tools/development$ ./build-kong.sh
```

This will create a local docker image (on your machine) called `wicked.kong:local`; this image will be referenced to in the next step (in the [`docker-compose.yml`](docker-compose.yml) file).

<!-- ### Step 3: Create entries in /etc/hosts

**NOTE**: This assumes you are on macOS or Linux.

Run the following to create entries `portal.com` and `api.portal.com` to point to your `127.0.0.1` device:

```bash
~/Projects/wicked/wicked.tools/development$ sudo ./update-etc-hosts.sh
``` -->

### Step 3: Start the local environment

Now it's assumed that you have a local `docker` daemon running, and that you have a recent `docker-compose` binary in your path. Then just run:

```bash
$ ./start-devenv.sh 
Finding local IP addresses...
[ '10.100.3.230' ]
Building prometheus-config
Step 1/2 : FROM prom/prometheus:v2.6.0
 ---> bc2b9d813555
Step 2/2 : COPY prometheus.yml /etc/prometheus/prometheus.yml
 ---> Using cache
 ---> 1c257b0cdc87
Successfully built 1c257b0cdc87
Successfully tagged development_prometheus-config:latest
Creating network "development_default" with the default driver
Creating development_prometheus-config_1 ... done
Creating development_redis_1             ... done
Creating development_kong-database_1     ... done
Creating development_prometheus_1        ... done
Creating development_kong_1              ... done
```

**NOTE**: This assumes that the ports 5432 (Postgres), 6379 (Redis), 8000, 8001 (Kong) and 9090 (Prometheus) are not already used on your local machine.

wicked has now also been started via `pm2`; you can check on the status of the components by running `pm2 status`.

The API portal will be available at [http://localhost:3000](http://localhost:3000), and the API gateway will be available as [http://localhost:8000](http://localhost:8000) (please note that Kong will answer a request directly to this path with a `{"message":"no route and no API found with those values"}`, this is completely fine and normal).

The configuration the local installation uses is the [`sample-config` configuration](../../sample-config), which is also located in this repository. It's located at the same level in your source code tree as all the other repositories.

To delete the running environment, run the `stop-devenv.sh` script.

### Step 4: Use pm2 to start wicked locally

Now you can start wicked using pm2:

```
~/Projects/wicked/wicked.tools/development$ pm2 start wicked-pm2.config.js 
[PM2][WARN] Applications api, ui, kong-adapter, auth not running, starting...
[PM2] App [api] launched (1 instances)
[PM2] App [ui] launched (1 instances)
[PM2] App [kong-adapter] launched (1 instances)
[PM2] App [auth] launched (1 instances)
┌─────────────────────┬────┬──────┬───────┬────────┬─────────┬────────┬─────┬───────────┬─────────┬──────────┐
│ App name            │ id │ mode │ pid   │ status │ restart │ uptime │ cpu │ mem       │ user    │ watching │
├─────────────────────┼────┼──────┼───────┼────────┼─────────┼────────┼─────┼───────────┼─────────┼──────────┤
│ ui                  │ 1  │ fork │ 44863 │ online │ 0       │ 0s     │ 23% │ 20.8 MB   │ martind │ disabled │
│ api                 │ 0  │ fork │ 44862 │ online │ 0       │ 0s     │ 37% │ 22.9 MB   │ martind │ disabled │
│ auth                │ 3  │ fork │ 44870 │ online │ 0       │ 0s     │ 14% │ 18.3 MB   │ martind │ disabled │
│ kong-adapter        │ 2  │ fork │ 44868 │ online │ 0       │ 0s     │ 21% │ 20.4 MB   │ martind │ disabled │
└─────────────────────┴────┴──────┴───────┴────────┴─────────┴────────┴─────┴───────────┴─────────┴──────────┘
```

<!-- ## Now what?

Now that you have a local development environment of wicked running, you can start developing. It's assumed that you have check in rights to the `apim-haufe-io` repositories, and that you are allowed to create a branch. If this is not the case, you will still be able to work locally, or with a fork, but that's not covered here.

### Branching off for features

Features are usually implemented on a separate branch, and not on the main branch (which is usually `next`, but currently it's `wicked_1_0`). Feel free to bash Martin in case he doesn't do that in the future, but currently many things go directly into `wicked_1_0`, as it's very much work in progress.

Still, you make sure that your repository/your repositories you want to change are up to date (pulled), and then you branch off the HEAD of the main branch to create your new branch:

```
~/Projects/wicked/wicked.ui$ git status
On branch wicked_1_0
Your branch is up-to-date with 'origin/wicked_1_0'.
~/Projects/wicked/wicked.ui$ git checkout -b my_new_feature
```

Do this for all repositories you need to change for your feature, **always name the branch the same**.

Now you can use the `checkout.sh` script to switch between features fairly easily; the following assumes you are working on a feature for `wicked_1_0`, and you have branched off that branch for your own work. Now you can check out your own branch by using this:

```
~/Projects/wicked/wicked.tools/development$ ./checkout my_new_feature --install --pull --fallback wicked_1_0
```

This will check out your branch, in case it's present, and if it is not, fall back to the `wicked_1_0` branch (or `next`, or `master`, in that order). Please note that without the `--fallback` option, `checkout.sh` will fall back to the `next` branch, which currently (for wicked 1.0.0) is probably not desirable.

### Checking state of development environment

Use the following command to check the state of your development environment:

```
~/Projects/wicked/wicked.tools/development$ ./checkout.sh --info
==== STARTING ==== ./checkout.sh

Repository                     Branch               Dirty    Needs push
-------------------------------------------------------------------------------------
wicked.ui                      wicked_1_0           Yes                
wicked.api                     wicked_1_0           
wicked.chatbot                 next                 Yes                
wicked.env                     wicked_1_0                           
wicked.kong-adapter            wicked_1_0                    Yes          
wicked.mailer                  wicked_1_0           Yes                
wicked.kickstarter             wicked_1_0           Yes                
wicked.auth                    next                 Yes                
wicked.k8s-init                next                 Yes                
wicked.test                    wicked_1_0           Yes                
wicked.kong                    wicked_1_0           Yes                
wicked.k8s-tool                next                          Yes       
wicked.test                    wicked_1_0           Yes                
wicked.node-sdk                wicked_1_0                              
wicked-sample-config           wicked_1_0                              
-------------------------------------------------------------------------------------

==========================
SUCCESS: ./checkout.sh
==========================
```

This enables you to see at one glance where you have open changes ("Dirty") or where you might have forgot to push changes. **Important**: This is not any kind of magic, this is just a more convenient way of iterating over the repositories and running `git status -s` and `git cherry -v`, but it gives a nice overview. Wicked is a little beast to work with, but this makes it easier.

## Working with pm2 and docker

When developing locally with the help of `pm2` and `docker`, you will need to familiarize yourself a little with the tools. This section contains a couple of use cases and how you may solve them.

### Kill the database and start over

To start over completely with a fresh database for wicked and Kong, issue the following commands:

```
~/Projects/wicked/wicked.tools/development$ pm2 kill # This kills all running pm2 daemons and processes
~/Projects/wicked/wicked.tools/development$ docker-compose down # Kill the containers, kill network
```

Now you can restart everything again:

```
~/Projects/wicked/wicked.tools/development$ docker-compose up -d
~/Projects/wicked/wicked.tools/development$ pm2 start wicked-pm2.config.js
``` -->

### Reload a node.js component

In case you have done changes on one of the node.js components, use the following command to make `pm2` pick them up:

```
~/Projects/wicked/wicked.tools/development$ pm2 restart <component>
```

Whereas `<component>` is one of `ui`, `api`, `auth` and `kong-adapter` (currently).

### Seeing logs from node.js component

You can use `pm2 logs <component>` to tail the logs from a specific component, or just `pm2 logs` to tail the logs of **all** components at the same time. This may look nasty, depending on the `DEBUG` setting you have specified (or not specified, in which case it's what's defined in `wicked-pm2.config.js`).

PM2 will also tell you where the logs are located (usually in `~/.pm2` somewhere).

### Debug in a node.js component

Debugging in a node.js component is sometimes convenient, e.g. when running from Visual Studio Code. To do that, first stop the node.js process for the component you want to debug from in `pm2`:

```
~/Projects/wicked/wicked.tools/development$ pm2 stop portal # as an example
```

Now you can run the debugger e.g. from VS Code, just as usual.

#### Debugging api

In order to be able to debug in `wicked.api`, you will have to make sure your debugger sets a series of environment variables correctly, to make sure the portal API is able to start correctly. You can retrieve the data from [wicked-pm2.config.js](wicked-pm2.config.js); the following variables need to be defined:

* `NODE_ENV=localhost`
* `PORTAL_CONFIG_BASE=../sample-config`
* `LOG_LEVEL` can optionally be changed to either `info` or `debug`; `debug` is the default, and outputs **lots** of information

The env var `PORTAL_CONFIG_BASE` can be set to something else, but this is the sample configuration repository which usually works for development. If you want to test other configurations, go ahead and change this to use your own configuration.

The storage type in the sample repository is set to `postgres` as a default; if you want to work with the JSON backend, additionally specify the following env var:

* `PORTAL_STORAGE_TYPE=json`

This will create a `dynamic` sub dir to `../wicked-sample-config` (in addition to the `static` one containing the portal configuration).

**NOTE**: The JSON backend is no longer support for production use, and newer features will also no longer be implemented for this backend type; please use Postgres.

### Update wicked.env

In case you need to make changes to the `env` parts, you can just do this. You will have to make sure to restart the other components afterwards to make them pick up the changes. This is (currently) not automatically done, but may be in the future.

Use `pm2 restart all` to restart all components.

The `env` is linked into the other repositories via `npm link`; in case you need to install additional packages to the `env` package, please run `npm link` again afterwards. The depending projects automatically run `npm link portal-env` at `npm install`, so this should be fine.

<!-- In those cases where you need to make a change in the `env` (e.g. change/add a static configuration update or similar), you will need to propagate those changes to the two projects `wicked.api` and `wicked.kickstarter`; this is done using a shell script in the `wicked.env` repository:

```
~/Projects/wicked/wicked.env$ ./local-update-portal-env.sh
```

This script will run an `npm pack` on the `env` repository and install it to the API and to the Kickstarter. Subsequently, you can use `pm2 restart all` to refresh the node.js components.

**Note**: This script is automatically called when invoking the `checkout.sh` script with the `--install` option. -->

### Update wicked-sdk

Similarly, if you need to propagate changes to the wicked SDK locally, just make sure to restart the depending service to make it pick up the change from the node SDK.

The node SDK is written in TypeScript, but the compilation/transpilation is done automatically when pm2 detects a change to the node SDK source `.ts` files.

<!-- Similarly, if you need to propagate changes to the wicked SDK locally, you can use the following script:

```
~/Projects/wicked/wicked.env$ ./install-local-sdk.sh
```

If will pack up the current version of the wicked SDK and install it into the repositories where it's needed.

**Note**: This script is automatically called when invoking the `checkout.sh` script with the `--install` option. -->

### Run the kickstarter

There is also [`kickstarter.config.js`](kickstarter.config.js) pm2 configuration file you may use to start the wicked Kickstarter, if you just want to run it on a previously existing configuration.

In the pm2 configuration file, the configuration repository is hard coded to `../sample-config`; if you need to load a different configuration or if you need to create a new configuration, `cd` into the `wicked.kickstarter` repository and run

``` 
~/Projects/wicked/wicked.kickstarter$ node bin/kickstart
```

It will give you a short overview of the options of the kickstarter. The kickstarter starts at [http://localhost:3333](http://localhost:3333).
