#!/bin/bash

set -e

pm2 kill

if [ "$(uname -m)" = "arm64" ] && [ -z "${DOCKER_DEFAULT_PLATFORM}" ]; then
    echo "WARNING: Using native arm64 builds. Override by setting DOCKER_DEFAULT_PLATFORM=linux/amd64."
    export DOCKER_DEFAULT_PLATFORM=linux/arm64
else
    export DOCKER_DEFAULT_PLATFORM=linux/amd64
fi
echo "INFO: Using '${DOCKER_DEFAULT_PLATFORM}' as a target platform."

docker-compose down -v
