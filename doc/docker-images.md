# Docker images

The API Portal is built from the ground designed to run in `docker`. While it is perfectly possible to run the different servces necessary to run the API Portal by themselves, all tooling and all documentation will be written with docker as the run time environment in mind.

Docker has various major advantages:

* The environment under which the API Portal runs is well known, as it is using a pre-built image
* Installation/deployment of the API Portal is very straightforward and it will work on any platform supporting docker (Ubuntu, RHEL, CentOS, orchestration solutions such as Kubernetes, GCE, Mesos,...)
* Local deployments on developer machines are simple using the Docker Toolbox, and you can test a deployment on your local machine almost like as if it were in production (if deploying using `docker-compose` to production)

## Docker image build process

The images needed for the API Portal are built automatically by our CI/CD servers and are subsequently pushed to [docker hub](https://hub.docker.com) if all tests pass successfully.

The following images are taken as defaults for API Portal deployments, among which the following are built by us:

* `haufelexware/wicked.kong:<version>`: The Portal's Kong image (using the official Kong image as a base, slightly extended)
* `haufelexware/wicked.ui:<version>`: The Portal UI image
* `haufelexware/wicked.api:<version>`: The Portal's API image
* `haufelexware/wicked.auth:<version>`: The Authorization Server image
* `haufelexware/wicked.kong-adapter:<version>`: The Kong Adapter
* `haufelexware/wicked.mailer:<version>`: The API Portal's Mailer component
* `haufelexware/wicked.chatbot:<version>`: The API Portal's "Chatbot" component
* `haufelexware/wicked.k8s-init:<version>`: [Kubernetes init container](../src/k8s-init)
* `haufelexware/wicked.k8s-tool:<version>`: [Kubernetes tooling container](../src/k8s-tool)

All node.js based images are based on the official [`node:10`](https://hub.docker.com/_/node/) or `node:10-alpine` images (all images starting with `wicked.portal`).

The following images are not built by us, but are taken as-is:

* `postgres:9.6`: The official [Postgres 9.6](https://hub.docker.com/_/postgres/) image
* `redis:5-alpine`: The official [Redis](https://hub.docker.com/_/redis) redis; this is used for session storage and rate limiting caching
* `dockercloud/haproxy:1.6.7`: Docker's official [HAproxy](https://hub.docker.com/r/dockercloud/haproxy/) release.

## Available Tags

The API Portal uses Semantic Versioning, and as such it should be safe to stay on a specific build version of the API Portal. All actual releases have their own release tags (such as `1.0.0`), but these are not mentioned here. Only meta tags and semantic release tags are described. 

* `latest`: Latest stable release; use this when setting up your deployments and/or for testing and development portals. Maps to certain releases of the `master` branch.
* `1.y`: Alias for the latest `1.y.z` release, containing all bug fixes and patches for the `1.y` version. Use such a tag if you want to be restrictive in what features you want to ship with your API Portal. Maps to a release branch names as the release. Example: `1.2` maps to all versions `1.2.z`, e.g. `1.2.5` or `1.2.7`.
* `1`: Alias for the latest Release of v1 portal; note that this may contain new features (minor version upgrades).
* `next`: The CI build of the API Portal's next branch (usually this is `next`); this contains all current changes and may not be stable at all times. The wicked Demo portal usually runs on this release, as soon as all integration tests pass.

More tags will subsequentely be described here.

## Upgrading docker images

Please confer with the [Release Notes](release-notes.md) for upgrade instructions from one release to the next. As a main rule, according to the semantic versioning, upgrades within one major version should work without problems.

**Note**: Downgrading installations will in most cases **not** work without restoring dynamic configuration data using some disaster recovery mechanisms (redeploying using dynamic data of the same version as you are deploying). This should be common sense though.

Equally true is that working with the kickstarter of a later version than the portal version you are deploying will result in a bad configuration, as the API Portal will not be able to handle the configuration intended for a later version of the API Portal.

**See also:**

* [Haufe Docker Styleguide](https://github.com/Haufe-Lexware/docker-style-guide)

## Environment Variables available for use with the Docker images

There are some special environment variables which can be used to change/specify the behavior of the different docker images. These are described in detail in this section. This mostly applies to the portal API container (`haufelexware/wicked.portal-api`), as most configuration is done via this container and its `globals.json` file.

### `api`

* `NODE_ENV`: The most important environment variable; the content of this variable decides which [environment](deployment-environments.md) is to be used, i.e. which set of internal environment variables should be used.
* `PORTAL_CONFIG_KEY`: This has to contain the configuration key created when creating your static configuration repository. This is a secret which should be injected using appropriate measures, such as an environment variable when deploying via `docker-compose`, or a "secret" when deploying using Kubernetes. Without this secret key, the encrypted environment variables inside the environment settings cannot be decrypted, and importing and exporting will fail.
* `GIT_REPO`: The git repository (without username, password and `https://`) to clone the static configuration repository from. If this environment variable is empty, `portal-api` assumes that the `/var/portal-api/static` directory is prepopulated, e.g. using a docker volume (see also [deployment architecture](deployment-architecture.md) for a note on the difference between the git clone and docker volume approach the static configuration)
* `GIT_CREDENTIALS`: The credentials (`username:password`) to pass in to the `git clone` command at startup of the container; if this is not set, the portal API container assumes that it can access the git repository without credentials (i.e. that it's a public repository)
* `GIT_BRANCH`: The branch to check out/clone at startup of the portal API container. If this is not set/is empty, `master` is assumed.
* `DEBUG`: The specification of debug message sources to be output. Use `portal-api:*` to output debug messages from the portal API itself. Use `*` to output **all** debug messages of all packages used in the portal API. Note that this can become **very** verbose (up to such an extent that it may have impact on performance). To see specific debug messages, inspect the source code of the `portal-api` to see which debug scopes are available (`require('debug')('portal-api:asdfg')`). Please also note that secrets and credentials (including passwords of users) MAY be exposed in the logs when specifying a very verbose debug logging. **So take care with the logs**.
* `LOG_LEVEL`: Specify the debug message log level using this environment variable. Use either `debug` to get **all** debug messages, or one of `info`, `warn` and `error`. Defaults to `info`.

**Note**: Currently, regardless of the branch selected with `GIT_BRANCH`, the `HEAD` is checked out. In the next versions, `GIT_REVISION` may be introduced to support cloning a specific version of the git repository.

**Note**: Passing in any other environment variable from the "outside" which is part of the environment variables of the environment definitions (i.e. which is inside the `default.json` file) will cause this variable to be overridden. Doing this for other environment variables than the ones above (which are not part of `default.json`) will inevitably make things very difficult to understand though.

### `ui`, `mailer`, `kong-adapter`, `chatbot`

These four core components can only be impacted using two different environment variables:

* `PORTAL_API_URL`: Pass in the URL of the `api` API in case this is not the standard `http://portal-api:3001` URL. If this environment variable is empty, this is what is going to be tested. In case you are deploying using `docker-compose`, this is usually the correct address, and also when deploying using e.g. Kubernetes, there will be a service which is discoverable using this DNS address, so this will be correct in most cases. In case it's not, use this variable to bootstrap the configuration process. When using the [Kubernetes Helm chart](../wicked/README.md), the services are named slightly different, also depending on the helm deployment name, but if you use the predefined `k8s` environment in the static configuration, things should "just work".
* `LOG_LEVEL`: Specify the debug message log level using this environment variable. Use either `debug` to get **all** debug messages, or one of `info`, `warn` and `error`. Defaults to `info`.

### `kong`

The `haufelexware/wicked.kong` container supports the following environment variables for tweaking its behavior:

* `KONG_DATABASE_SERVICE_HOST`: In case this variable is set, this will override the underlying `KONG_PG_HOST`. This can be used to circumvent the Kubernetes service discovery with Kong to resolve to an IP address for the Postgres database; in some situations, Kubernetes and Kong do not quite agree on name resolution...

In addition to these, all Kong environment variables can be used to tweak behavior. See the [official Kong documentation](https://getkong.org/docs/0.9.x/configuration/) for an overview. Usually, it is not necessary to change any of the standard settings.
