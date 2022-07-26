#!/bin/bash

set -e

this_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

pushd ${this_dir}

if [ -z "$1" ]; then
    echo "Usage: $0 <branch>"
    exit 1
fi

branch=$1

if [ -z ${DOCKER_REGISTRY_USER} ] || [ -z ${DOCKER_REGISTRY_PASSWORD} ]; then
    echo "ERROR: DOCKER_REGISTRY_USER and/or DOCKER_REGISTRY_PASSWORD is not defined."
    exit 1
fi

if [ -z "$DOCKER_PREFIX" ]; then
    echo "WARNING: Env var DOCKER_PREFIX not set, assuming haufelexware/wicked."
    export DOCKER_PREFIX="haufelexware/wicked."
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "WARNING: Env var DOCKER_TAG is not set, assuming '${branch}'."
    export DOCKER_TAG=${branch}
fi

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

if [[ -d __ci ]]; then
    rm -rf __ci
fi
mkdir __ci
pushd __ci
git clone https://github.com/Haufe-Lexware/wicked.haufe.io
popd

pushd __ci/wicked.haufe.io
git checkout ${branch}

pushd src
./build.sh
./push.sh
popd

pushd src/test
export BUILD_ALPINE=-alpine
export BUILD_POSTGRES=true

./run-api-tests.sh
./run-kong-adapter-tests.sh
./run-auth-tests.sh
popd

pushd src/box
./build.sh ${branch} --push
popd

popd
