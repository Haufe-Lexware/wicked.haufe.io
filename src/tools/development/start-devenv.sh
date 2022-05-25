#!/bin/bash

set -e

localIp=$(node js/get-local-ips.js)

export LOCAL_IP=${localIp}

envsubst < prometheus/template/prometheus.yml.template > prometheus/prometheus.yml

if [ "$(uname -m)" = "arm64" ] && [ -z "${DOCKER_DEFAULT_PLATFORM}" ]; then
    echo "WARNING: Using native arm64 builds. Override by setting DOCKER_DEFAULT_PLATFORM=linux/amd64."
    export DOCKER_DEFAULT_PLATFORM=linux/arm64
else
    export DOCKER_DEFAULT_PLATFORM=linux/amd64
fi
echo "INFO: Using '${DOCKER_DEFAULT_PLATFORM}' as a target platform."

docker-compose build prometheus-config
docker-compose pull kong-database redis prometheus

mkdir -p ./pg_data

docker-compose up -d --force-recreate

pm2 start wicked-pm2.config.js
