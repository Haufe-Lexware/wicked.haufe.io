# Enabling mutual SSL Authentication with Backends

More details to come.

To set the certificate with which the API Gateway makes calls to the API backends, use the following two environment variables:

* `PROXY_SSL_KEY`: The private key in PEM format
* `PROXY_SSL_CERT`: The certificate to use in PEM format.

Make sure you also include the CA in the appropriate place (...).

To get the data into environment variables, use the following technique:

```bash
export PROXY_SSL_KEY=$(cat /path/to/proxy-key.pem)
export PROXY_SSL_CERT=$(cat /path/to/proxy-cert.pem)
```
