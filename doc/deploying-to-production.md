# Deploying to Production

* Use the git clone approach to getting the static configuration into the portal API container
* Make sure you keep the dynamic data volume safe; either store it on a fail safe mount, or make sure you have a backup and disaster recovery plan
* The wicked core components currently **do not** scale to more than one container (`portal-api`, `portal`, `portal-mailer`, `portal-kong-adapter`, `portal-chatbot`), so make sure you orchestration does not spin up additional containers before taking down the old ones (when updating)
* The Kong container is able to scale out of the box, as long as each instance has its own private range IP address (10.x, 172.16.x)
* Setting up a scalable Postgres cluster should be possible, but usually not really necessary; in case you are storing refresh tokens, it is a good idea to persist the Postgres data as well (as it is suggested in the default configuration). In case of a crash of the Postgres with data loss, only temporary access tokens (and possibly refresh tokens) are lost; new access tokens can be had quite quickly, even if it forces and end user to log in again.
* For situations where you only use OAuth 2 Client Credentials Flow and API Keys, the Postgres database is of no special worth, as it can at any time be recreated by (re-)starting the Kong Adapter

## Runtimes

* [Deploying to Kubernetes](deploying-to-kubernetes.md)
* [Deploying to Docker Swarm](deploying-to-swarm.md)
* [Deploying to Apache Mesos](deploying-to-mesos.md)
* [Deploying to a single Docker Host](deploying-to-docker-host.md)
