#!/bin/bash

set -e

currentDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd ${currentDir} > /dev/null
pushd ../../wicked.kong > /dev/null

DOCKER_TAG=local DOCKER_PREFIX=wicked. ./build.sh

popd > /dev/null # ../../wicked.kong
popd > /dev/null # ${currentDir}

echo "=========================="
echo "SUCCESS"
echo "=========================="
