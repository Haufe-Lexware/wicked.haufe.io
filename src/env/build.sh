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

git log -1 --decorate=short > git_last_commit
currentBranch=$(git rev-parse --abbrev-ref HEAD)
if [[ -n "${BRANCH_NAME}" ]]; then
    echo "============================================"
    echo "INFO: Detected BRANCH_NAME env var from Jenkins, using that"
    currentBranch=${BRANCH_NAME}
fi
echo "============================================"
echo "INFO: Running on branch ${currentBranch}"
echo ${currentBranch} > git_branch

function hasBranch {
    local testBranch; testBranch=$1
    if [ -z "$(git branch -r | sed 's/^..//' | grep origin/${testBranch})" ]; then
        return 1
    fi
    return 0
}

function resolveBranch {
    local testBranch; testBranch=$1
    local fallback1; fallback1=next
    local fallback2; fallback2=master
    if hasBranch ${testBranch}; then
        echo ${testBranch}
        return 0
    elif hasBranch ${fallback1}; then
        echo ${fallback1}
        return 0
    elif hasBranch ${fallback2}; then
        echo ${fallback2}
        return 0
    fi
    return 1
}

echo "============================================"
echo "INFO: Checking out wicked.node-sdk and setting correct branch"
rm -rf sdk-tmp
mkdir -p sdk-tmp
pushd sdk-tmp > /dev/null
    git clone https://github.com/apim-haufe-io/wicked.node-sdk
    pushd wicked.node-sdk
        sdkBranch=$(resolveBranch ${currentBranch})
        echo "INFO: Using branch ${sdkBranch} of wicked.node-sdk"
        git checkout ${sdkBranch}

        echo "INFO: Packing node SDK into wicked-sdk.tgz"
        cp -f ../../build/Dockerfile-build-sdk ./Dockerfile
        docker build -t wicked-node-sdk:${currentBranch} . --no-cache

        echo "INFO: Copying wicked-sdk.tgz from builder image"
        docker create --name wicked-node-sdk-${currentBranch} wicked-node-sdk:${currentBranch} > /dev/null
        docker cp wicked-node-sdk-${currentBranch}:/usr/src/app/wicked-sdk.tgz ../../wicked-sdk.tgz

        echo "INFO: Cleaning up..."
        docker rm -f wicked-node-sdk-${currentBranch} > /dev/null
        docker rmi wicked-node-sdk:${currentBranch} > /dev/null
        echo ""
        echo "INFO: Resulting wicked-sdk.tgz:"
        ls -la ../../wicked-sdk.tgz
    popd > /dev/null # wicked.node-sdk
popd > /dev/null # sdk-tmp

echo "============================================"
echo "Building normal image..."
echo "============================================"

docker build --pull -t ${DOCKER_PREFIX}env:${DOCKER_TAG}-onbuild --no-cache .

echo "============================================"
echo "Building alpine image..."
echo "============================================"

docker build --pull -f Dockerfile-alpine -t ${DOCKER_PREFIX}env:${DOCKER_TAG}-onbuild-alpine --no-cache .

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
    echo "Pushing ${DOCKER_PREFIX}env:${DOCKER_TAG}-onbuild"
    echo "============================================"

    docker push ${DOCKER_PREFIX}env:${DOCKER_TAG}-onbuild

    echo "============================================"
    echo "Pushing ${DOCKER_PREFIX}env:${DOCKER_TAG}-onbuild-alpine"
    echo "============================================"
    
    docker push ${DOCKER_PREFIX}env:${DOCKER_TAG}-onbuild-alpine
else
    if [ ! -z "$1" ]; then
        echo "WARNING: Unknown parameter '$1'; did you mean --push?"
    fi
fi
