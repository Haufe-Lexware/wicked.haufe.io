#!/bin/bash

if [ ! -z "$GIT_REVISION" ]; then
    echo "Setting revision to ${GIT_REVISION}..."
    kubectl patch configmap apim-config -p "{\"data\":{\"GIT_REVISION\":\"${GIT_REVISION}\",\"GIT_BRANCH\":\"\"}}"
fi

echo "Killing and restarting portal-api..."
kubectl delete po --selector=service=portal-api
