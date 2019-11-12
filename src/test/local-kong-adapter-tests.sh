#!/bin/bash

set -e

# Use a custom port here to not haphazardly interfer with a running portal-api local
# instance. Which would not be good. Been there, done that (messes up your entire local
# environment).
apiPort=3401
if nc -z localhost ${apiPort}; then
    echo "*** ERROR: Port ${apiPort} is already open."
    exit 1
fi
echoPort=3409
if nc -z localhost ${echoPort}; then
    echo "*** ERROR: Port ${echoPort} is already open (echo server)."
    exit 1
fi
kongAdapterPort=3402
if nc -z localhost ${kongAdapterPort}; then
    echo "*** ERROR: Port ${kongAdapterPort} is already open (kong adapter)."
    exit 1
fi
kongAdminPort=8101
if nc -z localhost ${kongAdminPort}; then
    echo "*** ERROR: Port ${kongAdminPort} is already open (kong admin)."
    exit 1
fi
kongProxyPort=8100
if nc -z localhost ${kongProxyPort}; then
    echo "*** ERROR: Port ${kongProxyPort} is already open (kong proxy)."
    exit 1
fi
pgPort=7654
if nc -z localhost ${pgPort}; then
    echo "*** ERROR: Port ${pgPort} is already open (postgres)."
    exit 1
fi
redisPort=6479
if nc -z localhost ${redisPort}; then
    echo "*** ERROR: Port ${redisPort} is already open (redis)."
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
kongContainer=""
redisContainer=""
kongAdapterPid=""

function killthings() {
    if [ ! -z "${apiPid}" ]; then
        echo "===> Killing API"
        if ! kill ${apiPid} &> /dev/null; then
            echo "Apparently the API was already dead."
        fi
    fi
    if [ ! -z "${kongAdapterPid}" ]; then
        echo "===> Killing Kong Adapter"
        if ! kill ${kongAdapterPid} &> /dev/null; then
            echo "Apparently the Kong Adapter was already dead."
        fi
    fi
    if [ ! -z "$kongContainer" ]; then
        echo "===> Killing Kong container"
        docker rm -f ${kongContainer}
    fi
    if [ ! -z "$pgContainer" ]; then
        echo "===> Killing Postgres container"
        docker rm -f ${pgContainer}
    fi
    if [ ! -z "$redisContainer" ]; then
        echo "===> Killing Redis container"
        docker rm -f ${redisContainer}
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


cp -r ./portal-kong-adapter/test/test-config/static ./tmp/$tmpDir/static
mkdir -p ./tmp/$tmpDir/dynamic

export PORTAL_API_HOOK_INTERVAL=250
export PORTAL_API_AESKEY=ThisIsASecretSauceKeyWhichDoesNotMatterForTheUnitTests
export PORTAL_CONFIG_KEY=c2fcfe392235d6492990b62165462078dee88b96
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
export PORTAL_KONG_ADAPTER_URL=http://localhost:${kongAdapterPort}
export PORTAL_KONG_ADMIN_URL=http://localhost:${kongAdminPort}
export PORTAL_NETWORK_APIHOST=localhost:${kongProxyPort}
export PORTAL_MAILER_URL=http://localhost:3003
export PORTAL_CHATBOT_URL=http://localhost:3004
export ECHO_PORT=${echoPort}

# export KONG_PROXY_LISTEN="0.0.0.0:${kongProxyPort}"
# export KONG_ADMIN_LISTEN="0.0.0.0:${kongAdminPort}"

# export HOOK_PORT=3111
# export HOOK_HOST=localhost

mode=""
grepFilter=""
onlyEnv=""
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
        "--only-env")
            onlyEnv="$1"
            echo "Only setting up environment."
            ;;
    esac
    shift 1
done

if [[ -z "${mode}" ]]; then
    echo "Usage: $0 <--json|--postgres> [--grep <filter>] [--only-env]"
    exit 1
fi

if [[ $mode == json ]]; then
    echo "=== JSON mode"
    export WICKED_STORAGE=json
else 
    echo "=== Postgres mode"
    export WICKED_STORAGE=postgres
fi

echo "INFO: Starting postgres..."
pgContainer=${tmpDir}_pg
docker run -d --name ${pgContainer} -p ${pgPort}:5432 -e POSTGRES_USER=kong -e POSTGRES_PASSWORD=kong postgres:11-alpine &> /dev/null

echo "INFO: Starting Kong..."
kongContainer=${tmpDir}_kong
docker run -d --name ${kongContainer} -p ${kongProxyPort}:8000 -p ${kongAdminPort}:8001 \
    -e KONG_PG_USER=kong -e KONG_PG_PASSWORD=kong -e KONG_PG_HOST=pg \
    --link ${pgContainer}:pg wicked.kong:local &> /dev/null

echo "INFO: Starting redis..."
redisContainer=${tmpDir}_redis
docker run -d --name ${redisContainer} -p ${redisPort}:6379 redis:5-alpine &> /dev/null

echo "INFO: Starting portal API..."
pushd ../wicked.api &> /dev/null
PORT=${apiPort} node bin/api &> ${thisDir}/logs/kong-adapter-test-local-api.log &
apiPid=$!
echo "INFO: API running as PID ${apiPid}."
popd &> /dev/null

echo "INFO: Building Kong Adapter..."
pushd ../wicked.kong-adapter &> /dev/null
npm run build &> /dev/null
echo "INFO: Starting Kong Adapter..."
DEBUG=wicked-sdk PORT=${kongAdapterPort} node ./dist/bin/kong-adapter.js &> ${thisDir}/logs/kong-adapter-test-local-kong-adapter.log &
kongAdapterPid=$!
echo "INFO: Kong Adapter running as PID ${kongAdapterPid}."
popd &> /dev/null

pushd portal-kong-adapter &> /dev/null

rm -f ./kill-env.sh
cat << EOF > ./kill-env.sh
#!/bin/bash

echo "Killing Kong Adapter..."
kill $kongAdapterPid
echo "Killing Portal API..."
kill $apiPid

echo "Killing docker containers..."
docker rm -f $redisContainer $kongContainer $pgContainer
EOF

chmod +x ./kill-env.sh

node node_modules/portal-env/await.js http://localhost:${apiPort}/ping
node node_modules/portal-env/await.js http://localhost:${kongAdapterPort}/ping

if [[ -z "$onlyEnv" ]]; then
    export PORTAL_API_URL=http://localhost:3401
    export KONG_ADAPTER_URL=http://localhost:3402
    export KONG_ADMIN_URL=http://localhost:8101
    export KONG_GATEWAY_URL=http://localhost:8100
    if [[ -z "$grepFilter" ]]; then
        mocha
    else
        mocha --grep "${grepFilter}"
    fi
    popd &> /dev/null

    docker logs ${kongContainer} &> ${thisDir}/logs/kong-adapter-test-local-kong.log

    killthings
else
    echo "INFO: Leaving environment open; go into the portal-kong-adapter directory and run"
    echo ""
    echo "      export PORTAL_API_URL=http://localhost:3401"
    echo "      export KONG_ADAPTER_URL=http://localhost:3402"
    echo "      export KONG_ADMIN_URL=http://localhost:8101"
    echo "      export KONG_GATEWAY_URL=http://localhost:8100"
    echo "      mocha"
    echo ""
    echo "      You can then use the ./kill-env.sh to kill the testing environment."
fi
