# Continuous Integration/Continuous Deployment

The API Portal is designed to be built up of immutable servers in the following sense: Everything which is not "user supplied" data, such as user accounts, applications and subscriptions, is considered static configuration, and **cannot** be changed after the deployment. If you need to change a configuration setting, such as API definitions or User groups, you will need to redeploy the API Portal with the updated configuration. 

This is intended behavior, but it does mean that you will have to set up a real CI/CD system for your API Portal. If you have little or no experience with this, the API Portal may be a useful testing object, and if you already have such a system in place, the API Portal should fit in quite nicely.

The advantages of immutable servers are quite striking:

* *Configuration Drift* is impossible: Any configuration of the system is contained in source control; you cannot change a running system without redeploying from scratch
* You are always able to *spin up a new instance* from scratch, which makes a good (albeit not perfect) desaster recovery plan
* The approach forces you to *automate deployments*, which is very important to make the CI/CD approach work

## Use Cases for CI/CD for the API Portal

The following list of use cases must be considered when setting up a CI/CD environment for your API Portal:

* Initial Deployment
* Updating the API Configuration (new APIs, configuration updates)
* Updating the API Portal Components
  * Updating the wicked core components (API, Portal, Kong Adapter, Mailer, Chatbot)
  * Updating the Kong API Gateway
  * Updating the Postgres Database
* [Disaster Recovery](disaster-recovery.md)

The implementation of these use cases depend on the deployment technique you are applying (Docker Host, Swarm, Kubernetes, GCE,...) and thus are documented on the deployment specific pages. See [deploying to production](deploying-to-production.md).
