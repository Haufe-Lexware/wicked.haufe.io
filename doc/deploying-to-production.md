# Deploying to Production

* Use the [git clone method](static-config-git-clone.md) to get the static configuration into the portal API container
* The following wicked components can and should be scaled to at least two containers: `portal-api`, `portal`, `portal-auth`. The other components (`portal-mailer`, `portal-kong-adapter`, `portal-chatbot`) are singletons and MUST NOT be scaled to more than one instance.
* The Kong container is able to scale out of the box, as long as each instance has its own private range IP address (10.x, 172.16.x)backup plan), as it can at any time be recreated by (re-)starting the Kong Adapter
* Use a production proven custom Postgres installation
* Make sure you keep the Postgres data safe, and make sure you have a backup and disaster recovery plan

Wicked currently runs best in **Kubernetes**, using the [Kubernetes Chart for wicked.haufe.io](https://github.com/Haufe-Lexware/wicked.haufe.io/tree/master/wicked), **or** using a standalone Docker Host.

## Runtimes

* [Deploying to a single Docker Host](deploying-to-docker-host.md)
* [Deploying to Docker Swarm](deploying-to-swarm.md)
* [Deploying to Kubernetes](deploying-to-kubernetes.md)
* [Deploying to Apache Mesos](deploying-to-mesos.md)

## Static configuration deployments

Key point when deploying the API Portal is that the container `wicked.portal-api` needs to have the static configuration (APIm configuration repository) mounted/cloned to the path `/var/portal-api/static`. Any way of doing this will be fine, as long as the `static` directory ends up just there.

There are two common ways of accomplishing this:

* [Using git clone at container startup](static-config-git-clone.md) (should work with all deployments, except local)
* [Using/building a data-only container prior to deploying the portal API](static-config-dataonly-container.md) (for local/playground deployments, also works with Docker Host and Docker Swarm deployments)

These two methods should meet most needs. In case your runtime makes this difficult for you, feel free to reach out and we'll search for a specific solution (and document that).

## Creating a private `portal-api` service

A third possibility involves the use of a private docker registry: Extend the `haufelexware/wicked.portal-api` image by copying in your static configuration to the `/var/portal-api/static` folder using a `Dockerfile`, then use this image instead of the `haufelexware/wicked.portal-api` image for your `portal-api` service. You should still use the same entry point/command as the base container, as this is where the configuration revision hash is calculated.

The advantages are:

* You do not need to inject credentials to your git repository into your API container
* Deployments are always reproducible if you template your compose/deployment files to use a speecific tag of this image

The disadvantages are:

* You need a private docker image repository you can use
* Deploying a new configuration requires building a new image for the `portal-api`, including pushing and pulling it to/from the private repository
* Either you use `latest` as tag for the image, or you need to re-template your deployment configuration files at each new deployment
