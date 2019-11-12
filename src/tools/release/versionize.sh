#!/bin/bash

set -e

echo "DO NOT USE THIS."
exit 1

baseDir=`pwd`

if [ -z "$GIT_USERNAME" ] || [ -z "$GIT_PASSWORD" ]; then
    echo "The env vars GIT_USERNAME and GIT_PASSWORD need to be set."
    exit 1
fi

if [ -z "$GIT_REPO_BASE" ]; then
    echo "Env Var GIT_REPO_BASE needs to be set."
    echo "For Github:"
    echo "  export GIT_REPO_BASE=github.com/Haufe-Lexware/"
    echo "For Bitbucket:"
    echo "  export GIT_REPO_BASE=bitbucket.org/haufegroup/"
    echo "Or according to your needs."
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: ./versionize.sh <version>"
    echo "  The script will clone, change, checkin and push the package.json of the wicked repositories."
    exit 1
fi

# https://github.com/semver/semver/issues/232
versionregex="^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$"

if [[ ! "$1" =~ $versionregex ]]; then
    echo "Invalid version (needs to be x.y.z): $1"
    exit 1
fi

for repo in "wicked.ui" \
            "wicked.env" \
            "wicked.api" \
            "wicked.chatbot" \
            "wicked.kickstarter" \
            "wicked.mailer" \
            "wicked.kong-adapter" \
            "wicked.k8s-init"; do

    echo Versioning repository $repo...

    tmpDir=`mktemp -d`
    pushd $tmpDir

    git clone https://${GIT_USERNAME}:${GIT_PASSWORD}@${GIT_REPO_BASE}$repo
    pushd $repo

    python $baseDir/_versionize.py package.json $1
    if [[ ! -z $(git status -s) ]]; then
        echo "Checking in new version and pushing..."
        git add package.json
        git commit -m "Bumped version to $1"
        git push 
    fi
    popd

    popd
    rm -rf $tmpDir
done
