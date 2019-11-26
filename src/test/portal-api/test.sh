#!/bin/bash

echo Running as `whoami`

node node_modules/portal-env/await.js http://portal-api:3001/ping

mkdir test_results
mocha > test_results/api-test.log || echo Integration tests failed. See log. > test_results/API_FAILED 

echo Trying to kill portal-api...

curl -X POST http://portal-api:3001/kill

echo Exiting.
