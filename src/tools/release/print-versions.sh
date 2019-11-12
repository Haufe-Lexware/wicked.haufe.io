#!/bin/bash

pushd $(dirname $0)/../..

for f in $(find . | grep -v node_modules | grep package.json); do 
  echo $f && cat $f | grep '"version"'
done

popd
