#!/bin/bash

set -e

this_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
pushd ${this_dir}

buildLocal=""

export NODE_ENV=test

function separator {
    echo "--------------------------------------------------"
}

function fat_separator {
    echo "=================================================="
}

fat_separator
echo "$0"
fat_separator

if [ -z "$DOCKER_PREFIX" ]; then
    echo "INFO: Env var DOCKER_PREFIX is not set, assuming local build."
    export DOCKER_PREFIX=wicked.
    buildLocal="yes"
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "INFO: Env var DOCKER_TAG is not set, assuming dev"
    export DOCKER_TAG=dev
fi

if [ -z "$DOCKER_REGISTRY" ]; then
    echo "INFO: DOCKER_REGISTRY is not set, assuming official Docker registry."
else
    if [ -z "$DOCKER_REGISTRY_USER" ] || [ -z "$DOCKER_REGISTRY_PASSWORD" ]; then
        echo "ERROR: Using custom DOCKER_REGISTRY, but either DOCKER_REGISTRY_USER or"
        echo "       DOCKER_REGISTRY_PASSWORD is empty."
        exit 1
    fi

    echo "INFO: Logging in to docker registry ${DOCKER_REGISTRY}..."
    docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD} ${DOCKER_REGISTRY}
fi

if [ -z "$BUILD_ALPINE" ]; then
    echo "INFO: Env var BUILD_ALPINE is not set, not building Alpine images."
    export BUILD_ALPINE=""
else 
    echo "INFO: Env var BUILD_ALPINE is set, building Alpine images."
    if [ ! "$BUILD_ALPINE" = "-alpine" ]; then
        export BUILD_ALPINE="-alpine"
    fi
fi

wickedStorage="json"
if [ ! -z "$BUILD_POSTGRES" ]; then
    echo "INFO: Env var BUILD_POSTGRES is set, running tests with Postgres"
    wickedStorage="postgres" 
else
    echo "INFO: Env var BUILD_POSTGRES is not set, running tests with JSON storage"
fi
export WICKED_STORAGE=${wickedStorage}

rm -f logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log
thisPath=`pwd`

echo "INFO: Docker logs go into logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log."

export PORTAL_ENV_TAG=${DOCKER_TAG}-onbuild
export PORTAL_API_TAG=${DOCKER_TAG}

if [ ! -z "$buildLocal" ]; then

    # echo "INFO: Building images locally."

    # pushd ../wicked.env > /dev/null
    # echo "INFO: Building Environment docker image..."
    # docker build -f Dockerfile${BUILD_ALPINE} -t ${DOCKER_PREFIX}env:${PORTAL_ENV_TAG}${BUILD_ALPINE} . >> $thisPath/logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log 
    # popd > /dev/null

    # pushd ../wicked.api > /dev/null
    # echo "INFO: Building API docker image..."
    # perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile${BUILD_ALPINE}
    # docker build -f Dockerfile${BUILD_ALPINE} -t ${DOCKER_PREFIX}api:${PORTAL_API_TAG}${BUILD_ALPINE} . >> $thisPath/logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log
    # popd > /dev/null
    pushd ..
    docker-compose --file=docker-compose.build.yml build node-sdk
    docker-compose --file=docker-compose.build.yml build env${BUILD_ALPINE}
    docker-compose --file=docker-compose.build.yml build api${BUILD_ALPINE}
    popd

else

    echo "INFO: Using prebuilt images:"
    echo "      DOCKER_PREFIX=${DOCKER_PREFIX}"
    dockerTag=${DOCKER_TAG}
    echo "      DOCKER_TAG=${dockerTag}"

    # Magic image matching?
    # if [[ "$DOCKER_PREFIX" == "haufelexware/wicked." ]]; then
    #     echo "INFO: Resolving image names for tag ${dockerTag}"
    #     separator
    #     docker pull haufelexware/wicked.env:next-onbuild-alpine
    #     export PORTAL_ENV_TAG=$(docker run --rm haufelexware/wicked.env:next-onbuild-alpine node node_modules/portal-env/getMatchingTag.js haufelexware wicked.env ${dockerTag})
    #     export PORTAL_API_TAG=$(docker run --rm haufelexware/wicked.env:next-onbuild-alpine node node_modules/portal-env/getMatchingTag.js haufelexware wicked.api ${dockerTag})
    #     separator
    # fi
fi

export PROJECT_NAME=test$(od -vN "8" -An -tx1 /dev/urandom | tr -d " \n")

echo "INFO: PORTAL_ENV_TAG=${PORTAL_ENV_TAG}"
echo "INFO: PORTAL_API_TAG=${PORTAL_API_TAG}"
echo "INFO: PROJECT_NAME=${PROJECT_NAME}"

echo "INFO: Templating Dockerfile for test base and compose file..."

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' base/Dockerfile.template > base/Dockerfile
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' portal-api/Dockerfile.template > portal-api/Dockerfile
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' portal-api/api-tests-compose.yml.template > portal-api/api-tests-compose.yml

if [ -z "$buildLocal" ]; then 
    echo "INFO: Using prebuilt images: Pulling images..."
    separator
    docker-compose -p ${PROJECT_NAME} -f portal-api/api-tests-compose.yml pull
    docker pull ${DOCKER_PREFIX}portal-env:${PORTAL_ENV_TAG}${BUILD_ALPINE}
    separator
fi

echo "INFO: Building Test base container..."
pushd base > /dev/null
docker build -t ${PROJECT_NAME}_test-base . >> $thisPath/logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log
popd > /dev/null

echo "INFO: Building Test container..."
docker-compose -p ${PROJECT_NAME} -f portal-api/api-tests-compose.yml build >> $thisPath/logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log

fat_separator
echo "INFO: Running API test containers..."
separator
failedTests=""
if ! docker-compose -p ${PROJECT_NAME} -f portal-api/api-tests-compose.yml up --abort-on-container-exit > logs/api-test-${wickedStorage}${BUILD_ALPINE}.log; then
    echo "WARNING: docker-compose exited with a non-zero return code."
    failedTests="true"
fi
separator
echo "INFO: Copying test results..."
if [ -d test_results ]; then
    echo "INFO: Cleaning up..."
    rm -rf test_results
fi
if ! docker cp ${PROJECT_NAME}_api-test-data_1:/usr/src/app/test_results .; then
    echo "ERROR: The test results are not available."
    failedTests="true"
fi
echo "INFO: Taking down Test containers..."
separator
docker-compose -p ${PROJECT_NAME} -f portal-api/api-tests-compose.yml down -v >> $thisPath/logs/docker-api-${wickedStorage}${BUILD_ALPINE}.log
separator

if [ ! -z "$failedTests" ]; then
    exit 1
fi

cp test_results/api-test.log logs/api-test-${wickedStorage}${BUILD_ALPINE}-RESULT.log
cat test_results/api-test.log

separator

echo "INFO: Detailed logs are in logs/api-test-${wickedStorage}${BUILD_ALPINE}.log."

echo "INFO: Cleaning up temporary images..."
separator
docker rmi ${PROJECT_NAME}_test-base
docker rmi ${PROJECT_NAME}_api-test-data
fat_separator

if [ -f test_results/API_FAILED ]; then
    echo "ERROR: Some test cases failed."
    exit 1
fi

echo INFO: SUCCESS.
fat_separator

popd
