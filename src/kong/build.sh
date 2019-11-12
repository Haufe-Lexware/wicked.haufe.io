#!/bin/bash

set -e

pushd $( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

if [ -z "$DOCKER_PREFIX" ]; then
    echo "WARNING: Env var DOCKER_PREFIX not set, assuming haufelexware/wicked."
    export DOCKER_PREFIX="haufelexware/wicked."
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "WARNING: Env var DOCKER_TAG is not set, assuming 'dev'."
    export DOCKER_TAG=dev
fi

noCache=""
if [ ! -z "${DOCKER_NOCACHE}" ]; then
    echo "INFO: Building using --no-cache"
    noCache="--no-cache"
fi

echo "============================================"
echo "Building normal image..."
echo "============================================"

git log -1 --decorate=short > git_last_commit
git rev-parse --abbrev-ref HEAD > git_branch

export BUILD_ALPINE=""
normalImageName="${DOCKER_PREFIX}kong:${DOCKER_TAG}"
docker build --pull -t ${normalImageName} . ${noCache}

# echo "============================================"
# echo "Building alpine image..."
# echo "============================================"

# export BUILD_ALPINE="-alpine"
# alpineImageName="${DOCKER_PREFIX}portal:${DOCKER_TAG}-alpine"
# docker build --pull -f Dockerfile-alpine -t ${alpineImageName} .

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

    # echo "============================================"
    # echo "Pushing ${alpineImageName}"
    # echo "============================================"
    
    # docker push ${alpineImageName}
else
    if [ ! -z "$1" ]; then
        echo "WARNING: Unknown parameter '$1'; did you mean --push?"
    fi
fi

popd
