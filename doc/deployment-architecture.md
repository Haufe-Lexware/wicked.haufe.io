# Deployment Architecture

## Introduction

The API Portal is currently purely intended to be deployed to a docker host or swarm, using `docker-compose`.

The deployment architecture is usually as follows:

![Deployment Architecture](images/deployment-architecture.png)

The next sections briefly describes the functionality of each deployment artifact. For a list of which docker images are begind the different boxes, please refer to the [docker images](docker-images.md) documentation.

### HAproxy

The HAPROXY component routes the incoming traffic via virtual hosts (vhosts) either to the Portal or directly to Kong. HAproxy is also able to load balance Kong if you decide to deploy multiple instances of Kong.

### Portal

The PORTAL component consists of the actual web frontend of the API Portal. It is a stateless component (disregarding session information) which in turn relies completely on the PORTAL API to work correctly.

The PORTAL component is a node.js service listening on port 3000 over `http`, on the internal IP address `portal`.

### Portal API

The PORTAL API is the heart of the API Portal. It is effectively the only component which has state (albeit placed in a data only container, DYNAMIC CONFIG). The PORTAL API is reachable within the docker network as `portal-api` with the `http` protocol on port `3001`  and serves a REST interface on which all other components which are connected to PORTAL API rely on: PORTAL, KONG ADAPTER, MAILER and CHATBOT.

PORTAL API is implemented completely in node.js.

### Static Config

The STATIC CONFIG is created at deployment time by building a static configuration container directly on the docker host which is to host the API Portal. This is usually done by keeping a special `Dockerfile` inside the deployment repository, which in turn clones the configuration repository into this container.

The data inside STATIC CONFIG is static and will not change over time once the API Portal has been started after a deployment. STATIC CONFIG is a "data only" container which does not actually run, but only exposes a data volume which is mounted by the PORTAL API container at runtime. When redeploying, this container always has to be destroyed and rebuilt.

### Dynamic Config

The DYNAMIC CONFIG contains all dynamic (non-static) data which is needed for the API Portal, such as

* Users
* Applications
* API Subscriptions
* Email and Password verifications

These are stored as JSON files inside this "data only" container. At redeployment, this data container **must not** be destroyed and recreated. When exporting and importing data into an API Portal instance, this is the data which is transferred. This also applies to blue/green deployments.

### Kong Adapter

The KONG ADAPTER is implemented as a node.js service which hooks into the webhook interface of the PORTAL API. It uses the address `portal-kong-adapter` and listens on port `3002`. The Kong adapter listens to events from the PORTAL API and translates these into actions on the admininstration REST API of the Kong instance. The KONG ADAPTER fulfills the REST API specification for webhook listeners.

### Mailer

The MAILER component is also a webhook listener implementation, but this component listens to specific events and sends out emails on certain (configurable) events, e.g. when a user has just registered and needs to verify his/her email address, or if a password was lost. It's also implemented in node.js, it listens on address `portal-mailer` on port `3003`, using the `http` protocol.

### Chatbot

The CHATBOT component is very similar to the MAILER component, but does not send mails. Instead it may (configurably so) send out messages to webhook sinks in Slack or RocketChat (or other compatible chat tools). It has the default address `portal-chatbot` on port `3004`.

### Kong

If PORTAL API is the heart of the API Portal, Kong is the absolute heart of the API Gateway. The KONG component is based (very directly) on Mashape Kong, and routes all traffic according to the configuration in STATIC CONFIG and DYNAMIC CONFIG (via PORTAL API and KONG ADAPTER) to the backend APIs, or restricts access to the APIs. For storage of certain runtime data (such as rate limiting), it uses a database, here POSTGRES.

### Postgres and Postgres Data Volume

To store runtime data, KONG needs a database backend, which by default is a Postgres instance. Usually there is **no need** to backup the data volume used by POSTGRES, as the API Portal system is designed to be immutable, with the single exception of the DYNAMIC DATA container volume. Most data (except rate limiting data and OAuth tokens, if you use those) can be reconstructed from scratch after a new deployment, as soon as the DYNAMIC DATA has been restored or picked up (depending on your deployment strategy).

## Deployment Variants

The above deployment architecture will most probably work for most scenarios, but there may be a need for other types of deployments in the future. This is not impossible at all, but rather expected. The API Portal is designed upfront to be able to deployed using other architectures.

In the future, the following deployment variants may also be interesting:

* Separate Kong/Postgres/Cassandra deployment
    * Better support of zero-downtime upgrades for the API Gateway
    * More robust HA deployments
* Docker Swarm Deployment (docker 1.12+)
* Deployments leveraging AWS ELB or Azure LB natively
