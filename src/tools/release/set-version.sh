#!/bin/bash

set -e

. ./_repos.sh

pushd $(dirname $0)/../..

if [ -z "$1" ]; then
    echo "Usage: $0 x.y.z"
    echo "  Example: $0 0.13.2"
    echo "The script will update, commit and push the updated package.json"
    exit 1
fi

subDirList="${versionDirs}" # from _repos.sh

allOkay=true
echo "Checking branch..."
currentBranch=$(git branch | grep \* | cut -d ' ' -f2)
if [[ "${currentBranch}" != "next" ]]; then
    echo "ERROR: Current branch is '${currentBranch}', MUST be 'next'."
    allOkay=false
fi

if [[ $allOkay != true ]]; then
    echo "ERROR: Exiting due to errors."
    exit 1
fi

echo "=============================================="
echo "Branch is set to 'next', updating package.json files."
echo "=============================================="

export WICKED_DIRS="${versionDirs}"
node tools/release/set-version $1

echo "=============================================="
echo "Running install.sh"
echo "=============================================="

pushd tools/development
./install.sh
popd

echo "=============================================="
echo "Done."
echo "=============================================="

popd
