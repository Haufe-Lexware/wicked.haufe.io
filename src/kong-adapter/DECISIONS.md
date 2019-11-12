# Architectural/Design decisions

## Kong Consumers

Applications in wicked which are used for the OAuth2 Client Credentials flow, or which are using API Keys, will be addede to Kong directly as identifiable `consumers`; they do not carry any information regarding the actual end user calling the API.

Applications which are intended for use with the OAuth2 Implicit Flow will not be added as `consumers` to Kong. Instead, the actual consumer (which here then maps to to the end user person, not machine) will be registered with Kong on demand by calling the `/oauth2/register` end point of this Kong adapter. This is usually done by an implementation of an Authorization Server (which cannot be done generically).

### Idenitification of consumers

Consumers which are created via the OAuth2 Implicit Grant Flow are not directly distinguishable from the ones created from the applications/subscriptions registered in the API Portal; they have a username like `email@company.com$api-name`. 

# Problematic Use Cases

The next section describes things which are problematic for the Kong Adapter and where either a shortcut was made, or where a decision could have gone in different directions. Where possible, a rationale is given for deciding either way.

## Use Case: Synchronizing Consumers

For simplicity, the Kong Adapter only had a single operation, synchronizing all settings. This will not be efficient (never was, but wasn't that bad) if there are very many applications and consumers in the Kong database. The probability of this happening with only API Keys/Client Credentials applications is not that high, but in the case where there are also end users in the calculation, this has potential to change.

As a change now, we will do the following:

THIS WAS THE STATE BEFORE WICKED 1.0.0

* All consumers are only synchronized "left to right", that is from wicked to Kong; any existing consumers in Kong (which do not match a consumer in wicked) are ignored (**done**)
* Any change on an application only synchronizes that single application, except at first startup, where all consumers are synchronized once (but also only from wicked to Kong) (**done**)
* New: The Kong Adapter will react to "delete application" events, and subsequently delete those applications from the Kong database
    * Due to the fact that not applications, but the application's subscriptions are mapped to consumers in Kong, the delete app webhook needs to also transfer the current subscriptions of the application to listening subscribers (otherwise these would be left hanging). **done**
    * Caveat: A new synchronization would not help in deleting these subscriptions! This should be looked into; this means it's more or less mandatory to re-deploy Kong and its PGSQL instance from time to time to be sure it's in a reconciliated state. Plus: See below - at startup check for pending `delete` webhook events. **done** (DOES NOT APPLY TO wicked 1.0.0, it can be long running)
    * Possible additional mitigation: Run a cleanup step from time to time checking all consumers, and removing consumers which cannot be mapped to any current applications from the API Portal.

WICKED 1.0.0

Consumers are synchronized just like all other things: Thus also deleted if consumers which do not match subscriptions are found.

#### Sub-problems (partly not solved):

* Deleting an application which uses OAuth2 implicit grant from wicked would result in consumers left in the Kong database which could never be cleaned up until Kong is deployed anew (with a fresh database); these consumers could potentially carry still-valid access tokens for an API, even if the application does no longer exist (mitigation: use short expiry times, e.g. 24h or shorter). **WHAT IS MEANT WITH THIS?**
* Deleting API Key/CC applications while the Kong adapter is experiencing a down-time could potentially result in applications left in the Kong consumer database, with potentially still valid API Keys/credentials (mitigation: Don't automatically unregister the Kong Adapter if it goes down, but store the events. **done**) **NOT APPLICABLE TO WICKED 1.0.0** (fixed)
    * Additional mitigation: At Kong Adapter startup, **first** check the event queue for pending `delete` events; these have to be dealt with first. After that, the queue may be deleted and a full initialization can be done. Otherwise there may be left-overs which are not deleted at the initialization (as we're only doing left to right now). (**not yet done**) **NOT APPLICABLE IN WICKED 1.0.0** (fixed)

## Use Case: Changing an Application's `redirect_uri`

Actually, this does not seem to be a problem when thinking about it:

* A consumer was created with the application carrying the old redirect_uri
* The redirect_uri has changed, the application ID has not, and this is used as the `name` of the OAuth2 Application which is registered with the consumer
* If the redirect_uri is differing, it is updated in the Kong consumer (deleted and re-added)
