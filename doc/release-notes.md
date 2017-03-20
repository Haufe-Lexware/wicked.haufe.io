# Release Notes

Release Notes for API Portal releases in bottom-up order (latest first).

The Release Notes state changes from release to release, possibly also giving upgrade instructions. 

## 1.0.0

Official Release of the API Portal.

**Docker Tag**: tba

## 0.11.4 (beta)

**Date**: March 20th, 2017 (2017-03-20)

**Docker Tag**: `0.11.4`

Another minor release with two relevant changes: Firstly make sure that all calls to wicked's `portal-api` timeout quickly; this posed a a problem when e.g. running in Kubernetes, and the `portal-api` container was updated. Most depending containers check for the state of the portal API every ten seconds, and if the container is down, the call to the API will time out. The standard timeout is 120 seconds on Debian, which meant that e.g. the portal itself could hang for around two minutes before recovering. This should happen a lot faster now.

Another measure to increase deployment safety is that the portal API now checks whether the `PORTAL_CONFIG_KEY` is correctly configured. To make use of this new feature, open your static configuration once with the updated (0.11.4+) kickstarter; this will introduce a new property in the `globals.json` containing a check for the valid configuration key.

* [Deploying with faulty PORTAL_CONFIG_KEY renders strange results](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/59)
* [Portal starts slow in Kubernetes sometimes](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/57)
* [/docker-entrypoint.sh: line 7: exec: dockerize: not found on wicked.kong container](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/58)

## 0.11.3 (beta)

**Date**: February 15th, 2017 (2017-02-15)

**Docker Tag**: `0.11.3`

Minor release with two parts, running wicked as non-root inside Docker, and surfacing the Kong version and cluster information inside the system health page. Other minor things in the kickstarter, like enabling Ctrl-C for stopping it (by leveraging [`dumb-init`](https://github.com/Yelp/dumb-init) again).

* [Surface Kong version and cluster Status in System health](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/55)
* [wicked containers should not run as "root"](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/56)
* [kickstarter - volume permission problem inside container](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/53)
* Upgrade Kong to 0.9.9

Did you see our [Kubernetes Documentation](deploying-to-kubernetes.md)?

When updating, please first update the `wicked.kong` containers, then continue with the rest of the containers.

## 0.11.2 (beta)

**Date**: January 9th, 2017 (2017-01-09)

**Docker Tag**: `0.11.2`

Minor release containing some bugfixes and further a minor feature which enables redirection after login in case a user tries to open a page which renders a 403 and is not logged in.

* [Error handling in kickstarter is a bit rough](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/29)
* [The confighash does not change after only deploying a new static configuration](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/50)
* [Usability: When logged out, accessing a page should redirect back after logging in](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/51)

## 0.11.1 (beta)

**Date**: December 19th 2016 (2016-12-19)

**Docker Tag**: `0.11.1`

Very minor update just to get an annoying behaviour of the `portal-api` container out: The `portal-api` did not react to SIGTERM, and thus had to be "killed" by `docker stop` after a certain grace period. This was due to the fact that `portal-api` has a shell script as `CMD`, which gets PID 1, but does not forward the SIGTERM to the actual node process. This is now fixed by using [`dumb-init`](https://github.com/Yelp/dumb-init) in the entrypoint, which propagates signals to child processes.

Oh, coming soon: Guidance on running wicked on Kubernetes. Stay tuned on [deploying to kubernetes](deploying-to-kubernetes.md).

* [`portal-api` does not react on SIGTERM, should shut down](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/48)
* Upgrade to Kong 0.9.6

## 0.11.0 (beta)

**Date**: December 9th 2016 (2016-12-09)

**Docker Tag**: `0.11.0`

Some substantial improvements to running in production. Many small details which enable deployments to other runtime environments than a pure docker host, such as Kubernetes. All components of wicked now check their configuration status and quit (trigger restart, depending on your orchestration) whenever a configuration change is detected. This means that the different components can be treated more like individual microservices. The wicked core components (`portal`, `kong-adapter`, `mailer`, `chatbot`) will still require a version which is equal to the version the portal API (`portal-api`) is running. Anyone using a newer node SDK version for wicked is benefiting from this feature, as it's implemented in the node SDK which is used by all the core components (and also by [wicked.auth-passport](https://github.com/Haufe-Lexware/wicked.auth-passport) and [wicked.auth-saml](https://github.com/Haufe-Lexware/wicked.auth-saml))

The documentation has been updated to reflect the changes. A very notable changes is the possibility to now retrieve the configuration automatically from a git repository instead on having to clone it in and building a data-only container to mount into the portal API container. This is still possible, but the recommended way is injecting the static configuration via the [git clone method](static-config-git-clone.md).

Detailed list of changes:

**Features and Improvements:**

* Improved documentation, preparation of documentation for running in Kubernetes
* [How to read static configuration from git repository without building data only container?](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/34)
* [Let Kong Adapter, Mailer, Chatbot check for changed configuration](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/36)
* [Implement sanity check regarding versions for depending components (Mailer, Chatbot,...)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/38)

**Bugfixes:**

* [Portal doesn't reject fragment in redirect URI (#)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/35)
* [Kickstarter: Drop down boxes should be marked as such (using a » or similar)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/19)


## 0.10.1 (beta)

**Date**: November 27th 2016 (2016-11-27)

Mostly minor bug fixes and one major addition to the OAuth2 support; the Kong Adapter now also makes it easier to implement the Authorization Code Flow. Still missing is support for Scopes and persisting Scope grants, which will possibly be done over the next couple of weeks. Let's see.

Detailed list of changes:

* Move to `kong:0.9.5` as API Gateway
* [Remove standard configuration of `file-log` plugin for new APIs](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/32)
* [Support mutual SSL by making the used proxy certificate configurable](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/13)
* [For new projects, the default value for `PORTAL_CHATBOT_URL` was wrong](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/31)
* [wicked 0.10.0 did not start without an `auth-servers` directory (introduced by calling kickstarter once)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/30)
* [Make it less difficult to create new multi-line environment variables](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/33)

**Docker Tag**: `0.10.1`


## 0.10.0 (beta)

**Date**: November 7th 2016 (2016-11-07)

**Docker Tag**: `0.10.0`

Quite some features under the hood for this release. You will still be able to simply upgrade from any configuration version to version 0.10.0 without any changes to your configuration. It is recommended to start the new Kickstarter once with your previous configuration to see which changes are done automatically.

Detailed list of changes:

* [Display version information of components on system health page](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/7)
* [Support for the OAuth 2.0 Implicit Grant Flow](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/14)
* [Support for the OAuth 2.0 Resource Owner Password Grant Flow](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/28)
* Bugfix: [Github login fails if user does not have a display name](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/22)
* [Integration tests for Kong and Kong Adapter](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/15)
* [Upgrade to Kong 0.9.4 as a standard API Gateway](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/16)
* [Feature: API Lifecycle support (deprecating, deleting all subscriptions)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/26)

## 0.9.3 (beta)

**Date**: October 14th (2016-10-14)

**Docker Tag**: `0.9.2`

* Integration tests in docker can now be run locally in a much simpler way
* Fixed issue #18 (sending mails fails if user has been deleted in the meantime)

## 0.9.2 (beta)

**Date**: September 14th (2016-09-14)

**Docker Tag**: `0.9.2`

* Developer Experience: Make setup of development environment a lot easier (Haufe-Lexware/wicked.haufe.io#5)
* Enhancement: Allow (recursive) environment variables in `PORTAL_API_DYNAMIC_CONFIG` and `PORTAL_API_STATIC_CONFIG`.
* Work on documentation

## 0.9.1 (beta)

**Date**: August 12th 2016 (2016-08-12)

**Docker Tag** `0.9.1`

* Internal refactoring of git repositories (one repository per service now)
* Work on documentation
* Extended Kickstarter to be able to write `docker-compose.yml` and `Dockerfile` for the static config
* Experimental SSL helper page in Kickstarter
* No new features in Portal

## 0.9.0 (beta)

**Date**: August 3rd 2016 (2016-08-03)

**Docker Tag** `0.9.0`
