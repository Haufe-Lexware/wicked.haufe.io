#!/bin/bash

set -e

currentDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd ${currentDir} > /dev/null
pushd ../.. > /dev/null

echo "Local build" > ./kong/git_last_commit
echo "Local build" > ./kong/git_branch

if [ "$(uname -m)" = "arm64" ] && [ -z "${DOCKER_DEFAULT_PLATFORM}" ]; then
    echo "WARNING: Using native arm64 builds. Override by setting DOCKER_DEFAULT_PLATFORM=linux/amd64."
    export DOCKER_DEFAULT_PLATFORM=linux/arm64
elif [ -z "${DOCKER_DEFAULT_PLATFORM}" ]; then
    export DOCKER_DEFAULT_PLATFORM=linux/amd64
else
    echo "INFO: Using given DOCKER_DEFAULT_PLATFORM value: ${DOCKER_DEFAULT_PLATFORM}"
fi
export DOCKER_ARCH=$(echo ${DOCKER_DEFAULT_PLATFORM} | cut -d '/' -f 2)
echo "INFO: Using '${DOCKER_DEFAULT_PLATFORM}' (Architecture ${DOCKER_ARCH}) as a target platform."

TAG=local docker-compose --file=docker-compose.build.yml build kong

popd > /dev/null # ../../wicked.kong
popd > /dev/null # ${currentDir}

echo "=========================="
echo "SUCCESS"
echo "=========================="
