#!/bin/bash

echo Running as `whoami`

node node_modules/portal-env/await.js http://portal-api:3001/ping
node node_modules/portal-env/await.js http://portal:3000/ping

mkdir test_results
mocha > test_results/portal-test.log || echo Integration tests failed. See log. > test_results/PORTAL_FAILED 

echo Trying to kill portal...
curl -X POST http://portal:3000/kill
echo Trying to kill portal-api...
curl -X POST http://portal-api:3001/kill

echo Exiting.
