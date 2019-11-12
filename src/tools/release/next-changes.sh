#!/bin/bash

. ./_repos.sh

pushd $(dirname $0)/../..

for f in "wicked.haufe.io" \
	${repos}; do
  echo ""
  echo $f
  pushd $f > /dev/null
  git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr)%Creset' --abbrev-commit --date=relative master..next
  popd > /dev/null
done

popd
