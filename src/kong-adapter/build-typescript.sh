#!/bin/bash

set -e

if [ -f ./node_modules/typescript/bin/tsc ]; then
    ./node_modules/typescript/bin/tsc
else
    tsc
fi

cp -f package.json ./dist
