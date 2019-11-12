#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.22.3"
  exit 1
fi

# Expects the following variables to be exported:
# - DOCKER_PREFIX (registry.haufe.io/wicked/)
# - DOCKER_REGISTRY (docker registry, registry.haufe.io)
# - DOCKER_REGISTRY_USER (docker registry user)
# - DOCKER_REGISTRY_PASSWORD

source ./env-bitbucket.sh

./release.sh $1
