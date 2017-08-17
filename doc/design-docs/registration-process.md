# Registering for API/Portal usage

A new concept in 1.0 will be "registration pools". Registration pools are intended as user pools for API usage, where you want to know more about your end user than just a username and password, or a third party identity provider identity.

The prime use case for the registration pool concept is wicked itself. Wicked will have a registration pool of users which have registered for use of the API portal, and/or of APIs which are secured via wicked's [integrated authorization server](oauth2-support.md).

## Registration pool properties

An API can require registration prior to use via a new property `registrationPool`. The Portal API will by default have the registration pool `wicked` and require a registration before you can use the API, which is essentially what the Portal UI does.

So, the properties of the user in a registration pool are:

* Name (or "ID"), e.g. `wicked`, `my-awesome-company`
* Email address
* Custom ID (via Identity Provider)
* First Name
* Last Name

Plus addition custom fields, e.g. "Company" or "Role", which can optionally be added to be collected at registration.

## Registration Process

Before wicked 1.0, the registration process for federated identity providers was collapsed into a single login via the identity provider, and the user was directly created as a validated user. This will change for wicked 1.0, and the registration process will be change to also require a registration process even if the identity is already established via some other IdP.

This will make the registration process easier to understand, plus that you can (and should) also validate the email address you got from the Identity Provider. It will also enable users to use an identity provider like Google, but still use a different email address.

## Migration from wicked <1.0

When migrating data from an older version of wicked.haufe.io, the existing users in the user database will be moved to the `wicked` registration pool automatically.

## Implementation Packages

### Changes in `portal-api`

### Changes in `portal-kickstarter`

### Changes in `portal` (UI)

### Authorization Server
