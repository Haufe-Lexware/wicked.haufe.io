#!/bin/bash

set -e

if [ -z "$DOCKER_PREFIX" ]; then
    echo "WARNING: Env var DOCKER_PREFIX not set, assuming haufelexware/wicked."
    export DOCKER_PREFIX="haufelexware/wicked."
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "WARNING: Env var DOCKER_TAG is not set, assuming 'dev'."
    export DOCKER_TAG=dev
fi

if [[ "haufelexware/wicked." == "$DOCKER_PREFIX" ]] && [[ "$1" == "--push" ]]; then
    echo "INFO: Resolving env base tag for target tag ${DOCKER_TAG}..."
    docker pull haufelexware/wicked.env:next-onbuild-alpine
    export PORTAL_ENV_TAG=$(docker run --rm haufelexware/wicked.env:next-onbuild-alpine node node_modules/portal-env/getMatchingTag.js haufelexware wicked.env ${DOCKER_TAG})
    if [ -z "$PORTAL_ENV_TAG" ]; then
        echo "ERROR: Could not resolve env base tag!"
        exit 1
    fi 
else
    export PORTAL_ENV_TAG=${DOCKER_TAG}-onbuild
fi

echo "INFO: Using base image tag ${PORTAL_ENV_TAG}"

echo "============================================"
echo "Building normal image..."
echo "============================================"

export BUILD_ALPINE=""
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile
normalImageName="${DOCKER_PREFIX}ui:${DOCKER_TAG}"
if [[ "dev" = "${DOCKER_TAG}" ]]; then
    docker build -t ${normalImageName} .
else
    docker build --pull -t ${normalImageName} . --no-cache
fi

echo "============================================"
echo "Building alpine image..."
echo "============================================"

export BUILD_ALPINE="-alpine"
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile-alpine
alpineImageName="${DOCKER_PREFIX}ui:${DOCKER_TAG}-alpine"
if [[ "dev" = "${DOCKER_TAG}" ]]; then
    docker build -f Dockerfile-alpine -t ${alpineImageName} .
else
    docker build --pull -f Dockerfile-alpine -t ${alpineImageName} . --no-cache
fi

if [ "$1" = "--push" ]; then
    echo "============================================"
    echo "Logging in to registry..."
    echo "============================================"

    if [ -z "$DOCKER_REGISTRY_USER" ] || [ -z "$DOCKER_REGISTRY_PASSWORD" ]; then
        echo "ERROR: Env vars DOCKER_REGISTRY_USER and/or DOCKER_REGISTRY_PASSWORD not set."
        echo "Cannot push images, exiting."
        exit 1
    fi

    if [ -z "$DOCKER_REGISTRY" ]; then
        echo "WARNING: Env var DOCKER_REGISTRY not set, assuming official docker hub."
        docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD}
    else
        docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD} ${DOCKER_REGISTRY}
    fi

    echo "============================================"
    echo "Pushing ${normalImageName}"
    echo "============================================"

    docker push ${normalImageName}

    echo "============================================"
    echo "Pushing ${alpineImageName}"
    echo "============================================"
    
    docker push ${alpineImageName}
else
    if [ ! -z "$1" ]; then
        echo "WARNING: Unknown parameter '$1'; did you mean --push?"
    fi
fi
