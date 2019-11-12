#!/bin/bash

echo "========================================"
echo "$0"
echo "========================================"

set -e

if [[ -z "$RESOURCE_GROUP" ]]; then
    echo "ERROR: Env var RESOURCE_GROUP must be set."
    exit 1
fi

if [[ -z "$LEGO_EMAIL" ]]; then
    echo "ERROR: Env var LEGO_EMAIL must be set."
    exit 1
fi

export KUBECONFIG=./kubeconfig-${RESOURCE_GROUP}

helm install --name kube-lego \
    stable/kube-lego \
    --set config.LEGO_URL=https://acme-v01.api.letsencrypt.org/directory \
    --set config.LEGO_EMAIL=${LEGO_EMAIL} \
    --wait
