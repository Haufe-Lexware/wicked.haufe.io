#!/bin/bash

set -e

if [ -z ${DOCKER_REGISTRY_USER} ] || [ -z ${DOCKER_REGISTRY_PASSWORD} ]; then
    echo "ERROR: DOCKER_REGISTRY_USER and/or DOCKER_REGISTRY_PASSWORD is not defined."
    exit 1
fi

echo "INFO: Using docker username ${DOCKER_REGISTRY_USER}."
docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD}

if [[ ! -z ${BRANCH_NAME} ]]; then
    branch=${BRANCH_NAME}
    echo "INFO: Taking branch name from Jenkins: ${branch}"
else
    branch=$(git rev-parse --abbrev-ref HEAD)
    echo "INFO: Using current git branch: ${branch}"
fi
export TAG=${branch}
if [ ! -z "${DOCKER_TAG}" ]; then
    echo "INFO: Using tag ${DOCKER_TAG} instead of branch ${branch}"
    export TAG=${DOCKER_TAG}
fi

echo "======================================================"
echo "PUSHING BRANCH ${branch} / tag ${TAG}"
echo "======================================================"
echo ""

access_token=$(curl -s -H 'Content-Type: application/json' -d "{\"username\":\"${DOCKER_REGISTRY_USER}\",\"password\":\"${DOCKER_REGISTRY_PASSWORD}\"}" https://hub.docker.com/v2/users/login/ | jq .token | tr -d '"')

this_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

pushd ${this_dir}
source ./tools/release/_repos.sh

function check_image {
    image=$1
    imageTag=$2

    echo "INFO: Checking image haufelexware/wicked.${image}..."
    repo_digests=$(docker inspect wicked.${image} | jq .[0].RepoDigests)
    if [[ "$repo_digests" == "[]" ]]; then
        echo "INFO: Image has not been pushed."
        local_digest="<not available>"
    else
        local_digest=$(echo $repo_digests | jq .[0] | tr -d '"' | cut -d '@' -f 2)
    fi
    echo "INFO: Local digest: ${local_digest}"
    remote_response=$(curl -s -L -H "Authorization: JWT ${access_token}" https://hub.docker.com/v2/repositories/haufelexware/wicked.${i}/tags/${imageTag})
    errinfo=$(echo ${remote_response} | jq .errinfo)
    needs_push=""
    if [[ ${errinfo} == null ]]; then
        # Image is present; check it
        remote_digest=$(echo ${remote_response} | jq .images[0].digest | tr -d '"')
        echo "Remote SHA256: ${remote_digest}"
        if [[ ${local_digest} != ${remote_digest} ]]; then
            echo "INFO: Digests differ, will push."
            needs_push="true"
        else
            echo "INFO: Images are identical, will not push."
        fi
    else
        echo "WARNING: There was an error while checking the image remotely. Assuming it was not found."
        echo "${errinfo}"
        needs_push="true"
    fi

    if [[ ${needs_push} == true ]]; then
        echo "Pushing ${image}..."
        docker tag wicked.${image} haufelexware/wicked.${image}
        docker push haufelexware/wicked.${image}
    fi
}

for i in ${imageBases}; do
    if [[ $i != box ]]; then
        suffix=""
        if [[ $i == env ]]; then
            suffix="-onbuild"
        fi
        imageTag=${TAG}${suffix}
        image=${i}:${imageTag}

        check_image ${image} ${imageTag}
    fi
done

for i in ${alpineImageBases}; do
    if [[ $i != box ]]; then
        suffix="-alpine"
        if [[ $i == env ]]; then
            suffix="-onbuild-alpine"
        fi
        imageTag=${TAG}${suffix}
        image=${i}:${imageTag}

        check_image ${image} ${imageTag}
    fi
done

popd
