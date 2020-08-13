#!/bin/bash

set -e

localIp=$(node js/get-local-ips.js)

export LOCAL_IP=${localIp}

envsubst < prometheus/template/prometheus.yml.template > prometheus/prometheus.yml

docker-compose build prometheus-config

mkdir -p ./pg_data

docker-compose up -d --force-recreate

pm2 start wicked-pm2.config.js
