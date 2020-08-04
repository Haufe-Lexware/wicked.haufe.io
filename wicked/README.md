# wicked.haufe.io Helm Chart

This directory contains a [Kubernetes Helm](https://github.com/kubernetes/helm) chart for wicked.haufe.io. This is the preferred way of deploying wicked to a Kubernetes cluster. If you run into issues, please tell us.

Deploying wicked using a Helm chart is the easiest way to get wicked up and running on Kubernetes. The default configuration will deploy a sample portal assuming an ingress at `https://portal.com` (for the API Portal) and `https://api.portal.com` (for the API Gateway).

Most things are configurable via the Chart, like which parts of wicked you want to deploy (mailer and chatbot are e.g. not deployed by default), whether you want persistence or not, and whether you want to deploy a separate Postgres instance for Kong, or perhaps use your own.

Please check [values.yaml](values.yaml) and the list of [overridables](#overridables) for an overview of how you can configure this chart.

## Deploying to `minikube`

This section describes how to deploy a test configuration to `minikube`, using a [predefined configuration repository](https://github.com/apim-haufe-io/wicked-sample-config).

For a description of how to deploy your own static configuration to your own cluster, please refer to the [section on common overridables](#overridables).

### Prerequisites

This little "tutorial" assumes that you have `minikube` v0.14 or higher installed. Additionally you will need the `helm` binary on your machine and in your path. Further it's assumed that you have run `helm init` for your cluster so that the `tiller` component is already running on your cluster.

### Configure ingress

wicked usually needs an ingress controller, and thus `minikube` must enable its internal ingress controller, so make sure you have run the following command on your cluster:

```
$ minikube addons enable ingress
```

It is also assumed that you have some knowledge of Helm, and that you have run `helm init` to install the `tiller` component on your cluster.

### Deploy wicked

If that is set and done, you may now install wicked using the Helm chart. Move into a suitable directory, and then download the chart using `helm fetch`:

```
$ export WICKED_VERSION=1.0.0-rc.14 # Possibly adapt to the latest version
$ helm fetch --untar https://github.com/Haufe-Lexware/wicked.haufe.io/releases/download/v${WICKED_VERSION}/wicked-${WICKED_VERSION}.tgz
```

Now the Helm Chart will have been downloaded into a directory called `wicked`. You can now use that chart to install wicked to minikube:

```
$ helm install --set minikubeIP=$(minikube ip) wicked
```

This will take a while, as the Helm Chart by default waits until all deployed pods are up and running. By opening a different terminal, you can check on the status of the pods coming up one after another.

**IMPORTANT**: Then run `minikube ip` once more, and edit your own `/etc/hosts` (or corresponding file on Windows) to add the names `portal.com` and `api.portal.com` to point to this IP address.

*Hint:* If you want to assign a non-random name to your release of wicked to your cluster, supply a name using the `--name some-name` argument when doing the `helm install`.

### Wait until all pods run

Check the status of the pods to check whether they run correctly:

```
$ kubectl get pods
NAME                                                  READY     STATUS              RESTARTS   AGE
jazzed-donkey-wicked-api-3476386645-gpl9b             0/1       ContainerCreating   0          7s
jazzed-donkey-wicked-kong-1721255491-tnwh7            0/1       ContainerCreating   0          7s
jazzed-donkey-wicked-kong-adapter-1643021111-gsbbr    0/1       ContainerCreating   0          7s
jazzed-donkey-wicked-kong-database-1720894969-3mp4c   0/1       Running             0          7s
jazzed-donkey-wicked-portal-2044492266-97t6m          0/1       ContainerCreating   0          7s
```

After a while it should look like this (depends on your local bandwidth; the images need to be pulled from docker hub):

```
$ kubectl get pods
NAME                                                  READY     STATUS    RESTARTS   AGE
jazzed-donkey-wicked-api-3476386645-gpl9b             1/1       Running   0          1m
jazzed-donkey-wicked-kong-1721255491-tnwh7            1/1       Running   0          1m
jazzed-donkey-wicked-kong-adapter-1643021111-gsbbr    1/1       Running   0          1m
jazzed-donkey-wicked-kong-database-1720894969-3mp4c   1/1       Running   0          1m
jazzed-donkey-wicked-portal-2044492266-97t6m          1/1       Running   0          1m
```

Now we're ready to...

### Open the wicked portal

You should now be able to open the API portal at [https://portal.com](https://portal.com). You may log in using the default dummy admin user `admin@foo.com` with the password `wicked`.

<a name="overridables">&nbsp;</a>

## Common overridable options in `values.yaml`

When deploying your [own static configuration](../doc/creating-a-portal-configuration.md) with your own API definitions (which is what you usually would want to do, just having the "Petstore" gets boring after a while, right?), you will need to specify a couple of additional things via the `values.yaml` (or your own override YAML file).

Most things are directly configured via the Kickstarter configuration tool, but some settings need to be specified at deploy time, as they are needed when deciding **how** to deploy wicked onto your Kubernetes cluster.

The following table shows the most common options of overridable settings in the `values.yaml`:

Setting | Must Override | Default | Description
--------|---------------|---------|--------------
`namespace` | - | `default` | Kubernetes Namespace to deploy to
`useRbac` | - | `false` | Specify `true` to also add an RBAC ServiceAccount, Role and RoleBinding for wicked, which is able to read Pod information from the Kubernetes API (needed to wait for containers being ready).
`deployDeadline` | - | `300` | Number of seconds Helm waits for the installation of wicked to get up and running (all deployments have ready Pods); you may need to extend this amount of time depending on where you download the images from, and whether you deploy Alpine or Debian images of wicked.
`deployChatbot` | - | `false` | Specify `true` to also deploy the Chatbot (requires special configuration using the Kickstarter)
`deployMailer` | - | `false` | Specify `true` to also deploy the Mailer (requires special configuration using the Kickstarter)
`kong.replicas` | - | `1` | Specify the number of Kong replicas to spin after the deployment was successful
`kong.headers` | - | `server_tokens, latency_tokens` | Which headers will Kong return to the caller of the API; see [documentation](https://docs.konghq.com/0.14.x/configuration/#headers). Specify `off` to not return any Kong headers (e.g., to make sure that the technology is not announced for security reasons)
`config.envName` | - | `k8s` | The wicked Environment to start wicked with; if you have created your configuration with a Kickstarter version >= 0.12.1, the `k8s` environment will be automatically prepopulated, so that you don't need to override this.
`config.deployKey` | **X** | `<sample deploy key>` | This has to be set to the content of the `deploy.envkey` which was generated by the Kickstarter when first creating your static configuration. This should be stored as a secret in your build system (Jenkins/GoCD) and not be checked in somewhere.
`config.repository` | (**X**) | `<sample repostitory>` | Specify where the `portal-api` container can clone the static configuration from; see [git clone method](../doc/static-config-git-clone.md) for more information. **Only applies if you are not using a custom image for the `portal-api` container (see below).** Is mapped to `GIT_REPO`
`config.credentials` | - | `""` | The git credentials to use with the `GIT_REPO`, as `username:password`, possibly URI encoded in case the password contains difficult characters. If empty, a public repo is assumed. Is mapped to `GIT_CREDENTIALS`
`config.branch` | - | `""` | The git branch to checkout. Mutually exclusive with `config.revision`. Is mapped to `GIT_BRANCH`
`config.revision` | - | `""` | The exact git ref to check out using git, has to be the "long" revision hash. Mutually exclusive with `config.branch`. Is mapped to `GIT_REVISION`. **It is highly recommended to set this.**
`config.debug` | - | `""` | Debug settings for the node.js containers; specify `*` to get full debugging output.
`config.useCustomApiImage` | - | `false` | Set to `true` if you want to deploy your own derived `portal-api` image, e.g. if you have embedded the static configuration into this image to avoid using the (recommended) `git clone` method.
`config.customApiImage` | - | `nil` | The (fully qualified) image name of your derived `portal-api` image. Take care that you have added `imagePullSecrets` (see `values.yaml`) if appropriate.
`ingress.enabled` | - | `true` | Specify `false` to **not** deploy an ingress resource for routing the API Portal and Gateway to the corresponding services.
`ingress.class` | - | `nginx` | The ingress class (`kubernetes.io/ingress.class`) to apply to the ingress resources.
`ingress.apiHost` | **X** | `api.portal.com` | The (desired) FQDN of the API Gateway; this must point to the (load balancer of the) ingress controller selected via the ingress class, preferably before the deployment.
`ingress.portalHost` | **X** | `portal.com` | The (desired) FQDN of the API Portal; this must point to the (load balancer of the) ingress controller selected via the ingress class, preferably before the deployment.
`ingress.useKubeLego` | - | `false` | Set to `true` to add the necessary annotations for `kube-lego`; Note that this will **not** deploy `kube-lego` on your cluster, but merely use it if present (and usable in the desired namespace)
`ingress.existingTls` | - | `false` | If useKubeLego is false, set this to true to use the secret names in the tls property for the ingresses. Otherwise the standard secrets for `portal.com` and `api.portal.com` are used. **It's a must for production deployments to either use `existingTls` or `useKubeLego` to get correct TLS certificates.**
`ingress.tls.apiHostSecret` | - | `gateway-ingress-tls` | If `existingTls` is set to `true`, specify the TLS secret name for the API Gateway Host's FQDN here.
`ingress.tls.portalHostSecret` | - | `portal-ingress-tls` | If `existingTls` is set to `true`, specify the TLS secret name for the API Portal Host's FQDN here.
`redis.deployRedis` | - | `true` | Deploy a redis database which the wicked Portal and Auth components use as a session store. Please note that wicked as of 1.0.0 **requires** a redis instance; it is also used for caching rate limiting for Kong.
`redis.useRedis` | - | `true` | Specify that the Portal should use redis as a session store; depending on whether you let this chart deploy its own redis server or not, you will also need to specify the credentials and host/port for the redis server
`redis.host` | - | `redis.provider.com` | If you use a custom redis server, specify the custom redis host here.
`redis.port` | - | `6379` | If you use a custom redis server, you may specify a custom redis port here.
`redis.password` | - | `some_password` | If you use a custom redis server, you may specify a custom redis password here.
`postgres.deployPostgres` | - | `true` | Decides whether a dedicated PostgreSQL instance for Kong is deployed as a part of this installation. This is good for test and development deployment, but if you want to use a different PostgreSQL instance, specify `false` here. **A separate Postgres deployment is recommended for production deployments.**
`postgres.pgHost` | - | `postgres.host.com` | **Postgres Setting for Kong**: In case you decide to use a custom PostgreSQL instance, specify the Postgres Host IP/DNS name here.
`postgres.pgPort` | - | `5432` | **Postgres Setting for Kong**: In case you decide to use a custom PostgreSQL instance, specify the Postgres port here.
`postgres.pgDatabase` | - | `kong` | **Postgres Setting for Kong**: Specify the Kong database inside the PostgreSQL instance here; in case you are using a custom Postgres instance, this database has to exist, otherwise it will automatically be created.
`postgres.pgUser` | - | `kong` | **Postgres Setting for Kong**: Specify the Postgres user for Kong; if you are using the default Postgres installation (`deployPostgres: true`), this is the user name which will be created for Kong, otherwise it has to exist in your existing Postgres instance (and have access rights to the above database).
`postgres.pgPassword` | - | `kong` | **Postgres Setting for Kong**: Specify the Postgres password for Kong; if you are using the default Postgres installation (`deployPostgres: true`), this is the password which will be used when creating the user for Kong, otherwise it has to exist in your existing Postgres instance (and have access rights to the above database).
`postgres.pgSsl` | - | `false` | **Postgres Setting for Kong**: Set to `true` to set the Postgres SSL mode to "require". This is especially needed when using a managed Postgres service such as Azure Database for Postgres, which requires this option and does not let the client negotiate.
`postgres.persistence.enabled` | - | `false` | Set to `true` to persist the Postgres data to a Persistent Volume Claim. If set to `true`, specify the volume claim below. **Please note that it's recommended to use an external Postgres for production deployments!**
`postgres.persistence.existingClaim` | - | `""` | If you want to use pre-existing volume claim for the Postgres persistence, specify it here. Mutually exclusive with the option `postgres.persistence.storageClass` which is used for dynamic provisioning of volume claims.
`postgres.persistence.storageClass` | - | `""` | If your cluster supports dynamic provisioning of volumes (provision volumes for volume claims automatically), specify the storage class for the Postgres persistent volume here. Mutually exclusive with `postgres.persistence.existingClaim` (use either).
`postgres.persistence.accessMode` | - | `ReadWriteOnce` | The volume is mounted to the `kong-database` container using this access mode.
`postgres.persistence.size` | - | `1Gi` | The size of the volume for Postgres data persistence. 1 GB is usually more than enough for this (probably also 100 MB would suffice, depending on your needs). Only applies if using dynamic volume provisioning.
`storage.pgHost` | - | - | **Postgres Setting for Wicked**: In case you decide to use a custom PostgreSQL instance, specify the Postgres Host IP/DNS name here.
`storage.pgPort` | - | - | **Postgres Setting for Wicked**: In case you decide to use a custom PostgreSQL instance, specify the Postgres Host IP/DNS name here.
`storage.pgDatabase` | - | - | **Postgres Setting for Wicked**: Specify the name of the Wicked database inside the PostgreSQL instance here; in case you are using a custom Postgres instance, this database either has to exist, or the given user (see below) must have sufficient rights to create this database (and a schema)
`storage.pgUser` | - | - | **Postgres Setting for Wicked**: Specify the Postgres user for Wicked; if you are using the default Postgres installation (`deployPostgres: true`), this is the user name which will be created for Kong/Wicked, otherwise it has to exist in your existing Postgres instance (and have access rights to the above database).
`storage.pgPassword` | - | `kong` | **Postgres Setting for Wicked**: Specify the Postgres password for Wicked; if you are using the default Postgres installation (`deployPostgres: true`), this is the password which will be used when creating the user for Wicked/Kong, otherwise it has to exist in your existing Postgres instance (and have access rights to the above database).
`storage.pgSsl` | - | `false` | **Postgres Setting for Wicked**: Set to `true` to set the Postgres SSL mode to "require". This is especially needed when using a managed Postgres service such as Azure Database for Postgres, which requires this option and does not let the client negotiate.
`storage.pgConnectRetries` | - | `30` | **Postgres Setting for Wicked**: The number of times the wicked API container tries to connect to Postgres before failing and quitting the process.
`storage.pgConnectDelay` | - | `2000` | **Postgres Setting for Wicked**: The delay between connect attempts (in milliseconds).
`storage.pgMaxClients` | - | `10` | **Postgres Setting for Wicked**: The maximum number of Postgres clients in the Postgres connection pool.
`storage.pgConnectTimeout` | - | `10000` | **Postgres Setting for Wicked**: The Postgres connection timeout (in milliseconds).
`storage.pgIdleTimeout` | - | `120000` | **Postgres Setting for Wicked**: The idle timeout of a Postgres connection pool connection. Specify this to be larger than 60 seconds (`60000`) for best performance and compatibility with managed Postgres services, such as AWS RDS or Azure Postgres.
`persistence.enabled` | - | `false` | **ONLY APPLIES TO JSON STORAGE TYPE**: Set to `true` to persist the dynamic data to a Persistent Volume Claim. If set to `true`, specify the volume claim below. Not important if wicked stores data in Postgres (recommended)
`persistence.existingClaim` | - | `""` | **ONLY APPLIES TO JSON STORAGE TYPE**: If you want to use pre-existing volume claim for the persistence, specify it here. Mutually exclusive with the option `persistence.storageClass` which is used for dynamic provisioning of volume claims.
`persistence.storageClass` | - | `""` | **ONLY APPLIES TO JSON STORAGE TYPE**: If your cluster supports dynamic provisioning of volumes (provision volumes for volume claims automatically), specify the storage class for the volume here. Mutually exclusive with `persistence.existingClaim` (use either).
`persistence.accessMode` | - | `ReadWriteOnce` | **ONLY APPLIES TO JSON STORAGE TYPE**: The volume is mounted to the `portal-api` container using this access mode.
`persistence.size` | - | `1Gi` | **ONLY APPLIES TO JSON STORAGE TYPE**: The size of the volume for dynamic data persistence. 1 GB is usually more than enough for this (probably also 100 MB would suffice, depending on your needs).

For a complete description, please see the [`values.yaml`](values.yaml) file itself; it contains even more information on the various options, and also information on how to set resources of all containers (if necessary).

### Example fresh installation of wicked

Create an `override.yaml` file for things which do not change in your configuration, and which are not secret, e.g. git repository and host names for portal and gateway:

```
config:
  repository: "https://github.com/yourcompany/apim-config.git"
ingress:
  portalHost: "portal.yourcompany.com"
  apiHost: "api.yourcompany.com"
  useKubeLego: true
```

Then a typical installation script would look like this, assuming it is started from the base of the cloned git repository of your static APIm configuration:

```
#!/usr/bin/env bash

set -e

# DEPLOY_ENVKEY (from deploy.envkey, created initially by the Kickstarter
# and GIT_CREDENTIALS (username:password) are assumed to be injected by
# the build system into this script (e.g. using GoCD secret env vars, or
# Jenkins credentials).

WICKED_VERSION=0.12.1
INSTALLATION_NAME=sample
NAMESPACE=default

gitCommitSha=$(git rev-parse HEAD)

# Downloads the wicked Chart into sub directory "wicked"
helm fetch --untar https://github.com/Haufe-Lexware/wicked.haufe.io/releases/download/v${WICKED_VERSION}/wicked-${WICKED_VERSION}.tgz

# Check if we have an installation by this name
if ! kubectl get deployment -n "${NAMESPACE}" ${INSTALLATION_NAME}-wicked-api; then
  echo "INFO: Fresh install of wicked.haufe.io as ${INSTALLATION_NAME}.
  helm install --name ${INSTALLATION_NAME} wicked \
      --set namespace=${NAMESPACE} \
      --set config.deployKey="${DEPLOY_ENVKEY}" \
      --set config.credentials="${GIT_CREDENTIALS}" \
      --set config.revision=${gitCommitSha} \
      --values override.yaml
else
  echo "INFO: Upgrading/refreshing configuration of wicked as ${INSTALLATION_NAME}."
  helm upgrade ${INSTALLATION_NAME} wicked \
      --set namespace=${NAMESPACE} \
      --set config.deployKey="${DEPLOY_ENVKEY}" \
      --set config.credentials="${GIT_CREDENTIALS}" \
      --set config.revision=${gitCommitSha} \
      --values override.yaml
fi

# Until helm has released https://github.com/kubernetes/helm/issues/1769, the
# post-install job has to be deleted
kubectl delete job --ignore-not-found=true -n ${NAMESPACE} ${INSTALLATION_NAME}-wicked-post-install
```

Obviously some additional tweaking can be done in regards of error handling, but this is the gist of a wicked installation works with Helm on Kubernetes. In case a release fails, you may use the `helm rollback` feature to roll back to a previous (working) deployment.

---

### Ideas (not yet implemented)

Upgrade scenarios:

* Implement checks in hooks which e.g. scale down Kong to just one instance prior to
upgrading.
* Do a dry run check of an updated static configuration prior to actually allowing the upgrade/update of the installation
