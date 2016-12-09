# Injecting static configuration using `git clone`

The git clone method of injecting the static configuration into the API portal works like this: At container startup, the static configuration directory (`/var/portal-api/static`) is deleted and fetched from a git repository. This is done every time. By specifying the following environment variables at startup of the API Portal (they are as a default passed on to the container, see the `environment:` section of the `portal-api` service in the `docker-compose.yml` file):

| Variable | Mandatory | Description |
| ---- | ---- | ---- |
| `GIT_REPO` | yes | The repository to get the static configuration from, e.g. `bitbucket.org/yourorg/apim.config.git`. Mandatory if you want to use the git clone method for injecting the static configuratin. |
| `GIT_CREDENTIALS` | - | The git credentials to use with the `GIT_REPO`, as `username:password`, possibly URI encoded in case the password contains difficult characters. If empty, a public repo is assumed. |
| `GIT_BRANCH` | - | The git branch to checkout. Mutually exclusive with `GIT_REVISION`. |
| `GIT_REVISION` | - | The exact SHA revision has to check out using git, has to be the "long" revision hash. Mutually exclusive with `GIT_BRANCH`. |  

How these environment variabes are injected into the running `portal-api` service container depends on the orchestration runtime you are using (docker host, Kubernetes, ...). Using docker or docker Swarm with `docker-compose`, the environment variables need to be present on the system you are calling `docker-compose` from. With Kubernetes, you will need to inject the environment variables into the Deployment definition via either a ConfigMap or `kubectl create secret generic` (depending on how secret the configuration is).

## Making deployments reproducible

It is probably a good idea to always use `GIT_REVISION` when deploying to be able to have reproducible deployments and to be able to revert to a previous configuration version very quickly in case a mistake was made (e.g. if the `portal-api` detects a problem in its sanity check at startup).

In case you use `HEAD`, you will always have to roll forward, which may be convenient enough for not so critical deployments, but usually having the possibility to roll back is definitely something to strive for.

**Example**: Usually you would react on checkins to the API configuration git repository, and inside your build pipeline (in Jenkins, GoCD,...) you can use the git hash retrieved from this configuration repository to pass it in to your deployment runtime:

```
export GIT_REVISION=$(git rev-parse HEAD)
export GIT_REPO=...
```

Depending on your orchestration runtime, it's enough to have these in memory while deploying (using `docker-compose`). For Kubernetes, you will need to update your container configuration and/or config maps to include the new revision of the configuration repository.
