#!/usr/local/bin/dumb-init /bin/bash

if [ ! -z "$PROXY_SSL_CERT" ] && [ ! -z "$PROXY_SSL_KEY" ]; then
  echo "INFO: Using certificates from PROXY_SSL_CERT and PROXY_SSL_KEY"

  echo "$PROXY_SSL_CERT" > /root/proxy-cert.pem
  echo "$PROXY_SSL_KEY" > /root/proxy-key.pem

  cp /root/nginx_kong.lua /usr/local/share/lua/5.1/kong/templates/nginx_kong.lua
else
  echo "INFO: Not using custom proxy SSL certificate. Override"
  echo "INFO: by defining PROXY_SSL_CERT and PROXY_SSL_KEY."
fi

if [ -z "$KONG_PG_HOST" ]; then
  echo "WARN: Env var KONG_PG_HOST is not set; checking KONG_DATABASE_SERVICE_HOST."
  if [ -z "$KONG_DATABASE_SERVICE_HOST" ]; then
    echo "ERROR: Neither KONG_PG_HOST nor KONG_DATABASE_SERVICE_HOST is set!"
    exit 1
  else
    echo "INFO: Kubernetes Mode, picking up database host from env var."
    export KONG_PG_HOST=$KONG_DATABASE_SERVICE_HOST
  fi
fi

echo "Using kong database host: $KONG_PG_HOST"
echo "Trusting all IPs to send correct X-Forwarded-Proto values"
export KONG_TRUSTED_IPS="0.0.0.0/0,::/0"
export KONG_ADMIN_LISTEN="0.0.0.0:8001"

wait-for-it.sh -h $KONG_PG_HOST -p 5432 -t 30 -- kong start --run-migrations
