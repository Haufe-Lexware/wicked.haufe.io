#!/bin/bash

if [[ "$1" == "--help" ]]; then
	echo "Usage: $0 (--docs|--check|--merge)"
	echo "  --docs: Merge wicked.haufe.io docs from next to master"
	echo "  --merge: After checking repositories, merge from next to master"
	exit 1
fi

. ./_repos.sh

pushd $(dirname $0)/../..

set -e

if [ ! "$1" = "--docs" ]; then

	echo "==============================="
	echo "Checking package.all.json"
	echo "==============================="

	pushd wicked.env > /dev/null
	node assemble-packages.js
	popd > /dev/null

	echo "==============================="
	echo "Checking status of repositories"
	echo "==============================="

	allClean=true
	for f in ${repos} wicked.haufe.io wicked.node-sdk; do
		echo "=====> $f"
		pushd $f > /dev/null
		gitStatus="$(git status -s)"
		if [ ! -z "$gitStatus" ]; then
			echo "ERROR: Repository $f has an unclean status:"
			git status
			allClean=false
		fi
		gitCherry="$(git cherry -v)"
		if [ ! -z "$gitCherry" ]; then
			echo "ERROR: Repository $f has un-pushed commits."
			git cherry -v
			allClean=false
		fi
		popd > /dev/null
	done

	if [[ $allClean != true ]]; then
		echo "ERROR: Unclean repositories found, exiting."
		exit 1
	fi

	if [[ "$1" == "--merge" ]]; then
		echo "==============================="
		echo "Merging next to master"
		echo "==============================="

		for f in ${repos} wicked.node-sdk; do
			echo "=====> $f"
			pushd $f && git checkout master && git pull && git merge -m "Merge branch next to master" next && git push && git checkout next && popd
			echo ""
		done
	else
		echo "==============================="
		echo "Parameter '--merge' was not specified, not merging."
		echo "To merge from next to master, run"
		echo "$0 --merge"
		echo "==============================="
	fi
else
	echo "==============================="
  echo "Merging wicked.haufe.io docs next -> master"
	echo "==============================="
  pushd wicked.haufe.io && git checkout master && git merge -m "Merge branch next to master" next && git push && git checkout next && popd
fi

popd
