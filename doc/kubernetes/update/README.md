# Deployment script for Kubernetes

This is a sample update script for wicked.haufe.io on Kubernetes. It assumes that wicked has been deployed using the scripts and configuration YMLs from the [deploy](../deploy/README.md) directory.

For a generic description, please see [Deploying to Kubernetes](../../deploying-to-kubernetes.md).

## Prerequisites

* You have already deployed wicked to Kubernetes using the `deploy.sh` script from the [`deploy` folder](../deploy)
* You want to trigger a configuration update in your API static configuration
* You have a working Kubernetes deployment environment (either Linux natively, or using a docker build agent), just as for deploying

## How to update the configuration

The idea of updating the API static configuration is to simply kill the `portal-api` container in Kubernetes and let it re-pull the configuration from the static configuration git repository.

You have several possibilities:

`GIT_REVISION` | `GIT_BRANCH` | Description
---------------|--------------|-------------
_not set_ | _not set_ | The `HEAD` of `master` is retrieved automatically at restart of the `portal-api` container
**set** | _not set_ | The exact SHA1 revision specified in `GIT_REVISION` is retrieved at restart
_not set_ | **set at deploy** | The `HEAD` of the branch in `${GIT_BRANCH}` is retrieved
**set** | **set** | _Not allowed_

In order to just update to `HEAD` of branch or `master`, just run the `update-revision.sh` script without specifying `GIT_REVISION` (with the values you deployed using the `deploy.sh` script). In case you want to deploy a specific revision, specify `GIT_REVISION` with the value from the git repository (use `git rev-parse HEAD` or a similar command to get the SHA1 hash), and then call `update-revision.sh`.

## Running natively

In case you have `kubectl` installed on your deployment agent and it has access to a valid `~/.kube/config`, just call `update-revision.sh` to set the new revision and kill the portal API pod (it will automatically restart).

## Running in docker

In the directory containing `update-revision.sh` and `Dockerfile`, run the following commands:

```bash
$ docker build -t apim_update:latest .
...
$ docker run --rm --env-file variables.env apim_update:latest
...
```

**Important Note**: The `Dockerfile` assumes there is a file called `kubeconfig` in the current directory; this file is copied to the correct location so that `kubectl` can access it automatically when running inside the container.
