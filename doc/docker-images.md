# Docker images

The API Portal is built from the ground designed to run in `docker`. While it is perfectly possible to run the different servces necessary to run the API Portal by themselves, all tooling and all documentation will be written with docker as the run time environment in mind.

Docker has various major advantages:

* The environment under which the API Portal runs is well known, as it is using a pre-built image
* Installation/deployment of the API Portal is very straightforward and it will work on any platform supporting docker (Ubuntu, RHEL, CentOS,...)
* Local deployments on developer machines are simple using the Docker Toolbox, and you can test a deployment on your local machine almost like as if it were in production

## Docker image build process

The images needed for the API Portal are built automatically by our CI/CD servers and are subsequently pushed to [docker hub](https://hub.docker.com) if all tests pass successfully.

The following images are taken as defaults for API Portal deployments, among which the following are built by us:

* `haufelexware/wicked.kong:latest`: The Portal's Kong image (using the official Kong image as a base, slightly extended)
* `haufelexware/wicked.portal:latest`: The Portal UI image
* `haufelexware/wicked.portal-api:latest`: The Portal's API image
* `haufelexware/wicked.portal-kong-adapter:latest`: The Kong Adapter
* `haufelexware/wicked.portal-mailer:latest`: The API Portal's Mailer component
* `haufelexware/wicked.portal-chatbot:latest`: The API Portal's "Chatbot" component

All node.js based images are based on the official [`node:4`](https://hub.docker.com/_/node/) image (all images starting with `wicked.portal`).

The following images are not built by us, but are taken as-is:

* `kong:0.9.3`
* `postgres:9.4`: The official [Postgres 9.4](https://hub.docker.com/_/postgres/) image
* `dockercloud/haproxy:1.5.3`: Docker's official [HAproxy](https://hub.docker.com/r/dockercloud/haproxy/) release.

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
