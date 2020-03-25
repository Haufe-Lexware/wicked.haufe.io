#!/usr/bin/dumb-init /bin/bash

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

if [ -z "$KONG_PG_PORT" ]; then
  echo "Env var KONG_PG_PORT not set, defaulting to 5432"
  export KONG_PG_PORT=5432
fi

echo "Using kong database host: $KONG_PG_HOST"
echo "Trusting all IPs to send correct X-Forwarded-Proto values"
export KONG_TRUSTED_IPS="0.0.0.0/0,::/0"
export KONG_ADMIN_LISTEN="0.0.0.0:8001"

/usr/local/bin/wtfc.sh -T 30 "nc -z ${KONG_PG_HOST} ${KONG_PG_PORT}"
if ! kong migrations list; then
  kong migrations bootstrap -y
else
  kong migrations up -y
fi

if [[ "$1" != "prepare" ]]; then
  kong start
else
  echo "Migrations/prepare has run. Quitting container."
fi
