#!/bin/bash

set -e

this_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

pushd ${this_dir}

if [[ ! -z ${BRANCH_NAME} ]]; then
    branch=${BRANCH_NAME}
    echo "INFO: Taking branch name from Jenkins: ${branch}"
else
    branch=$(git rev-parse --abbrev-ref HEAD)
    echo "INFO: Using current git branch: ${branch}"
fi
git_last_commit=$(git log -1 --decorate=short)

echo ${branch} > ./env/git_branch
echo ${git_last_commit} > ./env/git_last_commit
echo ${branch} > ./kong/git_branch
echo ${git_last_commit} > ./kong/git_last_commit
echo ${branch} > ./k8s-init/git_branch
echo ${git_last_commit} > ./k8s-init/git_last_commit
echo ${branch} > ./k8s-tool/src/git_branch
echo ${git_last_commit} > ./k8s-tool/src/git_last_commit

echo "======================================================"
echo "BUILDING BRANCH ${branch}"
echo "======================================================"
echo ""

export TAG=${branch}
if [ ! -z "${DOCKER_TAG}" ]; then
    echo "INFO: Using tag ${DOCKER_TAG} instead of branch ${branch}"
    export TAG=${DOCKER_TAG}
fi

if [ "$(uname -m)" = "arm64" ] && [ -z "${DOCKER_DEFAULT_PLATFORM}" ]; then
    echo "WARNING: Using native arm64 builds. Override by setting DOCKER_DEFAULT_PLATFORM=linux/amd64."
    export DOCKER_DEFAULT_PLATFORM=linux/arm64
elif [ -z "${DOCKER_DEFAULT_PLATFORM}" ]; then
    export DOCKER_DEFAULT_PLATFORM=linux/amd64
else
    echo "INFO: Using given DOCKER_DEFAULT_PLATFORM value: ${DOCKER_DEFAULT_PLATFORM}"
fi
export DOCKER_ARCH=$(echo ${DOCKER_DEFAULT_PLATFORM} | cut -d '/' -f 2)
echo "INFO: Using '${DOCKER_DEFAULT_PLATFORM}' (Architecture ${DOCKER_ARCH}) as a target platform."

(
    source .env
    docker pull ${BASE_IMAGE_ALPINE}
    # docker pull ${BASE_IMAGE_UBUNTU}
)

docker-compose --file=docker-compose.build.yml build node-sdk kong k8s-tool
# docker-compose --file=docker-compose.build.yml build --parallel env env-alpine k8s-init
docker-compose --file=docker-compose.build.yml build --parallel env-alpine k8s-init
# docker-compose --file=docker-compose.build.yml build env env-alpine k8s-init
docker-compose --file=docker-compose.build.yml build --parallel
# docker-compose --file=docker-compose.build.yml build

echo "======================================================"
echo "FINISHED BUILDING BRANCH ${branch}"
echo "======================================================"

popd
