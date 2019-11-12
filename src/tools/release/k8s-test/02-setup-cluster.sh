#!/bin/bash

echo "========================================"
echo "$0"
echo "========================================"

set -e

if [[ -z "$RESOURCE_GROUP" ]]; then
    echo "ERROR: Env var RESOURCE_GROUP must be set."
    exit 1
fi

export KUBECONFIG=./kubeconfig-${RESOURCE_GROUP}

helm init --force-upgrade --wait
kubectl -n kube-system patch deployment tiller-deploy -p '{"spec": {"template": {"spec": {"automountServiceAccountToken": true}}}}'

sleep 30
helm install stable/nginx-ingress --name ic
