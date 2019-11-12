#!/bin/bash

echo "==== STARTING ==== $0"

trap failure ERR

function failure {
    echo "=================="
    echo "====  ERROR   ==== $0"
    echo "=================="
}

set -e

# Check whether jq is installed (should be)
if ! which jq > /dev/null; then
    echo "ERROR: This script requires 'jq' to be installed."
    exit 1
fi

currentDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
pushd ${currentDir} > /dev/null

sdkVersion=$(cat package.json | jq '.version' | tr -d '"')
if [[ -z "${sdkVersion}" ]]; then
    echo "ERROR: Could not retrieve wicked SDK version from package.json"
    exit 1
fi
echo "INFO: wicked-sdk v${sdkVersion}"

rm -f install-local-sdk.log

npm install > /dev/null
./node_modules/typescript/bin/tsc
packageFile=$(npm pack)
echo "INFO: Package file: ${packageFile}"

pushd .. > /dev/null

baseDir=$(pwd)

for dir in wicked.ui \
    wicked.mailer \
    wicked.chatbot \
    wicked.auth \
    wicked.kong-adapter \
    wicked.test/portal-auth \
    wicked.k8s-init; do

    echo "INFO: Installing node-sdk into $dir"

    pushd $dir > /dev/null
    cp -f ${baseDir}/wicked.node-sdk/${packageFile} ./wicked-sdk.tgz
    if [ "$1" = "--copy" ]; then
        echo "INFO: Just copying node-sdk, npm install has to be run later."
    else
        npm install wicked-sdk.tgz >> ${baseDir}/wicked.node-sdk/install-local-sdk.log 2>&1
    fi
    popd > /dev/null
done
# Make sure the package is in the env directory as well, as it's
# needed when building the docker image.
echo "INFO: Copying ${packageFile} to wicked.env"
cp -f ./wicked.node-sdk/${packageFile} ./wicked.env/wicked-sdk.tgz

popd > /dev/null # ..
popd > /dev/null # currentDir

echo "==== SUCCESS ==== $0"
