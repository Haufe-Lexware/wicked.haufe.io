#!/bin/bash

set -e

. ./_repos.sh

if [[ -z $1 ]] || [[ -z $2 ]]; then
    echo "Usage: $0 <source tag> <target tag> [image]"
    exit 1
fi

dockerRegistry=""
if [ -z "$DOCKER_REGISTRY" ]; then
    echo "DOCKER_REGISTRY is not set, assuming official Docker hub."
else
    echo "Using docker registry ${DOCKER_REGISTRY}"
    dockerRegistry=${DOCKER_REGISTRY}
fi

if [ -z "$DOCKER_REGISTRY_USER" ] || [ -z "$DOCKER_REGISTRY_PASSWORD" ]; then
    echo "The env vars DOCKER_REGISTRY_USER and DOCKER_REGISTRY_PASSWORD are not set."
    exit 1
fi

if [ -z "$DOCKER_PREFIX" ]; then
    echo "The env var DOCKER_PREFIX is not set. Use one of the following:"
    echo "For Haufe github:"
    echo "  export DOCKER_PREFIX=haufelexware/wicked."
    echo "For Haufe bitbucket:"
    echo "  export DOCKER_PREFIX=registry.haufe.io/wicked/"
    exit 1
fi

echo "Logging in to registry..."
docker login --username "$DOCKER_REGISTRY_USER" --password "$DOCKER_REGISTRY_PASSWORD" $dockerRegistry

sourceTag=$1
targetTag=$2
filter=$3

echo "Tagging branch tag ${sourceTag} as ${targetTag}..."

# imageBases defined in _repos.sh
for image in ${imageBases}; do
    pullPush=true
    if [[ -n "$filter" ]] && [[ ! "$filter" == "$image" ]]; then
        pullPush=false
    fi

    if $pullPush; then
        echo "==================================="
        echo "Image ${image}:"
        echo "==================================="
        tagSuffix=""
        if [ "env" = "$image" ]; then
            tagSuffix="-onbuild"
        fi
        branchImage=haufelexware/wicked.${image}:${sourceTag}${tagSuffix}
        targetImage=${DOCKER_PREFIX}${image}:${targetTag}${tagSuffix}

        docker pull ${branchImage}
        docker tag ${branchImage} ${targetImage}
        docker push ${targetImage}

        if [[ ${image} != kong ]] && [[ ${image} != k8s-init ]] && [[ ${image} != k8s-tool ]]; then
            docker pull ${branchImage}-alpine
            docker tag ${branchImage}-alpine ${targetImage}-alpine
            docker push ${targetImage}-alpine
        fi
    fi
done

echo "==================================="
echo "Success."
echo "==================================="
