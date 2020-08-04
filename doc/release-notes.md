# Release Notes

Release Notes for API Portal releases in bottom-up order (latest first).

The Release Notes state changes from release to release, possibly also giving upgrade instructions. 

## 1.0.0

Official Release of the API Portal.

**Docker Tag**: tba

[Design documents](https://github.com/Haufe-Lexware/wicked.haufe.io/tree/next/doc/design-docs).

## 1.0.0 (release candidates)

### 1.0.0-rc.14 - Notable changes

**Maintenance release**

Some fixes. Enabling deployments via Helm chart to Rancher k3s.

* [Deployment on k3s not working (containerd runtime)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/272)

### 1.0.0-rc.13 - Notable changes

Motto: **Minor fixes**

This release fixes an issue with the email verification mails in case the email verification was not done immediately with the registration in the portal. The link in the profile page pointed to a faulty URL. In addition, a small enhancement was done to the Helm chart in order to make it easier to suppress the Kong outbound headers (such as `Via` or other Kong related headers).

* [Kong headers](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/266)
* [E-Mail validation link wrong in user profile (portal)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/268)

### 1.0.0-rc.12 - Notable changes

Motto: **Multiple Routes support and Bugfixes**

In this release, a long prepared feature has made its way into the code: Support for multiple routes per API definition. This enables you to create multiple routes (paths) into your API, and defining e.g. which http verbs are allowed to pass in to which routes. Another very nice feature (courtesy of our contributors at Clarivate Analytics) is the addition of an "Audit Log" - it contains information on actions on subscriptions and applications, so that actions which were performed during the last 365 can be both viewed and retrieved as a CSV file.

**IMPORTANT**: As this change requires a different wiring of the APIs, service definitions and route definitions within the Kong gateway, please read the following notes carefully before updating your installation of wicked/Kong:

* **Do not** attempt to create a new deployment (e.g. in a new cluster) which shares the same database as the previous installation; this will lead to the previous installation rendered non-functional, as the Kong configuration is different, and e.g. the Kong Adapter instances will try to overwrite each other, creating a possible downtime
* **Do** run an in-situ update of your installation; this means that for a Kubernetes deployment, you may simply update the Helm chart. When the update has finished, the old versions of the containers are stopped
* **Do** back up both the wicked and Kong databases prior to running your update
* **Do** run a test update on a non-production environment prior to running the update on the production environment, so that you know that your update runs through without problems

In case you experience issues, please restart the Kong Adapter container after upgrading; it will re-initialize Kong again, making sure that the Kong configuration is up to date. This is not expected to be necessary, but in case you experience issues - try this first.

Another main topic for this release was improving the upgrading experience and making it more stable. Cross-version upgrades (in-situ upgrades) should now be more stable, and over all work better; see below for more details on the problems that have (hopefully) been resolved.

In detail, the following issues were addressed: 

* [SAML2 silent refresh (OAuth2 with &prompt=none) fails](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/259)
* [API crashes if it could not connect immediately to Postgres](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/251)
* [Support for k8s 1.16.x](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/250) (Helm Charts)
* [Audit log for changes via the API](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/248)
* [Provoking HTTP-500-errors when operating 1.0.0-rc.9 parallel with 1.0.0-rc.11](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/242)
* ["Download as CSV" reflective of applied filters](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/239)
* [Wrong Postgres host picked up by Kong](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/238)
* [Two instances of wicked using same database are killing each other](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/190)
* [Support multiple routes per API/service definition](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/168)

A big shoutout to

* mlkiharev
* santokhsingh
* MibenCoop

### 1.0.0-rc.11 - Notable changes

Motto: **Monorepo, monorepo, cha cha cha**

This release does not have a lot of functional changes per se, but there is a really big change under the hood - the structure of the wicked source code had become really difficult to maintain, and so we decided to go monorepo for the source code instead of having the source code split out in several different repositories. This has only some drawbacks (builds are always triggering a build of all container images), but a lot of advantages, such as: Pull Requests can contain all needed changes, including changes to the `env` and `node-sdk` repositories, and of course also containing changes to the test suite. In total, this makes working with pull requests a lot easier, and it also makes it easier for contributors to keep up to date with the latest `next` branch of wicked, as you now only have to merge/update a single repository. The development setup has also improved (we hope!) substantially, making it a lot easier to get up to speed in the development of wicked. Please review the new and updated [development setup guide](../src/tools/development/README.md).

* [OAuth2: Wicked should optionally forward state to external IdP](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/232)

### 1.0.0-rc.10 - Notable changes

Motto: **Some new features and enhancements**

The latest releases have been very stable, and thus there has not been many emergency fixes to do in the last three months. On the other hand, quite some things have been going on under the hood which are now ready to be released. Further, we have seen some issues with managed Postgres services which are a little picky how you establish and tear down Postgres connections; there is now a way to influence that a little bit better, plus the Prometheus metrics with regard to this have been improved.

Contributions by:

* [Iblis](https://github.com/Iblis)
* [MibenCoop](https://github.com/MibenCoop)
* [santokhsingh](https://github.com/santokhsingh)
* [Jabb0](https://github.com/Jabb0)
* [DonMartin76](https://github.com/DonMartin76)

Thank you so much!

Here are the changes in detail:

* [Approver rights currently superseding Admin rights](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/225)
* [kickstarter throws error when swagger longer than limit](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/217)
* [Support for Microsoft Teams in the Chatbot](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/213)
* [Approver Permission to view application details](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/226)
* [SamlAuth: Can't build profile if User attribute names are uris](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/221)
* [Add possibility to influence Postgres Pool parameters](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/231)
* [AuthServer Configuration: Hyphen in auth method name causes login issues](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/222)

### 1.0.0-rc.9 - Notable changes

**Bugfixes**

The following bugs were fixed:

* [Chrome/FireFox: wicked UI does not accept any redirect URIs with custom schemes](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/215)
* [PKCE extension expects non-base64-urlencoded code_verifier/code_challenge](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/219)
* [Migration code fails with "loadApis() not allowed"](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/216)


### 1.0.0-rc.8 - Notable changes

Motto: **Finally, LDAP Support**

LDAP support has been something that we have wanted for a long time in wicked, both for authentication and authorization for logging in to the portal, and also to enable LDAP interactive login to secure API support (which is, in the end, the same thing; wicked's API uses its own API Gateway to secure the traffic to the wicked API). Finally it has been implemented, and we hope that most use cases are covered by the existing functionality. See also the documentation on the [LDAP Auth Method](auth-ldap.md).

Another significant fix to wicked running on Kubernetes was implemented - at configuration reloads via the UI, wicked no longer actually quits the running containers, but just restarts the node.js process inside the containers. This is a lot quicker, usually the portal is completely back up again within seconds. If you then choose to run at least two instances of the API container, this should be very very close to a zweo-downtime deployment of new configurations (2-5 second disruption of portal UI and auth server).

* [LDAP Support](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/126)
* [How to configure LDAP for wicked portal](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/211)
* [Reloading configuration still takes unnecessarily long](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/212)
* [Support displaying different host in API documentation](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/214)

### 1.0.0-rc.7 - Notable changes

Motto: **OAuth2 leftovers**

Thanks to a contribution, wicked now also supports retrieving profile information from `user_info` type endpoints (OIDC style); this was unfortunately already surfaced in the Kickstarter, but it wasn't actually implemented. A big thank you to [Philipp Walser](https://github.com/Iblis) for this contribution. Additionally, a bug concerning protected auth methods were fixed, so that these, even if they are allowed to be used for logging in to the API portal, are not by default displayed in the Login mask. [The documentation has been updated](auth-methods.md#protected-auth-methods).

* [ProfileEndpoint for wicked.auth not implemented yet?](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/208)
* [Protected auth methods are displayed in the public login page of wicked itself](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/210)

### 1.0.0-rc.6 - Notable changes

Motto: **Some bug fixing**

Over the last couple of weeks of testing, some minor things have emerged which are being addressed in this release. In the meantime, we are also working hard on extended/extensive support for the routes and services concept in Kong 1.0.0+, but that is not yet quite ready for prime time, as we also want to bundle that with an update to the latest Kong version, but Kong still has an incompatibility with its old API which has to be addressed first.

* [Rejected logins via external scope validations do not redirect back to client](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/197)
* [Protected auth methods are exposed in the /apis/.../swagger endpoint](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/198)
* [Unable to create Redirect URIs using local domains](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/196)
* [wicked.box startup race condition ("Timeout")](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/202)
* [Custom Content does not allow loading of Javascript](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/201)

### 1.0.0-rc.5 - Notable changes

Motto: **Even nicer OAuth2.0 support**

In the RC5, we fixed two issues which are more "enhancements" than bug fixes. The OAuth2 password grant can now also delegate to an upstream identity provider, and it uses the correct (or: the spec'ed) content type for the token request. The second thing we implemented is that we now support the `prompt=none` parameter also when there is no session with the wicked Authorization Server anymore. This means that with upstream identity providers which support it, SPAs can now also get a refreshed authorization code (with the authorization code grant) or a refreshed token (with the implicit grant) even if the authorization server session has expired. Typical use cases would be enable a more seamless login/refresh experience for identity providers which support a "remember me" type of feature. Supported identity provider types are "OAuth2", "Google" and (yes!) SAML2.

* [Better support for prompt=none with external IdPs](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/194)
* [OAuth2 password grant payload must be posted using Content type "x-www-form-urlencoded"](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/195)

### 1.0.0-rc.4 - Notable changes

Motto: **Two of the last pending features, and detail changes**

In the RC4 we have two very notable features coming up, implemented by [santokhsingh](https://github.com/santokhsingh) and [maksimlikharev](https://github.com/maksimlikharev) (**thank you!!**): There is now, for Administrators and API Approvers, a new admin page to review all current subscriptions in the system, including the possibility to download those as a CSV file. As an additional new feature, a possibility to have "No auth" (or "Public") APIs was added; you can now create APIs which do not require authentication, but which still can include features like CORS or rate limiting (powered by Kong).

* [Audit Report or All subscriptions page for administrators and approvers](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/176)
* [Allow no-key access/Public APIs/auth-type "none"](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/96)

Additionally, the following changes were made and bugs fixed:

* [JSON circular reference in debug statement: wicked.auth](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/188)
* [websocket cosmetic issue in dev portal](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/177)
* [Restart time unnecessary long (config reload)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/191)
* [Two instances of wicked using same database are killing each other](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/190)

### 1.0.0-rc.3 - Notable changes

Regression bug fix:

* [Some applications' redirect URIs aren't correctly retrieved after update to rc2](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/186)

### 1.0.0-rc.2 - Notable changes

Motto: **Small enhancements and detail fixes**

The biggest change for the new RC2 is definitely the ability of wicked to now support more than a single redirect URI for registered applications. This makes implementing silent refreshs in the case of browser based applications (so-called SPAs) a lot easier, as it enbales you to have one callback for the "first login", and a second callback which you can use for "refresh callbacks". The latter can be a lot less complicated (actually usually just a `postMessage` to the parent window).

The other changes are mostly bug fixes of various kinds, mostly related to either the new wicked CLI, or OAuth 2.0 flows. Further, some code cleanup activities have taken place; these come from the use of SonarQube on the code base, and some edge cases were found and addressed.

Here's the detailed list:

* [[Kickstarter] Allow association of APIs to Auth Methods on Auth Server config page](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/171) (enhancement)
* [Some Auth Methods should not be visible to all users](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/172) (enhancement)
* [Auth Server does not issue error for prompt=none when not logged in as redirect](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/181)
* [wicked should support multiple redirect_uris for OAuth2 applications](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/178) (enhancement)
* ["wicked box start" does not work with Postgres running on custom port](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/182)
* [Swagger UI application should be pre-defined as a confidential client](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/174)
* [Support "forgot password" URL for external auth method](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/185)

We are still working on the "All Subscriptions" list where API portal managers can review and download all subscriptions to the APIs in the portal. This will land in one of the next release candidates.

### 1.0.0-rc.1 - Notable changes

Motto: **"We're getting nearer!"**

Since the last beta release, every code change for the `wicked_1_0` branch has been merged to `next`, and now for the first release candidate (of which we admit we know it won't be the last) also subsequently merged to the `master` branch.

This first RC release deals to a large extent with changes to make the process of setting up a working wicked.haufe.io configuration locally as easy as possible, by introducing **wicked-in-a-box**. Wicked in a box is a single container image which contains everything wicked needs to run, but in a single container. The only thing which is not present in the container is the Postgres database, which has to run alongside in a separate container. This mostly to enable easier persistence of the data, e.g. for local development environments containing wicked as an infrastructure component. You can read more on ["wicked-in-a-box" here](wicked-in-a-box.md).

Another very important and security relevant change is the introduction of more detailed client types. Previously, wicked only distinguished between "public" and "confidential" clients. To be able to implement the OAuth2.0 security guidelines published by the IETF, a more granular distinction is necessary: The "public" type is now split into "Public SPA (Single Page Applications", aka "browser based applications", and "Public Native" applications, such as iOS and Android applications. There are some crucial differences in how the Authorization Code Grant has to be handled for these types of clients, notably that for Public SPAs the Authorization Code Grant is allowed, but it does **not return a refresh token**. For Public Native Applications, a **refresh token is returned**. Both public clients (as before) require the [implementation of PKCE](https://tools.ietf.org/html/rfc7636) (Proof Key of Code Exchange) for the Authorization Server to allow the Authorization Code Grant with such clients.

A last notable change is the implementation of a ["Configuration Reload" button](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/162). Reloading the configuration of a wicked installation usually meant either killing wicked's `api` container (on Kubernetes) or doing a full redeployment (e.g. on a docker host). In those cases where you just need an update of the configuration (in git), there is now a button to remote-restart the API container, which subsequently restarts all other components, so that the new configuration is pulled in. Only Admin users of the API portal can see this button on the "System Health" page.

Here's a more detailed list of resolved issues:

* [Kong Adapter "latest commit" not displayed on "System Health" page](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/147)
* [Auth Server is not present on "System Health" page](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/146)
* [Help pages on OAuth2 are not quite up to date, plus have minor bugs](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/157)
* [Distinction between SPAs, Native Apps and Confidential Clients needed](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/159)
* [Reload Configuration button](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/162)
* [Make local deployments easier with "wicked-in-a-box"](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/161)
* [Local test deployment unable to get token](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/149) (fixed as a side effect of wicked-in-a-box).
* [Kubernetes Helm Chart: It should be possible to change Postgres connection of wicked's API](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/167)

The documentation has beeen and will be further updated over the course of the next days and weeks.

## 1.0.0 (beta versions)

There will be various beta versions of the wicked 1.0.0 release, until we decide to release the final 1.0.0 version (and then resume to using 1.0.x updates).

Only for very notable changes, there will be a note here, otherwise the changes are too numerous to be listed one by one (just yet). That is also going to be resumed when 1.0.0 has been released.

### 1.0.0.beta12 - Notable changes

Mostly bug fixes from the usage of wicked 1.0.0 beta in production situations; only minor features were implemented, as currently the feature set for wicked 1.0.0 has mostly been finalized (there will also be an auditing type of feature in one of the upcoming releases). Nonetheless, here is a change log:

* SAML Identity Provider now also heeds `prompt=login` request (forces `force_authn`)
* [apim-certs.yaml prevents successful `helm upgrade`](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/152)
* [Wicked 1.0.0 portal-auth docker container can't resolve Portal and API hosts](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/150)
* [Application description is susceptible to XSS attack](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/145)
* [Access tokens can be refreshed even if Resource Owner has revoked grants to client application](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/130)
* [Migrating from wicked 0.12.x to 1.0.0 results in leftover "api" objects in Kong database](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/140)
* [Authorization Server returns 500 if an invalid Authorization Code is used when requesting the Token](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/131)
* [redirect_uri must be treated as optional](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/143)
* [Feature: Restrict scopes per subscription](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/138)
* [Trusted applications always get full scope of API even if requesting subset](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/132)
* [ADFS/OAuth2 JWT Groups aren't refreshed when logging in](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/142)
* [Creating new local users interactively crashes portal-auth under certain circumstances](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/135)
* [Auth Server answers /authorize request with JSON if client_id is invalid](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/137)
* [DEBUG value in chart](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/133)
* [Link "Sign up" on main page of standard configuration leads to a 404](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/136)

### 1.0.0.beta11 - Notable changes

Bugfixes and an additional auth method, `external`, for integration with existing username/password databases. This enables wicked.haufe.io to support the full OAuth2 experience with a legacy username/password database via a very lightweight type of integration.

* [When using passthrough users and passthrough scopes, refresh token grant fails if API does not allow password grant](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/127)
* [Support for validating 3rd party username/password](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/128)
* [Renaming auth methods in the Kickstarter makes it behave strangely](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/125)

### 1.0.0.beta10 - Notable changes

Bugfixes.

* Migration script (0.12.x --> 1.0.0) inadvertently always dropped the `wicked` database, and not the configured one
* [SAML Logout not working](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/124) fixed
* [Renaming auth methods in the Kickstarter makes it behave strangely](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/125) fixed
* Corner cases in the Helm Chart fixed (e.g. when not deploying Mailer and/or Chatbot)

### 1.0.0.beta9 - Notable changes

Bugfixes, minor features and changes:

* Refresh Token TTLs can now be configured on OAuth2 enabled APIs
* The wicked API is now served as `/wicked/v1` (instead of the too generic sounding `/api/v1`)
* The echo API is now served as `/wicked-echo/v1`
* The legacy health API was removed (this is possibly a BREAKING change in case you have subscriptions to this API).
* Improved email validity checking (according to RFC 5322), both backend and frontend (`portal-api` and `portal-auth`), #122
* Add configuration option to have different URL bases for Kong Admin and Proxy APIs, #122
* Fixed regression bug #121, migration scripts were crashing
* Improved stability of Kong Adapter with slow Postgres servers

### 1.0.0.beta8 - Notable changes

Minor bugfixes.

### 1.0.0.beta7 - Notable changes

Some really exciting changes this time:

* Support for the OAuth 2.0 Authorization Code Grant for Public clients, using PKCE ([RFC 7636](https://tools.ietf.org/html/rfc7636))
* Accompanying PKCE, wicked now accepts Redirect URIs containing custom schemes, such as `mycoolapp://dummy/some_path`; this enables implementing [RFC 8252](https://tools.ietf.org/html/rfc8252)
* Various bug fixes in the Kickstarter (ADFS Resource was missing)

### 1.0.0.beta6 - Notable changes

Minor features, and some bug fixes.

* Support for four (4) different password validation strategies; use in Kickstarter, Portal API, Auth Server and Portal
* Support for enforcing a password change when using Authorization Code and Implicit flows
* Some more edge cases regarding postgres connection fixed
* Read Swagger UI CSS via `/content` API, support for Mustache templates in CSS files (to get `portalUrl` and `apiUrl` in)
* Increased security of Auth Server using more elaborate CSRF checks

### 1.0.0.beta5 - Notable changes

Bugfixes.

* Fix of the OpenAPI compliant swagger files in Swagger UI (weren't working)
* Support for multiple URIs with OpenAPI3 compliant API docs
* Fix of the "View Swagger UI" button for APIs not requiring authentication (was broken)
* Fix of "Log in as existing user" from the "Sign up" screen, was using the wrong link

Known issues: With flaky Postgres connections, portal-api still sometimes crashes (very rarely now though). Will be addressed in the next Beta hopefully.

### 1.0.0.beta4 - Notable changes

Mainly stability and regression fixes.

* Fix of the refresh token grant (regression from beta3 regarding the `sub=<user id>` change)
* Fix [portal-api crashes if connection to Postgres times out](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/119)
* Various stability issues fixed, especially on flaky connections; wicked SDK now retries on 5xx responses or hard connection errors automatically
* [Postgres database for wicked data is now configurable](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/118)
* Implementation of missing bits and pieces for "Passthrough Users" and "Passthrough Scopes" for delegation of scopes to a different resource owner (documentation in the `wicked_1_0` branch of this repository).
* Fixed integration test suite (adapt to changes of beta3).
* Fixed authorization server test suite (adapt to changes of beta3).
* Update to latest Kong 0.14.1

### 1.0.0.beta3 - Notable changes

* Changes to format of `X-Authenticated-UserId`; now includes `sub=<user id>` instead of just `<user id>`; for APIs needing namespaces, `;namespace=<namespace>` is also added.
* Updated Swagger UI to 3.18.2, including better error messages from the Authorization Server
* Fixed Echo Server for Kubernetes deployments (missing port 3009 in portal API service definition)

### 1.0.0.beta2 - Notable changes

* Fixed Kubernetes Helm Chart (faulty service definitions)

## 0.12.5 (beta)

**Date**: April 27th 2018 (2018-04-27)

**Docker Tag**: `0.12.5`(`-alpine`)

### Content

* API Tags and Tag filtering (@santokhsingh and @maksimlikharev. **Thanks**!)
* [Approver Group/Roles](defining-user-groups-approver-role.md) (@santokhsingh and @maksimlikharev. **Thanks**!)
* Various UI fixes and improvements (@cjschweigart, **Thanks**!)
* Kong 0.11.2 Upgrade
* [Bug: portal-api-deployment.yaml (helm deployment)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/104)
* [Missing service in Helm Chart](https://github.com/Haufe-Lexware/wicked.haufe.io/pull/105) (@ulrichhamann, **Thanks**!)
* Various build fixes and release tooling improvements
* Bumped to `node:8[-alpine]`
* The Docker images `haufelexware/wicked.k8s-init` and `haufelexware/wicked.k8s-tool` are now versioned and can be pulled just like all other images; the only difference being that these do not have a dedicated `-alpine` image, they are small as is

Remarks: We have not yet done the transition to Kong 0.12 or 0.13, as there are several breaking changes in the Kong API. We are currently looking into it, and it's on the roadmap for one of the next releases.

This release should be compatible with the 0.12.4 release, so upgrading to this release should be straightforward. As usual, it's advisable to re-initialize your Postgres database (wipe it) and let Kong and the Kong Adapter reinitialize it.

### Contributors

* @santokhsingh
* @maksimlikharev
* @donmartin76
* @ulrichhamann
* @saromba

## 0.12.4 (beta)

**Date**: January 13th 2018 (2018-01-13)

**Docker Tag**: `0.12.4`(`-alpine`)

### Content

Regression bugfix release. Sorry for the inconvenience.

* [Regression: the host property of the swagger.json is not properly overwritten](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/99)

## 0.12.3 (beta)

**Date**: January 12th 2018 (2018-01-12)

**Docker Tag**: `0.12.3`(`-alpine`)

### Content

Bugfixes, and a couple of features, contributed by @santokhsingh and @maksimlikharev. **Thanks**! (Sorry it took so long to merge your PRs).

* Feature: [It should be possible to retrieve the Swagger information from a service endpoint](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/98)
* Feature: [Kong container should use Kong's logging features to stdout and stderr](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/91)
* Bugfix: [makeHealthEntry fails in portal-api if external apiHost points to other location](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/95)
* Feature: [Generic OAuth2 support for logging in to the Portal](https://github.com/apim-haufe-io/wicked.portal/pull/11)
* Feature (Kickstarter): [AWS Lambda configuration support (Kong plugin)](https://github.com/apim-haufe-io/wicked.portal-kickstarter/pull/14)
* Feature (Kong Adapter/Kickstarter): [Kong Adapter support for ignoring a list of plugins](https://github.com/apim-haufe-io/wicked.portal-kickstarter/pull/15)
* Bugfix (Kickstarter): [Fixed issue with `strip_uri` for Authorization Servers](https://github.com/apim-haufe-io/wicked.portal-kickstarter/pull/20) 

### Contributors

* @santokhsingh
* @maksimlikharev
* @donmartin76

## 0.12.2 (beta)

**Date**: November 27th, 2017 (2017-11-27)

**Docker Tag**: `0.12.2`(`-alpine`)

### Content

Bugfixes.

* [500 response when taking redis as session store](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/89)
* [Failing kong adapter due to "config.origin" error 400](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/90)
* [If user is logged in, the email validation does not have immediate effect](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/88)
* Fix of Kickstarter removing the `strip_uri` flag if set to `false`, cause a faulty behavior of Kong (which defaults to `true`)

### Contributors

* @donmartin76
* @santokhsingh

## 0.12.1 (beta)

**Date**: September 25th, 2017 (2017-09-25)

**Docker Tag**: `0.12.1`

### Content

This release is dedicated to the Kubernetes Helm Chart adaptions. The kickstarter now by default creates an environment `k8s` which is adapted for use with the new Helm Chart, which can be found in the [wicked.haufe.io/wicked](https://github.com/Haufe-Lexware/wicked.haufe.io/tree/next/wicked) repository. The Helm chart is now the default and recommended way to run wicked on Kubernetes; it has a lot of things already built in, like liveness and readiness probes, plus handling Kong updates correctly. Please give it a shot on a non-production environment and feedback, it would be much appreciated.

* [Helm charts for wicked (for easier use in Kubernetes)](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/64)

Additionally, the micro site [wicked.haufe.io](http://wicked.haufe.io) was updated to reflect these changes/additions.

### Contributors

* @donmartin76

## 0.12.0 (beta)

**Date**: September 17th, 2017 (2017-09-17)

**Docker Tag**: `0.12.0`

### Content

It has been a while since the last wicked update, and this release gets you a couple of things which have been asked for since a while, most notably the following issues have been resolved, which are in part internal, in part with external impact:

* [Support Kong 0.11.0](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/74)
* [Provide support for Redis as session store for portal-ui](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/83)
* [Move to Jenkins as a CI tool](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/86)
* [x-forwarded-proto set incorrect on outgoing API calls](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/23)

This time, upgrading is not 100% as easy as usual, therefore we are providing some upgrade notes below. Please read carefully for best upgrade experience.

### Upgrade notes

Under the hood we have now moved to using Kong 0.11.0, and that upgrade has to be done a little more carefully than you are perhaps used to with wicked before. Follow these recommendations for a glitch-free upgrade:

* If you are still using `postgres:9.4` as a Postgres image, consider upgrading to `postgres:9.6`; please note that the database formats are **not compatible**, so that we advise you to discard the Postgres data completely when upgrading. The only downside of this is that currently active access tokens are also discarded, but other than that there are no downsides.
* When starting the `wicked.kong` container the first time with the wicked 0.12.0, please
    * Shut down all previous Kong instances, or even better, use a completely new environment
    * Start just **one single Kong instance** at first, and wait until it has settled (created database schemas etc.); when everything is working again, you may now scale up to the desired amount of Kong instances again (when using Kubernetes, the readiness probe can be used to decide this)
* If you are using the deployment via `docker-compose.yml` file as proposed by the Kickstarter, the `env` variable `EXCLUDE_PORTS` has to be extended with the port `8444`; otherwise HAproxy will pick up that this (new) port is available on the Kong container, and will start to route traffic to it (you will end up with error messages from `openResty` if this is the case).

If you find anything else which does not work correctly, please do not hesitate to notify the project via GitHub Issues. Thanks.

**Please upgrade your test/dev instances first to make sure your upgrade process works correctly.**

### Contributors

Code for this release was contributed by the following developers, THANKS FOR CONTRIBUTING!

* @achwie
* @santokhsingh
* @maksimlikharev
* @donmartin76

## 0.11.7 (beta)

**Date**: July 18th, 2017 (2017-07-18)

**Docker Tag**: `0.11.7`

The main topic for this release is the bug fix for a [login problem some installations of wicked](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/72) have experienced in the last couple of weeks. This turned out to be due to an upstream change in a dependency of a dependency, and that was rather unexpected. We have addressed the topic for fixing, and meanwhile reverted to an older version. Further some minor things in the Kickstarter have been fixed, and a lot of work has gone into writing a Helm Chart for wicked. This is still in an experimental phase and perhaps not yet production ready, but we will continue to focus on that. Contributions are more than welcome.

* [Login/registration broken in localdev](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/72)
* [Kickstarter: removing the last chat webhook breaks the editor.](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/73)
* [Kickstarter: Adding Authorization Server with "auth-server" in name break the API! dialog](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/77)
* [Remove run-unit-tests.sh from wicked.portal-api](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/76)
* [Enables GIT_REPOs with other protocols (`http` instead of `https`)](https://github.com/Haufe-Lexware/wicked.portal-api/pull/3) (thanks, @ehirsch)
* [Fixing docker-start to actually find the new create-git-url script](https://github.com/Haufe-Lexware/wicked.portal-api/pull/4)

## 0.11.6 (beta)

**Date**: May 24th, 2017 (2017-05-24)

**Docker Tag**: `0.11.6`

Lots of minor and medium changes, including a very appreciated Pull Request from [pifleo](https://github.com/pifleo) (thanks again!), dealing with customization options of the portal UI. Additionally, we now build (experimental) Alpine based images (based on `node:6-alpine`) in addition to the usual Debian based `node:6` images we have had so far. The demo portal already runs on Alpine, and it seems smooth. If you want to give it a spin, go ahead, append `-alpine` to the image tags to pull the Alpine images. Please note that `wicked.kong` does **not** have an Alpine image, it's quite small as is anyway.

Another notable change is that the Kong Adapter now can revoke access tokens, which can be useful for logout functionality. Last, but not least, wicked now allows for application IDs of up to 50 characters (instead of 20 before).

* [Portal UI Customization](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/66)
* [Provide Alpine Images](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/62)
* [It should be possible to revoke access tokens](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/70)
* [Allow a longer name in the kickstarter for applications](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/68)

## 0.11.5 (beta)

**Date**: March 31st, 2017 (2017-03-31)

**Docker Tag**: `0.11.5`

Minor bugfix release mainly concerning the Kickstarter. The template for the `docker-compose.yml` created by the Kickstarter container an error (double `environment` sections) which prevented HAproxy (in the default configuration) to pick up the portal end point. Except for the YAML being syntactically wrong, this always just rendered a 503 return code for the portal end point.

* [Error when Deploying API portal locally](https://github.com/Haufe-Lexware/wicked.haufe.io/issues/61)

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
