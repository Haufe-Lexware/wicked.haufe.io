#!/bin/bash

echo "========================================"
echo "$0"
echo "========================================"

set -e

if [[ -z "$RESOURCE_GROUP" ]]; then
    echo "ERROR: Env var RESOURCE_GROUP must be set."
    exit 1
fi

if [[ -z "$DNS_ZONE" ]]; then
    echo "ERROR: Env var DNS_ZONE must be set."
    exit 1
fi

if [[ -z "$WICKED_TAG" ]]; then
    echo "ERROR: Env var WICKED_TAG must be set."
    exit 1
fi

export KUBECONFIG=./kubeconfig-${RESOURCE_GROUP}

if [ ! -d ../../../wicked.haufe.io/wicked ]; then
    echo "ERROR: Expected to find the wicked.haufe.io repository at ../../../wicked.haufe.io"
    echo "Exiting. Please run"
    echo ""
    echo "pushd ../../.. && git clone https://github.com/Haufe-Lexware/wicked.haufe.io && popd"
    exit 1
fi

echo "Updating chart from local storage"
rm -rf wicked
cp -r ../../../wicked.haufe.io/wicked .

echo "Using wicked tag ${WICKED_TAG}"

helm install --name woo wicked \
    --set image.tag=${WICKED_TAG} \
    --set ingress.useKubeLego=true \
    --set ingress.apiHost=api.${RESOURCE_GROUP}.${DNS_ZONE} \
    --set ingress.portalHost=portal.${RESOURCE_GROUP}.${DNS_ZONE}
