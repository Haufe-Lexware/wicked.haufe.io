# Docker images

The API Portal is built from the ground designed to run in `docker`. While it is perfectly possible to run the different servces necessary to run the API Portal by themselves, all tooling and all documentation will be written with docker as the run time environment in mind.

Docker has various major advantages:

* The environment under which the API Portal runs is well known, as it is using a pre-built image
* Installation/deployment of the API Portal is very straightforward and it will work on any platform supporting docker (Ubuntu, RHEL, CentOS,...)
* Local deployments on developer machines are simple using the Docker Toolbox, and you can test a deployment on your local machine almost like as if it were in production

## Docker image build process

The images needed for the API Portal are built automatically by our CI/CD servers and are subsequently pushed to [docker hub](https://hub.docker.com) if all tests pass successfully.

The following images are taken as defaults for API Portal deployments, among which the following are built by us:

* `haufelexware/wicked.mashape.kong:latest`: Our Mashape Kong built, unchanged from the original
* `haufelexware/wicked.kong:latest`: The Portal's Kong image (slightly extended)
* `haufelexware/wicked.portal:latest`: The Portal UI image
* `haufelexware/wicked.portal-api:latest`: The Portal's API image
* `haufelexware/wicked.portal-kong-adapter:latest`: The Kong Adapter
* `haufelexware/wicked.portal-mailer:latest`: The API Portal's Mailer component
* `haufelexware/wicked.portal-chatbot:latest`: The API Portal's "Chatbot" component

All node.js based images are based on the official [`node:4`](https://hub.docker.com/_/node/) image (all images starting with `wicked.portal`).

The following images are not built by us, but are taken as-is:

* `postgres:9.4`: The official [Postgres 9.4](https://hub.docker.com/_/postgres/) image
* `dockercloud/haproxy:1.2.1`: Docker's official [HAproxy](https://hub.docker.com/r/dockercloud/haproxy/) release.

## Available Tags

The API Portal uses Semantic Versioning, and as such it should be safe to stay on a specific build version of the API Portal. All actual releases have their own release tags (such as `1.0.0`), but these are not mentioned here. Only meta tags and semantic release tags are described. 

* `latest`: Latest stable release; use this when setting up your deployments and/or for testing and development portals. Maps to certain releases of the `master` branch.
* `1.y`: Alias for the latest `1.y.z` release, containing all bug fixes and patches for the `1.y` version. Use such a tag if you want to be restrictive in what features you want to ship with your API Portal. Maps to a release branch names as the release. Example: `1.2` maps to all versions `1.2.z`, e.g. `1.2.5` or `1.2.7`.
* `1`: Alias for the latest Release of v1 portal; note that this may contain new features (minor version upgrades). For most purposes this tag will be okay to use.
* `dev`: The nightly build of the API Portal; this contains all current changes and may not be stable at all times. Maps directly to the `master` branch.

More tags will subsequentely be described here.

## Upgrading docker images

Please confer with the [Release Notes](release-notes.md) for upgrade instructions from one release to the next. As a main rule, according to the semantic versioning, upgrades within one major version should work without problems.

**Note**: Downgrading installations will in most cases **not** work without restoring dynamic configuration data using some disaster recovery mechanisms (redeploying using dynamic data of the same version as you are deploying). This should be common sense though.

## Building your own images

If you need to build your own docker images for use within your own organization (we do this internally as well), feel free to use (and/or adapt) the `docker-build.sh` script in this repository.

The script takes parameters in the form of the following environment variables:

* `DOCKER_PREFIX`: The prefix for your docker image; when building the official ones, this is set to `haufelexware/wicked.`, and the various package names are appended. In case you want to push to a local registry, this may be set to something similar to `registry.company.io/wicked/`, which would render image names like `registry.company.io/wicked/portal-api`.
* `DOCKER_TAG`: The tag which is to be build; this variable is mandatory, use e.g. `dev` or a similar value.
* `DOCKER_REGISTRY`: (**optional**) Use this setting to specify a private registry, or use `hub.docker.com` or `docker.io` (or leave empty) to use the official Docker hub. If this is not specified, the official Docker hub is assumed.
* `DOCKER_REGISTRY_USER`: (**optional**) Specify the registry user name here if you want to push your images after building them. If this variable is empty, the built images will not be automatically pushed.
* `DOCKER_REGISTRY_PASSWORD`: (**optional**) If you have specified a user name for the registry, also specify a password in this variable.
* `WICKED_KONG_IMAGE`: (**optional**) Specify which Kong image should be used with the API Portal; for the official builds, this is set to `haufelexware/wicked.mashape.kong:latest`; if you levae this out, it will default to Mashape's own build at `mashape/kong:latest`.
* `DOCKER_RELEASE_TAG`: The `docker-build.sh` script can also be used to tag a specific image with release tags. The `DOCKER_RELEASE_TAG` has to be in `x.y.z` format. This will only have an impact if images are pushed to a registry, otherwise it won't. It will automatically tag `x`, `x.y`, `x.y.z` and `latest` for the built images.

This script is used both for building internal images at Haufe-Lexware as well as the official images directly from Github.

## Future Changes - A note on Docker guidelines

Currently, the `docker-build.sh` is a rather bad workaround which actually breaks some of our docker rules we have at Haufe-Lexware, such as:

* One repository, one `Dockerfile`
* One build pipeline per `Dockerfile`

This will change sometime in the future, so that not all changes to the repository (such as documentation) would trigger new builds of components, and so that components can be built without the need to build all components at once.

This will mean

* Splitting up the repository into the different components
* Storing the `portal-env` and `node_modules` as artifacts when building (interesting but not very simple)
* Greater flexibility and faster build times

It will also need to have an impact on how testing is done.

**See also:**

* [Haufe Docker Styleguide](https://github.com/Haufe-Lexware/docker-style-guide)
