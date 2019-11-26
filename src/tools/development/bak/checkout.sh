#!/bin/bash

echo "INFO: This script is not needed anymore. Please just use ./install.sh"
exit 1

echo "=========================="
echo "START: $0"
echo "=========================="

set -e

currentDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

expectedNodeVersion="10"
expectedNpmVersion="6"

trap failure ERR

function failure {
    echo "=========================="
    echo "ERROR: An error occurred, script exiting."
    echo "       If this happened during an npm install, consider using the --kill-package-lock option."
    echo "=========================="
}

doInfo=false
doLongInfo=false
if [[ $1 == --info ]] || [[ $1 == --status ]]; then
    doInfo=true
    if [[ $2 == --long ]]; then
        doLongInfo=true
    fi
else
    echo $1

    if [[ -z "$1" ]] || [[ $1 =~ ^--* ]]; then

        echo "Usage: $0 <branch> [--pull] [--install] [<other options>]" #  [--create]
        echo "  The script checks whether the wicked repositories exist parallel to this repository (../..),"
        echo "  and checks out the given branch. It will only do that if there are no open changes, and/or there"
        echo "  are no unpushed or uncommitted changes."
        echo ""
        echo "Options:"
        echo "  --info [--long] Just print branch information and quit (alias: --status)."
        echo "  --pull    Also pull the latest changes from the origin."
        echo "  --install Install wicked SDK, env and node_modules into the repositories"
        echo "  --fallback <branch>"
        echo "            Specify a fallback branch, in case the main branch is not present for a repository"
        echo "  --kill-package-lock Delete package-lock.json prior to running npm install (may fix install issues) (DEFAULT)"
        echo "  --no-kill-package-lock DO NOT Delete package-lock.json prior to running npm install"
        echo ""
        echo "Usage (2): $0 --status" #  [--create]
        echo "  Prints a list of the current status (branch, dirty, status, missing pushes) and exits."
        exit 1
    fi
fi

branch=$1
doPull=false
doCreate=false
doInstall=false
ignoreVersions=false
manualFallbackBranch=""
killPackageLock=true
if [[ ${doInfo} == false ]]; then
    shift 1
    while [[ ! -z "$1" ]]; do
        case "$1" in
            "--info")
                echo "ERROR: If you supply a branch, --info is not supported."
                exit 1
                ;;
            "--status")
                echo "ERROR: If you supply a branch, --status is not supported."
                exit 1
                ;;
            "--pull")
                doPull=true
                echo "INFO: Will try pull all repositories."
                ;;
            # "--create")
            #     echo "INFO: Will create branch in all repositories if not already present."
            #     doCreate=true
            #     ;;
            "--install")
                doInstall=true
                echo "INFO: Will run an npm install on JavaScript repos afterwards"
                ;;
            "--ignore-versions")
                ignoreVersions=true
                echo "INFO: Will ignore node/npm version mismatches."
                ;;
            "--fallback")
                shift 1
                manualFallbackBranch="$1"
                echo "INFO: Using manual fallback branch ${manualFallbackBranch}"
                ;;
            "--kill-package-lock")
                killPackageLock=true
                echo "INFO/WARN: Killing package-lock.json prior to running npm install."
                ;;
            "--no-kill-package-lock")
                killPackageLock=false
                echo "INFO/WARN: NOT Killing package-lock.json prior to running npm install."
                ;;
            *)
                echo "ERROR: Unknown option: $1"
                exit 1
                ;;
        esac
        shift 1
    done

    # Sanity check node and npm
    nodeVersion=$(node -v)
    npmVersion=$(npm -v)
    if [[ ${nodeVersion} =~ ^v${expectedNodeVersion}\.* ]]; then
        echo "INFO: Detected node ${nodeVersion}, this is fine."
    else
        if [[ ${ignoreVersions} == false ]]; then
            echo "ERROR: wicked assumes node ${expectedNodeVersion}, you are running ${nodeVersion}."
            echo "To ignore this, use the --ignore-versions option."
            exit 1
        else
            echo "WARNING: wicked assumes node ${expectedNodeVersion}, you are running ${nodeVersion}, ignoring due to --ignore-versions."
        fi
    fi
    if [[ ${npmVersion} =~ ^${expectedNpmVersion}\.* ]]; then
        echo "INFO: Detected npm v${npmVersion}, this is fine."
    else
        if [[ ${ignoreVersions} == false ]]; then
            echo "ERROR: wicked assumes npm ${expectedNpmVersion}, you are running npm ${npmVersion}."
            echo "To ignore this, use the --ignore-versions option."
            exit 1
        else
            echo "WARNING: wicked assumes npm ${expectedNpmVersion}, you are running npm ${npmVersion}, ignoring due to --ignore-versions."
        fi
    fi
fi

if ! ${doInstall} && ${killPackageLock}; then
    # Kill package lock only has an impact if "--install" is also specified.
    killPackageLock=false
fi

baseUrl="https://github.com/apim-haufe-io/"

pushd ${currentDir} > /dev/null
. ../release/_repos.sh
pushd ../../ > /dev/null

function cloneRepo {
    echo "=====================" >> ./wicked.tools/development/git-clone.log
    echo "Cloning repo $1" >> ./wicked.tools/development/git-clone.log
    echo "=====================" >> ./wicked.tools/development/git-clone.log
    git clone "${baseUrl}$1" >> ./wicked.tools/git-clone.log
}

function hasBranch {
    local testBranch; testBranch=$1
    if [ -z "$(git branch -r | sed 's/^..//' | grep origin/${testBranch})" ]; then
        return 1
    fi
    return 0
}

function resolveBranch {
    local testBranch; testBranch=$1
    local fallback1; fallback1=${manualFallbackBranch}
    local fallback2; fallback2=next
    local fallback3; fallback3=master
    if hasBranch ${testBranch}; then
        echo ${testBranch}
        return 0
    elif [[ -n "${fallback1}" ]] && hasBranch ${fallback1}; then
        echo ${fallback1}
        return 0
    elif hasBranch ${fallback2}; then
        echo ${fallback2}
        return 0
    elif hasBranch ${fallback3}; then
        echo ${fallback3}
        return 0
    fi
    return 1
}

function checkoutBranch {
    thisRepo=$1
    inputBranchName=$2
    pushd ${thisRepo} > /dev/null

    local branchName gitStatus gitCherry currentBranch

    git fetch

    # Check if branch is present
    branchName=$(resolveBranch ${inputBranchName})
    if [[ ${branchName} != ${inputBranchName} ]]; then
        echo "WARNING: Repository ${repo} doesn't have branch ${inputBranchName}, falling back to ${branchName}."
    fi
    currentBranch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "${currentBranch}" == "${branchName}" ]]; then
        echo "INFO: Current branch in repository ${repo} already is ${branchName}."
    else
        echo "INFO: Attempting to switch branch to ${branchName} in repository ${repo}"
        gitStatus="$(git status -s)"
        if [ ! -z "${gitStatus}" ]; then
            echo "ERROR: Repository ${thisRepo} has an unclean status:"
            echo "${gitStatus}"
            return 1
        fi
        gitCherry="$(git cherry -v)"
        if [ ! -z "${gitCherry}" ]; then
            echo "ERROR: Repository ${thisRepo} has unpushed commits:"
            echo "${gitCherry}"
            return 1
        fi
        git checkout ${branchName}
        echo "INFO: Success, ${thisRepo} is now at branch ${branchName}"
    fi

    [[ ${doPull} == true ]] && git pull

    popd > /dev/null
    return 0
}

function printBranchInfo {
    local thisRepo currentBranch isDirty needsPush
    thisRepo=$1
    if [ ! -d $thisRepo ]; then
        echo "WARNING: Could not find repository ${thisRepo}, has it been cloned?"
    else
        pushd ${thisRepo} > /dev/null
        currentBranch=$(git rev-parse --abbrev-ref HEAD)
        gitOtherStatus=$(git status -s | grep -v package-lock || :)
        isDirty=""
        needsPush=""
        if [ -n "${gitOtherStatus}" ]; then isDirty=Yes; fi
        if [ -n "$(git cherry -v)" ]; then needsPush=Yes; fi
        printf "%-30s %-20s %-8s %-10s %-10s\n" "${thisRepo}" "${currentBranch}" "${isDirty}" "${needsPush}"
        popd > /dev/null
    fi
}

function printGitStatus {
    local thisRepo currentBranch isDirty needsPush
    thisRepo=$1
    if [ ! -d $thisRepo ]; then
        echo "WARNING: Could not find repository ${thisRepo}, has it been cloned?"
    else
        pushd ${thisRepo} > /dev/null
        echo "--------------"
        echo "Repository: ${thisRepo}"
        # echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
        isDirty=$(git status -s)
        needsPush=$(git cherry -v)
        if [ -n "${isDirty}" ]; then
            echo "git status -s:"
            echo "${isDirty}"
        fi
        if [ -n "${needsPush}" ]; then
            echo "git cherry -v:"
            echo "${needsPush}"
        fi
        if [ -z "${isDirty}" ] && [ -z "${needsPush}" ]; then
            echo "CLEAN!"
        fi
        popd > /dev/null
    fi
}

function runNpmInstall {
    thisRepo=$1
    pushd ${thisRepo} > /dev/null
    echo "INFO: Running npm install for repository ${thisRepo}"
    if ${killPackageLock}; then
        if [ -f ./package-lock.json ]; then
            echo "WARN: Deleting package-lock.json first (due to --kill-package-lock)"
            rm -f ./package-lock.json
        fi
    fi
    npm install > /dev/null
    popd > /dev/null
}

if [[ ${doInfo} == false ]]; then
    for repo in ${sourceRepos}; do
        if [ ! -d ${repo} ]; then
            # Repo doesn't exist already
            cloneRepo ${repo}
        fi
        checkoutBranch ${repo} ${branch}
    done
else
    echo ""
    printf "%-30s %-20s %-8s %-10s %-10s\n" "Repository" "Branch" "Dirty" "Needs push"
    echo "------------------------------------------------------------------------------------"
    for repo in ${sourceRepos}; do
        printBranchInfo ${repo}
    done
    echo "------------------------------------------------------------------------------------"
    echo ""

    if [[ ${doLongInfo} == true ]]; then
        for repo in ${sourceRepos}; do
            printGitStatus ${repo}
        done
    fi

    echo "------------------------------------------------------------------------------------"
    echo ""
fi

if [[ ${doInstall} == true ]]; then
    runNpmInstall wicked.env
    # Add the wicked.node-sdk to where it needs to be
    ./wicked.node-sdk/install-local-sdk.sh --copy
    # Add the env package
    ./wicked.env/local-update-portal-env.sh --copy
    for repo in ${versionDirs}; do
        if [[ ${repo} != wicked.env ]]; then
            runNpmInstall ${repo}
        fi
    done
fi

popd > /dev/null # ../..
popd > /dev/null # ${currentDir}

echo "=========================="
echo "SUCCESS: $0"
echo "=========================="
