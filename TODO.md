# Todo List

## Misc/Cross-cutting Things

- [x] Logging, how does Morgan work?
- [x] Better working environments for development

## Portal API issues

- [x] Plausibility check at API startup? For kickstarter? Into portal-env? Important for BLUE/GREEN
    - [x] Subscriptions for plans which do no longer exist?
    - [x] Subscriptions for plans which are not assigned to an API
    - [x] Missing env vars 

- [x] Env variables in other things than globals.json:
    - [x] apis.json
    - [x] plans? groups?
    - [x] config

- [x] Check for touch file in dynamic config; not present, set password of admin user
    - [x] Document email address of admin user.

- [x] Get User by mail/password must be POST, not GET
    - [x] remove GET, update Swagger
- [x] Protected API swagger files cannot be retrieved, even with forUser

- [x] Add user ID and utc date to all records; granularity?
- [x] Encryption of API Keys and Credentials before persisting?
    - [x] For Subscriptions
    - [x] For Users (Client ID and Secret for Portal access)

- [x] "Unhealthy" status for portal and kong in production?
    - [x] Make health ping return last error message (if applicable); may help in error checking
        - [x] portal-mailer
        - [x] portal-kong-adapter
        - [x] portal-chatbot

- [x] Separate end point for API, OAuth 2.0 for Portal API?
    - [x] Implementation in kong-adapter
    - [x] Changes to enable in API
    - [x] Changes in portal to display/create these credentials
    - [ ] Kickstarter option to enable (currently undocumented feature)  

- [x] Enable listening to `X-Consumer-Custom-ID` in addition to `X-UserId` (for OAuth 2.0 CC scenarios)
- [ ] Serving PDF files, also with user group checking

- [x] Split API in "public" and "private" parts for /portal-api/v1 end point
    - [x] In portal-api code
    - [x] Create two Swagger files
    - [x] Document that shit

- [x] Notation ${ENV_VAR} in env-reader

## Portal issues

- [x] Mapping of Groups from ADFS group
- [x] Auto-map of validated users to specific group "dev"

- [x] User Delete
    - [x] By himself
    - [x] By Admin

- [x] OAuth2 Credentials on applications page
- [x] Sessions in local storage - in file

- [x] desc.md for APIs is not displayed, methinks
    - [x] api.jade
    - [x] and apis.jade?
- [x] Kong Swagger UI does not work

- [x] Swagger UI has to be adapted to color scheme (and logo)
- [x] Applications page looks bad 
- [x] /applications should contain only the applications, /applications/:appId should contain subscriptions. It's crap right now.
- [x] /apis/:apiId page looks crap
- [x] Do we need a /plans/:planId page? --> No, solved with popover on APIs

- [ ] Input validation of User name and email? XSS?
- [x] Hide user IDs from normal users in normal cases? /users/me?
- [x] Check Referrer in portal? No
- [ ] Anti-XSRF Tokens for Forms? ==> Would break the Portal's UI API, but could make sense? https://github.com/expressjs/csurf

- [ ] Make validation check for Swagger optional (or switch it off by default)
- [x] Panels with collapsible header: Add glyphicon
- [ ] Support for Tags
    - [ ] On APIs
    - [ ] On Content

## Chatbot issues

- [x] Drag out configuration for mailer into globals/mailer? idem globals/chatbot?
- [ ] Chatbot messaging when pinging goes bad.

## Mailer issues

- [ ] Refactor Mailer to look like Chatbot (interesting events) - really? Prio 3
- [x] Sending out mail for new subscription approvals
- [x] Switching off mail entirely? See globals.yml
- [x] Mail with unsecure SMTP (not smtps://), settings?
- [ ] Send mails at failed webhooks/when the pinging goes bad?

## Kong-Adapter issues

- [x] Optimize Kong Adapter, just a little at least, so that it doesn't react e.g. on user changes
    - [x] Optimize listeners/we hooks, allow filtering of events (for entity probably?) - Prio 3 - needed?
- [ ] Enable Kong Adapter to talk to a different Kong instance (in case you already have one)
    - [ ] Enable passing a header to the Kong backend (e.g. Basic Auth credentials)
    - [ ] Pass white lists of consumers and APIs which are not touched 
- [x] Kong-Adapter Unit Testing
- [x] /deploy API must be routed to /api/deploy (with rate limiting)

## Refactorings

- [x] Static config not updated when deploying
- [x] Kickstarter must work with .env instead of .json --> and back again
- [x] jade in addition to markdown for content
- [x] Use Docker internal URL for mapping of `/swagger-ui` into Kong; local testing scenario?

- [x] Restrict plans by group --> enables visible APIs which cannot be subscribed to.
    - [x] Implementation in API
    - [x] Unit tests for API
    - [x] Implementation in Portal ("sorry, no plans available")
    - [x] Implementation in kickstarter

## Deployment and Build topics

- [ ] Artifactory as npmjs mirror? How does that work? 

- [x] Local setup with Docker, all in docker (portal development)
- [x] Local setup with Kong in Docker, node native; different compose file needed?
- [ ] Let's Encrypt?
- [ ] Howtos:
    - [x] Completely new setup
    - [x] Update kong
    - [x] Update PGSQL
    - [x] Update wicked portal
    - [x] Development/contribute
- [x] How to run kickstarter? npm Module? Docker? With tooling script? --> Docker
- [x] travis.ci? github build engine? How to build images? --> AWS go.cd (Markus)
- [x] Optimization of Dockerfiles
    - [x] everything in portal-env for node_modules?
    - [x] Setting up correct packages.json? "prepare_release" node executable?
- [x] Restructuring the repo? Can we keep it as is? If Dockerfiles are optimized
    - [x] wicked.haufe.io can contain all the sources and docker files plus scripts for building the images
    - [ ] wicked.tools can contain tooling for
        - [ ] Starting the Kickstarter --> documentation (or? sh?) 
        - [-] Deploying an entire APIm --> documentation
        - [-] Deploying a change of static config --> documentation
        - [x] Backing up? Restoring?
        - [-] Updating wicked --> documentation
        - [-] Updating Kong and Postgres --> documentation
        - [ ] How granular does this need to be?
- [ ] Backing up dynamic config regularly
    - [ ] backup/restore-Container? Azure? AWS? Plain file? scp of tgz?
    - [x] export and import endpoints which can be used for this
- [x] Does all this actually work on Windows?
- [x] With start.sh, after a partial deploy (of static config), Kong seems to hiccup (only returns 503) (irrelevant)

- [x] Deployment Tools docker image? ==> No, wicked.portal-tools repository.

### Integration Testing

- [x] Integration system; simple integration tests
    - [x] For pure portal development (tool build pipeline)
    - [x] Login
    - [x] Create application
    - [x] Create subscription for a sample API 
    - [x] Retrieve API key
    - [x] Make an API call using the new key
    - [x] Simpler variant: predefined user, key for a specific API, check that Gateway responds correctly after being deployed
- [ ] Integration tests locally
    - [x] For portal; document portal API?
    - [x] See above for simple test cases/the most basic ones
    - [x] Testing of Kong adapter?
    - [ ] Mailer/Chatbot?
    
### Logging

- [ ] Logging
    - [x] Make all servers log JSON in a coherent way
    - [ ] Log file/logging container? Fluentd?
    - [ ] Can we surface logs in the UI? Do we want to? Probably not, other best practices with docker? Recipe for simple log viewing using docker?
    - [ ] Restarting containers with DEBUG set to something else?

## Future work, things to not forget

- [x] Blue/green deployment? See BLUE_GREEN.md

- [x] Forwarded for... https://tools.ietf.org/html/rfc7239
   - [x] Implementation in kong-adapter (%%Forwarded)
   - [x] Support in kickstarter

- [x] Create SSL certificates for testing purposes in the kickstarter?
   - [x] How to get certificates into the deployment process?

## Kickstarter

- [x] First draft to be finished
- [x] Plans configuration
- [x] Implementing API configuration
    - [x] Which plugins?
- [x] Everything else
- [x] Title and footer on design page
- [x] Content pages (how much?)
- [x] Adding APIs, creating templates
- [x] Does deleting an API also delete Swagger and config?
- [x] Check marks when config is missing?
- [x] Admin password in globals.json
- [ ] desc.md for /apis cannot be edited
- [x] Some explanatory text on the SSL page
- [x] Support for local/DNS-less configurations?
- [ ] fluentd configuration?
- [x] Static Config versioning; 
  - [x] How does the kickstarter get the initial config?
  - [x] Update Steps when loading Configuration
    - [x] In Kickstarter
    - [x] In Portal-api? Yes. Default fallbacks? ==> NO
- [x] Template Configuration
- [x] Add/remove Header configuration for Plugins
- [ ] Add possibility to re-key the deployment secret
- [x] Add button to add default 'localhost' configuration (no, but doc on it)
- [ ] Content Tag support

## Social Components

- [ ] Issue tracker?
  - [ ] Over adapter to JIRA, Github?
- [ ] Feedback forms (for each page)
