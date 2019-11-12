#!/usr/bin/env bash

. ./_repos.sh

if [[ -z $1 ]]; then
    echo "Usage: $0 <tag to delete>"
    exit 1
fi

tag=$1

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

# echo "Logging in to registry..."
# docker login --username "$DOCKER_REGISTRY_USER" --password "$DOCKER_REGISTRY_PASSWORD" $dockerRegistry

# USERNAME="docker_username"
# PASSWORD="docker_password"
# ORGANIZATION="organization"
# IMAGE="image"
# TAG="tag"

TOKEN=`curl -s -H "Content-Type: application/json" -X POST -d '{"username": "'$DOCKER_REGISTRY_USER'", "password": "'$DOCKER_REGISTRY_PASSWORD'"}' https://hub.docker.com/v2/users/login/ | jq -r .token`

echo $TOKEN

for image in ${imageBases}; do

    echo "Removing tag for $image..."
    echo "Delete normal tag..."
    suffix=""
    if [[ $image == env ]]; then
        suffix="-onbuild"
    fi
    curl -X DELETE -H "Authorization: JWT ${TOKEN}" https://hub.docker.com/v2/repositories/${DOCKER_PREFIX}${image}/tags/${tag}${suffix}/

    if [[ ${image} != kong ]] && [[ ${image} != k8s-init ]] && [[ ${image} != k8s-tool ]]; then
        echo "Delete alpine tag..."
        curl -X DELETE -H "Authorization: JWT ${TOKEN}" https://hub.docker.com/v2/repositories/${DOCKER_PREFIX}${image}/tags/${tag}${suffix}-alpine/
    fi
done
