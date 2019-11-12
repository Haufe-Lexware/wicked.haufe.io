#!/usr/bin/env bash

create_git_url () {
    repo=$1
    credentials=$2
    protocol="https"

    # The protocol is optional. But when one was provided we have to respect it.
    # Otherwise we will fall back to https.
    if [[ ${repo} =~ ^https?:// ]]; then
        protocol=${repo%%:\/\/*}
        repo=${repo/#http*:\/\//}
    fi

    if [ ! -z ${credentials} ]; then
        GIT_URL=${protocol}://${credentials}@${repo}
    else
        echo "Assuming public repository, GIT_CREDENTIALS is empty"
        GIT_URL=${protocol}://${repo}
    fi

}