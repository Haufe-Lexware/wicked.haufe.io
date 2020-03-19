#!/bin/bash

set -e

echo "=========================="
echo "START: $0"
echo "=========================="

set -e

thisDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd ${thisDir} > /dev/null
. ../release/_repos.sh
pushd ../../ > /dev/null

function runNpmInstall {
    thisRepo=$1
    pushd ${thisRepo} > /dev/null
    echo "=========================="
    echo "INFO: Running npm install for repository ${thisRepo}"
    echo "=========================="
    # if ${killPackageLock}; then
    #     if [ -f ./package-lock.json ]; then
    #         echo "WARN: Deleting package-lock.json first (due to --kill-package-lock)"
    #         rm -f ./package-lock.json
    #     fi
    # fi
    npm install
    if [[ $thisRepo == env ]] || [[ $thisRepo == node-sdk ]]; then
        npm link
    fi
    popd > /dev/null
}

npm config set registry https://registry.npmjs.com/

runNpmInstall node-sdk
runNpmInstall env

# Add the wicked.node-sdk to where it needs to be
# ./wicked.node-sdk/install-local-sdk.sh --copy
# Add the env package
# ./wicked.env/local-update-portal-env.sh --copy
for repo in ${versionDirBases}; do
    if [[ ${repo} != env ]] && [[ ${repo} != node-sdk ]] && [[ ${repo} != k8s-init ]]; then
        runNpmInstall ${repo}
    fi
done

popd > /dev/null
popd > /dev/null
