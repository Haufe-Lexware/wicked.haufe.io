#!/usr/bin/dumb-init /bin/bash

set -e

echo "Using kong database host: ${KONG_PG_HOST}"
if [ -z $KONG_PG_PORT ]; then
    export KONG_PG_PORT=5432
fi
echo "Using kong database port: ${KONG_PG_PORT}"
echo Trusting all IPs to send correct X-Forwarded-Proto values
export KONG_TRUSTED_IPS="0.0.0.0/0,::/0"
export KONG_ADMIN_LISTEN="0.0.0.0:8001"

redis-server &

/usr/src/app/resources/wtfc.sh -T 30 "nc -z ${KONG_PG_HOST} ${KONG_PG_PORT}"
sleep 3
/usr/src/app/resources/wtfc.sh -T 30 "nc -z ${KONG_PG_HOST} ${KONG_PG_PORT}"
kong start --run-migrations

pm2 start /usr/src/app/pm2.config.js
# This will be the foreground process keeping the container going:
pm2 logs
