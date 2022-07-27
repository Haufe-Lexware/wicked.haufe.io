#!/bin/bash

set -e

this_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

pushd ${this_dir}

source ./tools/release/_repos.sh

if [ -z "$1" ]; then
    echo "Usage: $0 <branch>"
    exit 1
fi

branch=$1

if [ -z ${DOCKER_REGISTRY_USER} ] || [ -z ${DOCKER_REGISTRY_PASSWORD} ]; then
    echo "ERROR: DOCKER_REGISTRY_USER and/or DOCKER_REGISTRY_PASSWORD is not defined."
    exit 1
fi

echo "INFO: Using docker username ${DOCKER_REGISTRY_USER}."

docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD}

if [ -z "$DOCKER_PREFIX" ]; then
    echo "WARNING: Env var DOCKER_PREFIX not set, assuming haufelexware/wicked."
    export DOCKER_PREFIX="haufelexware/wicked."
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "WARNING: Env var DOCKER_TAG is not set, assuming '${branch}'."
    export DOCKER_TAG=${branch}
fi

function create_multiarch_manifest {
    image=$1

    docker manifest rm \
        ${DOCKER_PREFIX}${image} || true
    docker pull \
        ${DOCKER_PREFIX}${image}-amd64
    docker pull \
        ${DOCKER_PREFIX}${image}-arm64
    docker manifest create \
        ${DOCKER_PREFIX}${image} \
        ${DOCKER_PREFIX}${image}-amd64 \
        ${DOCKER_PREFIX}${image}-arm64
    docker manifest push \
        ${DOCKER_PREFIX}${image}
}

for i in ${alpineImageBases}; do
    if [[ $i != box ]]; then
        suffix="-alpine"
        if [[ $i == env ]]; then
            suffix="-onbuild-alpine"
        fi
        imageTag=${branch}${suffix}
        image=${i}:${imageTag}

        echo Image: $image

        create_multiarch_manifest ${image}
    fi
done

create_multiarch_manifest kong:${branch}
create_multiarch_manifest k8s-tool:${branch}
create_multiarch_manifest k8s-init:${branch}
create_multiarch_manifest box:${branch}

popd
