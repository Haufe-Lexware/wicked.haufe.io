#!/bin/bash

# Use this file after you have made changes to env which you need
# to propagate into the different packages. This is done by the build scripts
# automatically via env being the base for all other docker images, but
# if you need to update locally, try this.

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

envVersion=$(cat package.json | jq '.version' | tr -d '"')
if [[ -z "${envVersion}" ]]; then
    echo "ERROR: Could not retrieve env version from package.json"
    exit 1
fi

echo "INFO: Updating env in repositories which needs it."
echo "INFO: env v${envVersion}"

packageFile="portal-env-${envVersion}.tgz"
logFile="wicked.env/local-update-portal-env.log"
rm -f portal-env-*
rm -f ../${packageFile}

npm pack > /dev/null
echo "INFO: Package file: ${packageFile}"
rm -f ../portal-env.tgz
mv ${packageFile} ../portal-env.tgz

if [ "$1" = "--copy" ]; then
    echo "INFO: Only copied package file; npm install has to be run later."
else
    for prefix in "" "wicked."; do
        for wickedDir in \
            "api" \
            "ui" \
            "auth" \
            "kong-adapter" \
            "mailer" \
            "chatbot" \
            "kickstarter"; do

            if [ -d "../${prefix}${wickedDir}" ]; then 
                echo "INFO: Updating ${prefix}${wickedDir}"
                pushd ../${prefix}${wickedDir} > /dev/null
                npm install ../portal-env.tgz >> ../${logFile}
                popd > /dev/null 
            fi
        done
    done

    for wickedDir in \
        "wicked.test/portal-api" \
        "wicked.test/portal-kong-adapter" \
        "wicked.test/portal-auth"; do

        if [ -d "../${wickedDir}" ]; then 
            echo "INFO: Updating ${wickedDir}"
            pushd ../${wickedDir} > /dev/null
            npm install ../../portal-env.tgz >> ../../${logFile}
            popd > /dev/null 
        fi
    done
fi

popd > /dev/null # currentDir

echo "==== SUCCESS ==== $0"
