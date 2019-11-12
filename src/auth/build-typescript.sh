#!/bin/bash

set -e

if [ -f ./node_modules/typescript/bin/tsc ]; then
    ./node_modules/typescript/bin/tsc
else
    tsc
fi

cp -f package.json ./dist

rm -rf ./dist/views
cp -rf ./src/views ./dist
cp -f package.json ./dist
rm -rf ./dist/assets
mkdir -p ./dist/assets/jquery
mkdir -p ./dist/assets/bootstrap
cp -rf ./node_modules/bootstrap/dist ./dist/assets/bootstrap
cp -rf ./node_modules/jquery/dist ./dist/assets/jquery

node dist/tools/check-translations.js
