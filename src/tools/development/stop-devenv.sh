#!/bin/bash

set -e

pm2 kill

# Needed to build the right images on macOS with M1 processors
export DOCKER_DEFAULT_PLATFORM=linux/amd64

docker-compose down -v
