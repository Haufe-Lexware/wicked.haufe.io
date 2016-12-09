# Setting up API Plans

An **API Plan** is the "glue" between a subscription of a developer and an API. The plan decides on restrictions applied to the subscription, such as rate limiting.

* API Plans can be configured to use specific Plugins (such as rate limiting).
* An API plan can be configured to require an approval by an administrator (using the "Pending Subscriptions" admin page in the API Portal)
* API Plans can be configured to only be available to specific [user groups](defining-user-groups.md); if a developer does not belong to the `requiredGroup`, he cannot use this API Plan to subscribe to the API. This can be useful to e.g. have different plans for different groups of developers (e.g. external/partners/internal developers).

In many cases, only having one or two different plans is sufficient, e.g.

* `basic`: With a basic access to the API, e.g. for use for development, with a rate limit of 100 requests per hour (or similar)
* `unlimited`: Unlimited access to the API, or having a really high quota for usage (for production use)

Currently there is no means of monetizing the usage of the APIs, but requiring approval before a subscription is fulfilled is a way of having a hook-in to this process (albeit currently manually).

**See also**:

* [Configuring Kong Plugins](configuring-kong-plugins.md).

## Pro-tip: Injecting the plan name into the upstream headers

In case you need to make a distinction on your API plan (for whatever reason), you may use the Kong `request-transformation` plugin to add an upstream header stating the name of the plan; this can be added to the plugin configuration of the API Plan.
