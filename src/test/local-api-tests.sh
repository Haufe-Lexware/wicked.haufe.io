#!/bin/bash

set -e

# Use a custom port here to not haphazardly interfer with a running portal-api local
# instance. Which would not be good. Been there, done that (messes up your entire local
# environment).
apiPort=3301
if nc -z localhost ${apiPort}; then
    echo "*** ERROR: Port ${apiPort} is already open."
    exit 1
fi
echoPort=3309
if nc -z localhost ${echoPort}; then
    echo "*** ERROR: Port ${echoPost} is already open (echo server)."
    exit 1
fi

tmpDir=test-$(date +%Y%m%d%H%M%S)
mkdir -p ./tmp/$tmpDir
baseDir=$(pwd)/tmp/$tmpDir
thisDir=$(pwd)

echo "Test dir: $baseDir"

trap traperror ERR

apiPid=""
pgContainer=""

function killthings() {
    if [ ! -z "$apiPid" ]; then
        echo "===> Killing API"
        if ! kill $apiPid; then
            echo "Apparently the API was already dead."
        fi
    fi
    if [ ! -z "$pgContainer" ]; then
        echo "===> Killing Postgres container"
        docker rm -f $pgContainer
    fi
}
function traperror() {
    echo "*********************************"
    echo "Oh sh... killing all the things"
    echo "*********************************"

    killthings

    exit 1
}

function waitFor() {
    x=$3
    while ! nc -z "$1" "$2";
    do
        sleep 1
        echo "Waiting for ${1}:${2} for ${x} times"
        x=$((x-1))
        if [[ x -le 0 ]];
        then
            return 1 ## return failure
        fi
    done

    return 0 ## return success
}


cp -r ./portal-api/test/test-config/static ./tmp/$tmpDir/static
mkdir -p ./tmp/$tmpDir/dynamic

export PORTAL_API_HOOK_INTERVAL=250
export PORTAL_API_AESKEY=ThisIsASecretSauceKeyWhichDoesNotMatterForTheUnitTests
export PORTAL_CONFIG_KEY=ThisIsUsedInDeploy
export DEBUG=portal-api:*,portal:*,kong-adapter:*,portal-env:*
export ALLOW_KILL=true
export ALLOW_RESYNC=true
export PORTAL_CONFIG_BASE=$baseDir 
export PORTAL_API_STATIC_CONFIG=$baseDir/static
export PORTAL_API_DYNAMIC_CONFIG=$baseDir/dynamic
export NODE_ENV=test
export LOG_LEVEL=debug
# Do not log in JSON
export LOG_PLAIN=true

export SWAGGER_RESOURCE_URL=http://localhost:8080
export PORTAL_API_URL=http://localhost:${apiPort}
export PORTAL_PORTAL_URL=http://localhost:3000
export PORTAL_KONG_ADAPTER_URL=http://localhost:3002
export PORTAL_KONG_ADMIN_URL=http://localhost:8001
export PORTAL_MAILER_URL=http://localhost:3003
export PORTAL_CHATBOT_URL=http://localhost:3004
export ECHO_PORT=${echoPort}

export HOOK_PORT=3111
export HOOK_HOST=localhost

mode=""
grepFilter=""
while [[ -n "$1" ]]; do
    case "$1" in
        "--json")
            mode="json"
            ;;
        "--postgres")
            mode="postgres"
            ;;
        "--grep")
            shift 1
            grepFilter="$1"
            echo "Filtering test cases for '${grepFilter}'"
            ;;
    esac
    shift 1
done

if [[ -z "${mode}" ]]; then
    echo "Usage: $0 <--json|--postgres> [--grep <filter>]"
    exit 1
fi

if [[ $mode == json ]]; then
    echo "=== JSON mode"
    export WICKED_STORAGE=json
else 
    echo "=== Postgres mode"
    docker run -d --name $tmpDir -p 6543:5432 -e POSTGRES_USER=kong -e POSTGRES_PASSWORD=kong postgres:11-alpine
    pgContainer=$tmpDir
    # portal-api will wait for itself until Postgres is available,
    # no need to do that from bash. We'll just give it a couple of seconds
    # to gather itself.
    sleep 10
    export WICKED_STORAGE=postgres
fi

pushd ../wicked.api
PORT=${apiPort} node bin/api &> ${thisDir}/logs/api-test-local.log &
apiPid=$!
popd

pushd portal-api
node node_modules/portal-env/await.js http://localhost:${apiPort}/ping
if [[ -z "$grepFilter" ]]; then
    mocha
else
    mocha --grep "${grepFilter}"
fi
popd

killthings
