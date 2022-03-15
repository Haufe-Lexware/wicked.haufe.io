#!/usr/bin/dumb-init /bin/bash

set -e

add_local_group() {
    local gname; gname=${1:?add_local_group: parameter 'gname' required}
    local gid; gid=${2:?add_local_group: parameter 'gid' required}

    # No point in creating a new group when one with that gid already exists
    fgrep ":${gid}:" /etc/group >/dev/null && return 0

    # On alpine linux the command to add a group is /usr/sbin/addgroup
    if [[ -x /usr/sbin/addgroup ]]; then
        /usr/sbin/addgroup -g "$gid" "$gname"
    elif [[ -x /usr/sbin/groupadd ]]; then
        /usr/sbin/groupadd -r "$gname" -g "$gid"
    else
        echo "Don't know how to create local group $gname with id $gid"
    fi
}

add_local_user() {
    local uname; uname=${1:?add_local_user: parameter 'uname' required}
    local uid; uid=${2:?add_local_user: parameter 'uid' required}
    local gid; gid=${3:?add_local_user: parameter 'gid' required}

    # No point in creating a new user when one with that uid already exists
    fgrep ":${uid}:" /etc/passwd >/dev/null && return 0

    # On alpine linux the command to add a user is /usr/sbin/adduser
    if [[ -x /usr/sbin/adduser ]]; then
        local group; group="$(awk -F: "\$3 == $gid { print \$1 }" /etc/group)"
        /usr/sbin/adduser -u "$uid" -D -H -s /sbin/nologin -G "$group" "$uname"
    elif [[ -x /usr/sbin/useradd ]]; then
        /usr/sbin/useradd -r -g "$gid" -u "$uid" "$uname"
    else
        echo "Don't know how to create local user $uname with id $uid in group $gid"
    fi
}

# On Linux, you will potentially run into permission problems if
# you do not pass in LOCAL_UID and LOCAL_GID; in case you pass in
# these two variables, the kickstarter will run as a user having
# these numeric IDs for user id and group id.
startedNode=0
if [[ ! -z "${LOCAL_UID}" ]] && [[ ! -z "${LOCAL_GID}" ]]; then
    if [[ ! "${LOCAL_GID}" = "0" ]]; then
        echo "Adding group with GID ${LOCAL_GID}..."
        add_local_group usergroup "${LOCAL_GID}"
    fi
    # Running as root?
    if [[ ! "${LOCAL_UID}" = "0" ]]; then
        username="localuser"

        if [ ! "${LOCAL_UID}" = "1000" ]; then
            echo "Not running as root or user node..."
            echo "Creating user..."
            add_local_user "$username" "$LOCAL_UID" "$LOCAL_GID"
        else
            echo "Using predefined user 'node' (UID 1000)."
            username="node"
        fi
        echo "Running with UID ${LOCAL_UID} and GID ${LOCAL_GID}."
        echo "Local username: $username"
        startedNode=1
        # Use gosu/su-exec to start node as a different user
        gosu_command="gosu"
        if [[ -z "$(which gosu)" ]]; then
            gosu_command="su-exec"
        fi
        ${gosu_command} ${LOCAL_UID}:${LOCAL_GID} node bin/kickstart "$@"
    fi
fi


if (( startedNode == 0 )); then
    echo "Running kickstarter as root..."
    node bin/kickstart "$@"
fi
