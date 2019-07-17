# OAuth2 Authentication

This document is still not complete.

Most topics on OAuth2 Authentication are very similar to the ones described in [ADFS Authentication via OAuth2](auth-adfs.md).

The most important thing for a generic OAuth2 setup to work is that wicked assumes the Access Token being returned after successfully authenticating/authorizing with your OAuth2 Identity Provider is a JWT (JSON Web Token), containing the user profile of the user.

The auth method `oauth2` allows mapping different properties/claims from the JWT into the wicked profile. The JWT **must** always contain valid claims for `sub` (unique ID) and `email`. The generic `oauth2` auth method also supports mapping user groups (in case they are transferred) to wicked user groups, just like for the ADFS case.

As an alternative, the `oauth2` auth method allows retrieving a profile from an OIDC style `/user_info` end point. Also in case this possibility is used, the retrieved profile **must** contain at least the properties `sub` (as a unique ID) and `email`.
