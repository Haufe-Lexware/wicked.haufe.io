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

echo "Checking current branches..."
allOkay=true
for d in ${subDirList}; do
    pushd $d > /dev/null
    currentBranch=$(git branch | grep \* | cut -d ' ' -f2)
    if [[ "${currentBranch}" != "next" ]]; then
        echo "Repository ${d}: Current branch is '${currentBranch}', MUST be 'next'."
        allOkay=false
    fi
    popd > /dev/null
done

if [[ $allOkay != true ]]; then
    echo "Exiting due to errors."
    exit 1
fi

echo "Branches are all set to 'next', updating package.json."

export WICKED_DIRS="${versionDirs}"
node wicked.tools/release/set-version $1

for d in ${subDirList}; do
    pushd $d > /dev/null
    gitStatus=$(git status -s package.json)
    if [[ "${gitStatus}" == "" ]]; then
        echo "INFO: package.json in $d is unchanged, not pushing."
    else
        git add package.json
        git commit -m "Bump to version $1"
        git push
        echo ""
    fi
    popd > /dev/null
done

popd
