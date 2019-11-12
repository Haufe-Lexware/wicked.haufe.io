# wicked.haufe.io

This repository contains the integration testing code for the API Portal docker containers.

## STATE FOR WICKED 1.0.0

**IMPORTANT**: Currently, the Portal and Kong Adapter tests are not running (in the `wicked_1_0` branch). They need to be reworked quite some, as the entire authentication and authorization pieces have been reworked.

## Running the tests on locally built container images

In order to run the integration tests locally on your own machine, the following prerequisites needs to be fulfilled.

#### Repository layout

The wicked repositories need to be cloned in the following way:

```
wicked
  |
  +-- wicked.ui
  |
  +-- wicked.api
  |
  +-- wicked.test
  |
  +-- wicked.kong
  |
  +-- wicked.kong-adapter
```

This is the default if you are using the `checkout.sh` from the [wicked.tools](https://github.com/apim-haufe-io/wicked.tools) repository. There you will find `checkout.sh` in the `development` subfolder (**IMPORTANT**: Until wicked 1.0.0, you must check out the `wicked_1_0` branch to get the full set of development tooling).

#### Docker

You will need to have a docker host available by simply invoking `docker`. Additionally, the test suite makes use of `docker-compose`, so that needs to be installed as well.

Docker is known to work with this suite as of version 1.12, Docker Compose requires to be version 1.8.0 or later.

### Running the tests

Run the integration tests by calling any of the `run-xxx-tests.sh` shell scripts in `bash` (tested on macOS and Linux, unfortunately not on Windows):

```bash
$ ./run-<api|auth|kong-adapter>-tests.sh
```

The scripts will attempt to first build the needed docker images locally (this may take some time the first time), and then runs the integration tests on the built images.

The tests are run using the non-alpine images, using JSON file storage, as a default. You can switch on the Postgres DAO and Alpine builds using the following two environment variables:

* `BUILD_POSTGRES`: Use Postgres as a backing storage
* `BUILD_ALPINE`: Build and test the Alpine images

**Example:**

```
$ BUILD_ALPINE=true BUILD_POSTGRES=true ./run-api-tests.sh
...
```

In Jenkins (see the [Jenkinsfile](Jenkinsfile), all four permutations are run (with JSON or Postgres, Alpine or Debian).

## Running the tests on prebuilt container images

In order to run the integration tests on already prebuilt containers (e.g. the official docker images from Haufe-Lexware), use the following syntax:

```bash
$ DOCKER_PREFIX=haufelexware/wicked. DOCKER_TAG=latest ./run-<api|portal|kong-adapter>-tests.sh
```

The above line will run the integration tests for the official Haufe-Lexware wicked.haufe.io docker images, having the `latest` tag. This will require that you will have checked out the `master` branch of `wicked.test`, otherwise chances are good that the test suite will not match the container images' versions.

In case your images are located on a private registry, you may also use the following environment variables:

* `DOCKER_REGISTRY`: Your private registry (e.g. `registry.haufe.io`)
* `DOCKER_REGISTRY_USER`: The registry username
* `DOCKER_REGISTRY_PASSWORD`: The registry user's password

In case `DOCKER_REGISTRY` is specified, the testing scripts will also require username and password to be set.

### Technical Things

A set of environment variables specific to the test cases are referenced via the `variables.env` file inside the `*compose.yml.template` configuration files. All test suites make use of different instances of test data, stored as `test-config` inside the sub directories. 

## Running the tests non-dockerized

The test suites can also be run locally, using the local node.js installation (this has currently only been tested on macOS). For this purpose there are the following bash scripts:

* `local-api-tests.sh`
* `local-kong-adapter-tests.sh`
* `local-auth-tests.sh`

They take a `--json` or `--postgres` parameter, depending on which DAO you want to test; all tests subsequently run with the same DAO. If you want to test both DAOs, run the same script twice. For these scripts, there isn't an "Alpine" option, as the tests actually run on your local machine. Make sure you have installed `mocha` globally using

```
$ npm install -g mocha
```

### Creating local environments for faster testing

Especially for the Authorization Server and Kong Adapter tests, the setup time is rather long (20+ seconds, depending on your system). To ease that up a little, the local test scripts `local-auth-tests.sh` and `local-kong-adapter-tests.sh` support an additional parameter `--only-env`. Using this parameter will create a testing environment for the integration tests to use, and leave that environment open so that you can iterate faster just on the test cases.

Example:

```
$ ./local-auth-tests.sh --postgres --only-env
Test dir: /Users/martind/Projects/wicked.github/wicked.test/tmp/test-20190108100718
Only setting up environment.
=== Postgres mode
INFO: Starting postgres...
INFO: Starting Kong...
[...]
INFO: Leaving environment open; go into the portal-auth directory and run

      export PORTAL_API_URL=http://localhost:3401
      mocha

      You can then use the ./kill-env.sh to kill the testing environment.
```

Then proceed as described:

```
$ cd portal-auth
$ export PORTAL_API_URL=http://localhost:3401
$ mocha
[...]

  53 passing (27s)
```

This works for the Kong Adapter tests, and for the tests of the Authorization Server. It is not implemented for the API tests (`local-api-tests.sh`) as the setup time for those tests is not as long, just a couple of seconds.

## TODOs

The tests are created as integration tests, which makes calculating code coverage impossible. The point with these tests is that the actual docker images which are used for production are tested in a real scenario (deployment via `docker-compose`). If you wanted to calculate code coverage of the integration tests, you would have to instrument the images with e.g. `istanbul`, but you would not want to have that in your production images.

A possible way of circumventing this would be to have special testing containers which allow instrumenting the containers with `istanbul` in addition to the "real" images for production use. You could then run both kinds of tests: First the integration tests on the production containers, then an instrumented test on the testing containers. Other ideas are welcome as well. 
