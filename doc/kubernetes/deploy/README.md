# Deployment script for Kubernetes

This is a sample deployment script and configuration YML collection for wicked.haufe.io on Kubernetes.

For a general description, please see [Deploying to Kubernetes](../../deploying-to-kubernetes.md).

## Content

The Kubernetes sample deployment script consists of the following parts:

* Configmap YML template
* Deployment YMLs and templated YMLs
* Service YMLs
* Volume Claims
* Ingress YML template
* A `deploy.sh` script for deployment
* An optional `Dockerfile` (and a corresponding `variables.env`) for deployment using a Docker engine (for cases where your build tools/agent does not have a `kubectl` installed)

## Prerequisites

This script assumes the following things:

* You already have a running Kubernetes Cluster; the scripts have been tested with Kubernetes 1.4.6, but will probably work with any 1.4+ version of Kubernetes
* Your Kubernetes Cluster has a working Ingress Controller deployment up and running (this repository does not contain an Ingress Controller, just an Ingress definition)
* Your Kubernetes Cluster can fulfill the needed persistent storage claims (see below)
* You have a working `.kube/config` file with valid credentials for your k8s cluster.
* You have set up DNS entries for the API Gateway and API Portal end points which point to the Load Balancer of the Ingress Controller of your Kubernetes Cluster (or to the endpoint which reacts via SNI to your defined hosts)
* You have PEM certificates for the API and Portal endpoints, named `portal-cert.pem`, `portal-key.pem`, `api-cert.pem` and `api-key.pem`, in the same directory as `deploy.sh`
* You have defined the necessary environment variables (see below)
* You either have `kubectl` available on your build/deployment agent, or you want to use docker to run the deployment (see below)
* Wicked runs in version 0.11.2 or above

### Persistent Storage

The deployment makes use of two [persistent storage claims](volume-claims):

* Storage for the dynamic API portal data, such as users, subscriptions and such
* Storage for the PostgreSQL instance which is used by Kong

Both storages need to be reasonably fast, and at least the storage for Postgres needs to be allowed to change the owner and group of the files it reads and writes to the storage. You can find the volumes mounted into the pods in the deployments YMLs of `portal-api` and `postgres`.

A quite vanilla NFS storage is known to work for these storages, as long as `no_root_squash` is specified. Other types of storage may also work; note that currently `ReadWriteMany` is specified, even if the actual access to the storage is never done in parallel (neither by the Postgres instance nor by the Portal API), but in some cases this helps to recreate a crashed Pod/deleted Pod faster (depending on your cloud provider).

For more information on this topic also see the [Kubernetes documentation](http://kubernetes.io/docs/user-guide/persistent-volumes/).

To make sure wicked also runs on Kubernetes 1.4.x, wicked does currently **not** make use of `StatefulSet` in Kubernetes. This may be an option in Kubernetes 1.5+.

### Environment Variables

The following environment variables need to be defined to make the deployment script succeed.

Env Var | Needed/Optional | Description
--------|-----------------|-------------
`DOCKER_PREFIX` | _optional_ | The docker image name prefix to use; defaults to `haufelexware/wicked.` for the official images from Docker Hub
`DOCKER_TAG` | _optional_ | **Recommended** The Docker image tag to use for the wicked docker images. Defaults to `latest`; it's recommended to use an explicit version and upgrade consciuosly
`PORTAL_CONFIG_KEY` | **yes** | The deployment key created by the kickstarter (`static/deploy.envkey`) which is used to encrypt/decrypt secrets in the environment variables
`NODE_ENV` | **yes** | The desired wicked environment; the `static/envs/${NODE_ENV}.json` file must exist in the APIm static configuration repository
`GIT_REPO` | **yes** | The git repository to load the API configuration from; not including credentials or `https://`. Example: `bitbucket.com/yourorg/apim.config.git`
`GIT_CREDENTIALS` | _optional_ | The git credentials to use with the `GIT_REPO`, as `<username>:<password>`, URL encoded. If left empty, the git repository in `GIT_REPO` is assumed to be publicly available
`GIT_BRANCH` | _optional_ | The git branch to retrieve the API configuration from. Either `GIT_BRANCH` or `GIT_REVISION` can be used, not both. If both `GIT_BRANCH` and `GIT_REVISION` are left empty, `HEAD` of `master` is assumed.
`GIT_REVISION` | _optional_ | The git SHA1 revision to retrieve for the API configuration (from the `GIT_REPO`). Either `GIT_BRANCH` or `GIT_REVISION` (or none) can be used
`DEBUG` | _optional_ | The debug setting to pass on to the wicked components; e.g. `wicked-sdk,portal:*,portal-api:*`.
`PORTAL_NETWORK_PORTALHOST` | **yes** | The DNS entry pointing to the Load Balancer of your Kubernetes cluster you want to use for the API Portal (has to match your `global.json` and possible modification for your desired `NODE_ENV`); this is used to configure the ingress.
`PORTAL_NETWORK_APIHOST` | **yes** | The DNS entry pointing to the Load Balancer of your Kubernetes cluster you want to use for the API Gateway (Kong). It has to match your `global.json` and possible modification for your desired `NODE_ENV`; this is used to configure the ingress.

### Running `deploy.sh` natively

In order to run `deploy.sh` natively, your deployment agent needs to fulfill the following prerequisites:

* `kubectl` in a version matching your Kubernetes cluster has to be installed
* You need to have a `~/.kube/config` file which allows `kubectl` to access your Kubernetes cluster

Make sure all needed environment variables are set, then just run `./deploy.sh`. It will deploy everything which is needed for your wicked installation to run, in case all prerequisites are met.

### Running `deploy.sh` inside a docker container

To take away the need to install `kubectl` on your build agent, you may also make use of supplied `Dockerfile`; it's based on [`k8s-deploy-env`](https://github.com/Haufe-Lexware/k8s-deploy-env) and provides you with a fresh and weekly updated docker runtime which contains a Node 6.x installation (in case you need to do preprocessing) and obviously a `kubectl` installation.

Prerequisites to run `deploy.sh` with docker (in addition to all other prerequisites above):

* A valid `.kube/config` needs to be placed alongside the `deploy.sh`, named `kubeconfig`. This file is copied to the "right place" in the docker image so that `kubectl` inside the container will find it (see [`Dockerfile`](Dockerfile)).
* A working docker environment (docker engine) on your build/deployment agent

Run the following commands in the directory containing `deploy.sh` and `Dockerfile` after making sure the necessary and needed environment variables have been set:

```bash
$ docker build -t apim_deploy:latest .
...
$ docker run --rm --env-file variables.env apim_deploy:latest
...
```

## Description of the deployment files

### Config Maps

...

### Used secrets

...

#### git Credentials

...

#### TLS secrets

...

### Deployments

#### Postgres

...

#### Kong

...

#### Wicked components

...

### Service Definitions

...

### Ingress Definition

...

## Scaling and Performance tuning

### Scaling the Kong instances

...

### Using a `redis` instance for caching (Kong)

...
