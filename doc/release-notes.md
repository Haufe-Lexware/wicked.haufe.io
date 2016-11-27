# Release Notes

Release Notes for API Portal releases in bottom-up order (latest first).

The Release Notes state changes from release to release, possibly also giving upgrade instructions. 

## 1.0.0

Official Release of the API Portal.

**Docker Tag**: tba

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
