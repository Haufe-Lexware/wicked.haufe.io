#!/bin/bash

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. ${DIR}/create-git-url.sh

runtimeEnv=$(uname)

echo "Running as $(whoami)."

if [ "$runtimeEnv" != "Linux" ] || [ ! -f /.dockerenv ]; then
    echo "Do not use this script in non-dockerized environments."
    echo "Detected non-Linux runtime $runtimeEnv, or /.dockerenv is not present."
    echo "Use 'node bin/api' or 'npm start'.'"
    exit 1
fi

# Infinite loop
while :
do
    if [ ! -z "$GIT_REPO" ]; then

        tmpDir=$(mktemp -d)

        echo "Cloning configuration repository from $GIT_REPO into $tmpDir..."
        pushd $tmpDir

        if [ ! -z "$GIT_BRANCH" ] && [ ! -z "$GIT_REVISION" ]; then
            echo "===================================================================================="
            echo "ERROR: GIT_REVISION and GIT_BRANCH are mutually exclusive (both are defined)!"
            echo "===================================================================================="
            exit 1
        fi

        # this will create and set the GIT_URL variable
        create_git_url $GIT_REPO $GIT_CREDENTIALS

        if [ -z "$GIT_BRANCH" ]; then
            echo "Checking out branch 'master'..."
            git clone ${GIT_URL} .
        else
            echo "Checking out branch '$GIT_BRANCH'..."
            git clone ${GIT_URL} --branch ${GIT_BRANCH} .
        fi

        if [ ! -z "$GIT_REVISION" ]; then
            echo "Checking out specific revision with SHA ${GIT_REVISION}..."
            git checkout $GIT_REVISION
        fi

        if [ ! -d "$tmpDir/static" ]; then
            echo "===================================================================================="
            echo "ERROR: Could not find directory 'static' in $tmpDir, wrong repository?"
            echo "===================================================================================="
            exit 1
        fi

        echo Adding metadata to static directory...
        git log -1 > static/last_commit
        git log -1 --format=%ci > static/build_date

        echo "Cleaning up old configuration (if applicable)"
        rm -rf /var/portal-api/static
        echo "Copying configuration to /var/portal-api/static"
        cp -R static /var/portal-api
        echo "Done."

        popd

        echo "Cleanining up temp dir."
        rm -rf $tmpDir

    else
        echo "Assuming /var/portal-api/static is prepopulated, not cloning configuration repo."
    fi

    echo "Setting owner of /var/portal-api to wicked:wicked"
    chown wicked:wicked $(find /var/portal-api | grep -v .snapshot)

    if [ ! -z "${MINIKUBE_IP}" ]; then
        echo "Adding minikube IP for ${PORTAL_NETWORK_PORTALHOST} and ${PORTAL_NETWORK_APIHOST} to /etc/hosts"
        echo ${MINIKUBE_IP} ${PORTAL_NETWORK_PORTALHOST} ${PORTAL_NETWORK_APIHOST} | tee -a /etc/hosts
    fi

    echo "Granting read/write rights to user 'wicked' for Swagger files..."
    chown -R wicked:wicked /usr/src/app/routes/internal_apis

    echo "Starting API, running as user 'wicked'..."

    # Use gosu/su-exec to start node as the user "wicked"
    gosu_command="gosu"
    if [[ -z "$(which gosu)" ]]; then
        gosu_command="su-exec"
    fi

    ${gosu_command} wicked node bin/api

    # Check for RELOAD_REQUESTED file; if this file is NOT present, the process has most
    # probably died, and this should be a full reload of the container (triggering a rescheduling
    # e.g. from Kubernetes). In case the file is present, the API process was told to trigger
    # a reload of the configuration, and this can be done nicely in this loop.
    if [ ! -f ./RELOAD_REQUESTED ]; then
        echo "ERROR: Process terminated in an uncontrolled way. NOT restarting."
        exit 1
    else
        echo "============================================================="
        echo " Process was terminated in order to reload the configuration"
        echo "============================================================="
    fi
done
