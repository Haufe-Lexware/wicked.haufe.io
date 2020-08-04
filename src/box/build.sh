#!/bin/bash

set -e

this_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

pushd ${this_dir}

if [ -z "$1" ]; then
    echo "Usage: $0 <branch>"
    exit 1
fi

if [ -z "$DOCKER_PREFIX" ]; then
    echo "WARNING: Env var DOCKER_PREFIX not set, assuming haufelexware/wicked."
    export DOCKER_PREFIX="haufelexware/wicked."
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "WARNING: Env var DOCKER_TAG is not set, assuming 'dev'."
    export DOCKER_TAG=dev
fi

branch=$1
build_date=$(date -u "+%Y-%m-%d %H:%M:%S")
printf "$build_date" > ./build_date
git log -1 --decorate=short > ./git_last_commit
if [[ ! -z ${BRANCH_NAME} ]]; then
    echo "INFO: Taking branch name '${BRANCH_NAME}' from Jenkins."
    echo ${BRANCH_NAME} > ./git_branch
else
    echo "INFO: Extracting branch name from git."
    git rev-parse --abbrev-ref HEAD > ./git_branch
fi


repos="kong node-sdk env api ui kong-adapter auth mailer chatbot"

if [[ -d wicked.haufe.io ]]; then
    rm -rf wicked.haufe.io
fi
git clone https://github.com/Haufe-Lexware/wicked.haufe.io

pushd wicked.haufe.io
git checkout ${branch}

# Once for the global state
echo ${branch} > ./src/git_branch
echo ${build_date} > ./src/build_date
git log -1 --decorate=short > ./src/git_last_commit

for repo in ${repos}; do
    pushd src/${repo}
    rm -f ./build_date ./git_last_commit ./git_branch
    echo ${branch} > ./git_branch
    echo ${build_date} > ./build_date
    git log -1 --decorate=short > ./git_last_commit
    popd
done
popd

alpineImageName=${DOCKER_PREFIX}box:${DOCKER_TAG}
docker build -t ${alpineImageName} .

if [ "$2" = "--push" ]; then
    echo "============================================"
    echo "Logging in to registry..."
    echo "============================================"

    if [ -z "$DOCKER_REGISTRY_USER" ] || [ -z "$DOCKER_REGISTRY_PASSWORD" ]; then
        echo "ERROR: Env vars DOCKER_REGISTRY_USER and/or DOCKER_REGISTRY_PASSWORD not set."
        echo "Cannot push images, exiting."
        exit 1
    fi

    if [ -z "$DOCKER_REGISTRY" ]; then
        echo "WARNING: Env var DOCKER_REGISTRY not set, assuming official docker hub."
        docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD}
    else
        docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD} ${DOCKER_REGISTRY}
    fi

    echo "============================================"
    echo "Pushing ${alpineImageName}"
    echo "============================================"
    
    docker push ${alpineImageName}
else
    if [ ! -z "$2" ]; then
        echo "WARNING: Unknown parameter '$1'; did you mean --push?"
    fi
fi

popd
