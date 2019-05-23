# Valid Redirect URIs

This document describes the different Redirect URIs for application which wicked (and Kong) deem valid.

* The Redirect URI must be a valid URL (must be parseable by the `URL` Javascript library)
* The URI must contain a host (i.e. the scheme must be followed by `://`)
* All `https:` URIs are valid
* `http:` URIs are only valid if the point to `localhost`, `127.0.0.1`, `portal.local` or if the `NODE_ENV` contains the string `local` (for local development scenarios)
* All custom schemes are accepted, as long as they contain a host
* Any valid URL, in case `ALLOW_ANY_REDIRECT_URI` is defined in the `wicked.api` container (corresponds to the `wicked box start --allow-any-redirect-uri` command line parameter for [wicked-in-a-box](wicked-in-a-box.md)).

## Examples of valid URIs

* `https://www.hello.com/oauth2/callback` (normal case)
* `http://localhost:3000/callback` (local development)
* `http://127.0.0.1/some_path`
* `https://de.company.app/oauth2redirect` (typical native app claimed URI)
* `myappscheme://dummy/oauth2redirect` (native app custom scheme)

## Examples of invalid URIs

* `http://www.hello.com/oauth2/callback` (callback via `http`, not allowed)
* `myappscheme:/oauth2redirect` (no host in URL)

---
Applies to version 1.0.0+ (post beta7).
