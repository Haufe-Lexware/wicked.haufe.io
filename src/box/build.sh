#!/bin/bash

set -e

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
git rev-parse --abbrev-ref HEAD > ./git_branch

clone_repo() {
    local repo
    repo=$1
    full_repo=wicked.${repo}
    local branch
    branch=$2
    if [[ -d ${full_repo} ]]; then
        pushd ${full_repo} > /dev/null
        git checkout ${branch}
        git pull
        popd > /dev/null
    else
        git clone https://github.com/apim-haufe-io/${full_repo}
        pushd ${full_repo} > /dev/null
        git checkout ${branch}
        popd > /dev/null
    fi

    pushd ${full_repo} > /dev/null
    isDirty=$(git status -s)
    needsPush=$(git cherry -v)
    if [ -n "${isDirty}" ]; then
        echo "Repository ${full_repo} is dirty, will not continue."
        exit 1
    fi
    if [ -n "${needsPush}" ]; then
        echo "Repository ${full_repo} has unpushed commits, will not continue."
        exit 1
    fi
    rm -f ./build_date ./git_last_commit ./git_branch
    printf "${build_date}" > ./build_date
    git log -1 --decorate=short > ./git_last_commit
    git rev-parse --abbrev-ref HEAD > ./git_branch
    popd > /dev/null
}

repos="kong node-sdk env api ui kong-adapter auth mailer chatbot"

for repo in ${repos}; do
    clone_repo ${repo} ${branch}
done

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
