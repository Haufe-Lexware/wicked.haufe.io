# Enabling mutual SSL Authentication with Backends

More details to come.

To set the certificate with which the API Gateway makes calls to the API backends, use the following two environment variables on your `kong` service:

* `PROXY_SSL_KEY`: The private key in PEM format
* `PROXY_SSL_CERT`: The certificate to use in PEM format.

Make sure you also include the CA in the appropriate place (TODO to describe this in more detail).

## Filling the env variables

### When deploying via `docker-compose`

To get the data into environment variables, use the following technique:

```bash
export PROXY_SSL_KEY=$(cat /path/to/proxy-key.pem)
export PROXY_SSL_CERT=$(cat /path/to/proxy-cert.pem)
```

### When deploying to Kubernetes

(TODO)
