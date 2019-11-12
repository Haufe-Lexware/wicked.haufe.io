#!/bin/bash

set -e

if [[ -z "${NPM_USER}" ]]; then
    echo "*** Env var NPM_USER is not set."
    exit 1
fi
if [[ -z "${NPM_PASS}" ]]; then
    echo "*** Env var NPM_PASS is not set."
    exit 1
fi
if [[ -z "${NPM_EMAIL}" ]]; then
    echo "*** Env var NPM_EMAIL is not set."
    exit 1
fi

docker build -f Dockerfile-publish -t wicked-sdk-tmp \
    --build-arg NPM_USER=${NPM_USER} \
    --build-arg NPM_PASS=${NPM_PASS} \
    --build-arg NPM_EMAIL=${NPM_EMAIL} \
    .
docker rmi wicked-sdk-tmp
