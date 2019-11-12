#!/bin/bash

echo Do not use this. It is outdated.
exit 1

export TMP_TEST=`mktemp -d -t portalapi.XXXXX`
cp -R test/test-config/* $TMP_TEST

export NODE_ENV=test
# echo $TMP_TEST
export PORTAL_API_STATIC_CONFIG=$TMP_TEST/static
export PORTAL_API_DYNAMIC_CONFIG=$TMP_TEST/dynamic
export PORTAL_API_URL=http://localhost:3001
export PORTAL_PORTAL_URL=http://localhost:3000
export PORTAL_KONG_ADAPTER_URL=http://localhost:3002
export PORTAL_KONG_ADMIN_URL=http://localhost:8001
export PORTAL_MAILER_URL=http://localhost:3003
export PORTAL_CHATBOT_URL=http://localhost:3004
# Speed up intervals for unit testing
export PORTAL_API_HOOK_INTERVAL=100
export PORTAL_API_AESKEY=ThisIsASecretSauceKeyWhichDoesNotMatterForTheUnitTests
export PORTAL_CONFIG_KEY=ThisIsUsedInDeploy

echo Starting API

# DEBUG=portal-api:* node bin/api &> unit_test.log &
# DEBUG=portal-api:* istanbul cover --handle-sigint bin/api &> $TEST_RESULTS./api_test.log &

export TEMP_API_PID=$!

# node ../portal-env/await.js $PORTAL_API_URL/ping

echo $1
echo Integration testing Portal API

if [ -n "$1" ]; then
    mocha --grep $1 || echo Failed > $TEST_RESULTS./api_test.failed
else
    mocha || echo Failed > $TEST_RESULTS./integration_tests_api.failed
fi

kill -2 $TEMP_API_PID

rm -rf $TMP_TEST
