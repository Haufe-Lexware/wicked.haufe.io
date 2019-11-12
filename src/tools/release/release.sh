#!/bin/bash

set -e

. ./_repos.sh

# Simplified regex for the wicked semver
versionregex="^([0-9]+).([0-9]+).([0-9]+)(-rc.[0-9]+)?$"

dockerRegistry=$DOCKER_REGISTRY

if [ -z "$DOCKER_REGISTRY" ]; then
    echo "DOCKER_REGISTRY is not set, assuming official Docker hub."
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

if [[ ! "$1" =~ $versionregex ]]; then
    echo "Invalid version (needs to be x.y.z): $1"
    exit 1
fi

majorVersion=${BASH_REMATCH[1]}
minorVersion=${BASH_REMATCH[2]}
releaseTag=$1
majorTag=${majorVersion}
minorTag=${majorVersion}.${minorVersion}

echo "Logging in to registry..."
docker login --username "$DOCKER_REGISTRY_USER" --password "$DOCKER_REGISTRY_PASSWORD" $dockerRegistry

# imageBases defined in _repos.sh
for image in ${imageBases}; do

    echo ""
    tagSuffix=""
    if [ "env" = "$image" ]; then
        tagSuffix="-onbuild"
    fi
    imageName=${DOCKER_PREFIX}${image}
    masterImage=${imageName}:master${tagSuffix}
    echo "Pulling image ${masterImage}"
    docker pull ${masterImage}

    echo "Tagging and pushing image ${DOCKER_PREFIX}$image..."
    for tag in ${releaseTag} ${minorTag} ${majorTag} "latest"; do
        setTag=${tag}${tagSuffix}
        echo "Tag ${setTag}..."
        docker tag ${masterImage} ${imageName}:${setTag}
        docker push ${imageName}:${setTag}
    done

    echo "Done for image $image."  
done

# alpineImageBases defined in _repos.sh
for image in ${alpineImageBases}; do

    echo ""
    tagSuffix=""
    if [ "env" = "$image" ]; then
        tagSuffix="-onbuild"
    fi
    imageName=${DOCKER_PREFIX}${image}
    masterImage=${imageName}:master${tagSuffix}-alpine
    echo Pulling image ${masterImage}
    docker pull ${masterImage}

    echo "Tagging and pushing image ${DOCKER_PREFIX}$image..."
    for tag in ${releaseTag} ${minorTag} ${majorTag} "latest"; do
        setTag=${tag}${tagSuffix}-alpine
        echo "Tag ${setTag}..."
        docker tag ${masterImage} ${imageName}:${setTag}
        docker push ${imageName}:${setTag}
    done

    echo "Done for image $image."  
done

echo "Successfully finished."
