#!/bin/bash

echo "Running as $(whoami)"
echo "Mocha version: $(mocha --version)"

node node_modules/portal-env/await.js http://portal-api:3001/ping

echo ""
echo "Directory ${pwd}"
echo "==================="
echo ""

ls -la

echo ""
echo "node_modules"
echo "============"
echo ""


ls -la node_modules

mkdir test_results
mocha > test_results/api-test.log || echo "Integration tests failed. See log. > test_results/API_FAILED"

echo "Trying to kill portal-api..."

curl -X POST http://portal-api:3001/kill

echo "Exiting."
