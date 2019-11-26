#!/bin/bash

echo "ERROR: This should not be needed anymore."
echo "       Just check in package-lock.json just as any other file. Thanks."
exit 1

echo "=========================="
echo "START: $0"
echo "=========================="

set -e

currentDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

expectedNodeVersion="8"
expectedNpmVersion="5"

trap failure ERR

function failure {
    echo "=========================="
    echo "ERROR: An error occurred, script exiting."
    echo "=========================="
}

pushd ${currentDir} > /dev/null
. ../release/_repos.sh
pushd ../../ > /dev/null

foundDirty=false
for repo in ${baseRepos}; do
    pushd ${repo} > /dev/null

    hasDirtyLock=$(git status -s | grep package-lock || :)
    if [[ -n "${hasDirtyLock}" ]]; then
        echo "Repo ${repo} has a dirty package-lock.json"
        git add package-lock.json
        git commit -m "Updated dependencies"
        git push
        foundDirty=true
    fi

    popd > /dev/null
done

popd > /dev/null # ../../
popd > /dev/null # ${currentDir} 

if [[ ${foundDirty} == false ]]; then
    echo "--> All package-lock.jsons clean."
fi

echo "=========================="
echo "SUCCESS: $0"
echo "=========================="
