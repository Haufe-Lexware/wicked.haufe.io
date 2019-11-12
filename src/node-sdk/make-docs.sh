#!/bin/bash

set -e

if ! npm list --depth 1 --global typedoc > /dev/null 2>&1; then
    echo "INFO: typedoc is not installed, installing globally."
    npm install -g typedoc
else
    echo "INFO: typedoc is already installed. Excellent."
fi

rm -rf docs/*
typedoc --mode modules --out ./docs ./src

if [ ! -d ./docs-git ]; then
    mkdir -p docs-git
fi
if [ ! -d ./docs-git/wicked.node-sdk ]; then
    pushd docs-git
    git clone https://github.com/apim-haufe-io/wicked.node-sdk
    popd
fi

pushd docs-git/wicked.node-sdk
git checkout gh-pages
cp -R ../../docs/* .
git add .
git commit -m "Updated documentation."
git push
popd
