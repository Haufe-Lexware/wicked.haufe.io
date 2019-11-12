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

echo "============================================"
echo "Building image..."
echo "============================================"

git log -1 --decorate=short > ./src/git_last_commit
git rev-parse --abbrev-ref HEAD > ./src/git_branch

gitRef=$(git rev-parse HEAD)
buildDate=$(date -u +'%Y-%m-%d %H:%M:%S UTC')
imageName="${DOCKER_PREFIX}k8s-tool:${DOCKER_TAG}"
docker build \
    --build-arg VCS_REF=${gitRef} \
    --build-arg BUILD_DATE="${buildDate}" \
    -t ${imageName} \
    src

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
    echo "Pushing ${imageName}"
    echo "============================================"

    docker push ${imageName}
fi
