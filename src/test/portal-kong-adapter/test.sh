#!/bin/bash

echo Running as `whoami`

echo Waiting for portal-api...
node node_modules/portal-env/await.js http://portal-api:3001/ping
echo Ping returned 200 for portal-api
echo Waiting for portal-kong-adapter...
node node_modules/portal-env/await.js http://portal-kong-adapter:3002/ping
echo Ping returned 200 for portal-kong-adapter

mkdir test_results
mocha > test_results/kong-adapter-test.log || echo Integration tests failed. See log. > test_results/KONG_FAILED 

echo Trying to kill portal-kong-adapter...

curl -X POST http://portal-kong-adapter:3002/kill

echo Trying to kill portal-api...

curl -X POST http://portal-api:3001/kill

sleep 2

echo Exiting.
