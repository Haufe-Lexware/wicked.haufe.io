#!/bin/bash

set -e

currentDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd ${currentDir} > /dev/null
pushd ../.. > /dev/null

echo "Local build" > ./kong/git_last_commit
echo "Local build" > ./kong/git_branch

TAG=local docker-compose --file=docker-compose.build.yml build kong

popd > /dev/null # ../../wicked.kong
popd > /dev/null # ${currentDir}

echo "=========================="
echo "SUCCESS"
echo "=========================="
