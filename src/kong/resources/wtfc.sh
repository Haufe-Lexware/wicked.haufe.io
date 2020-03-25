#!/bin/sh

cmdname="${0##*/}"

VERSION=0.0.3

echoto() {
    # print to stderr or to stdout
    out=$1
    shift 1

    if ([ "${out}" -eq 2 ]); then
        printf "$@" >&2
    else
        # stdout can be silenced only
        if [ "${QUIET}" -eq 0 ]; then
            printf "$@"
        fi
    fi
}

progress() {
    if ([ "${PROGRESS}" -eq 1 ]); then
        echoto 1 "."
    fi
}

usage() {
    #  (TODO) -F, --format-progress=FORMAT  set FORMAT for progress, available: DOTS, PROGRESSBAR (default is DOTS)
    OUTPUT=`cat <<EOF
Usage: $cmdname [OPTION]... [COMMAND]
wtfc (WaiT For The Command) waits for the COMMAND provided as the last argument or via standard input to return within timeout with expected exit status.

Functional arguments:
  -I, --interval=SECONDS       set the check interval to SECONDS (default is 1)
  -S, --status=NUMBER          set the expected COMMAND exit status to NUMBER (default is 0)
  -T, --timeout=SECONDS        set the timeout to SECONDS (0 for no timeout, default is 1)

Logging and info arguments:
  -P, --progress               show progress (default is 0)
  -H, --help                   print this help and exit
  -Q, --quiet                  be quiet
  -V, --version                display the version of wtfc and exit.

Examples:
  ./wtfc.sh -T 1 -S 0 ls /tmp                   Waits for 1 second for 'ls /tmp' to execute with exit status 0
  echo "ls /foo/bar" | ./wtfc.sh -T 2 -S 2      Waits for 2 seconds for 'ls /foo/bar' to execute with exit status 2
EOF
`

    # print to stderr (for exit status > 0), otherwise to stdout
    if ([ "$1" -gt 0 ]); then
        echo "${OUTPUT}" >&2
    else
        echo "${OUTPUT}"
    fi

    exit $1
}

version() {
    echo "wtfc (WaiT For the Command) version: ${VERSION}"
    exit 0
}

wait_for(){
    if [ "${TIMEOUT}" -gt 0 ]; then
        echoto 1 "$cmdname: waiting $TIMEOUT seconds for $CMD\n"
    else
        echoto 1 "$cmdname: waiting without a timeout for $CMD\n"
    fi

    while :
    do
        eval $CMD >/dev/null 2>&1
        result=$?

        if ([ "${result}" -eq "${STATUS}" ]); then
            break
        fi
        sleep $INTERVAL

        progress
    done
    return $result
}

wait_for_wrapper() {
    TIME_START=$(date +%s)

    # In order to support SIGINT during timeout: http://unix.stackexchange.com/a/57692
    if ([ "${QUIET}" -eq 1 ]); then
        eval $TIMEOUT_CMD $TIMEOUT_FLAG $TIMEOUT $0 --quiet --child --status=$STATUS --timeout=$TIMEOUT $CMD &
    else
        eval $TIMEOUT_CMD $TIMEOUT_FLAG $TIMEOUT $0 --child --status=$STATUS --timeout=$TIMEOUT $CMD &
    fi
    PID=$!
    trap "kill -INT -$PID" INT

    while [ $(($(date +%s)-TIME_START)) -lt "${TIMEOUT}" ]; do

        eval $CMD >/dev/null 2>&1
        result=$?

        if ([ "${result}" -eq "${STATUS}" ]); then
            break
        fi

        sleep $INTERVAL

        progress
    done
    wait $PID
    RESULT=$?
    return $RESULT
}

# process arguments
while [ $# -gt 0 ]
do
    case "$1" in
        --child)
        CHILD=1
        shift 1
        ;;
        -H | --help)
        usage 0
        ;;
        -I)
        INTERVAL="$2"
        if [ -z "${INTERVAL}" ]; then break; fi
        shift 2
        ;;
        --interval=*)
        INTERVAL="${1#*=}"
        shift 1
        ;;
        -P | --progress)
        PROGRESS=1
        shift 1
        ;;
        -Q | --quiet)
        QUIET=1
        shift 1
        ;;
        -S)
        STATUS="$2"
        if [ -z "${STATUS}" ]; then break; fi
        shift 2
        ;;
        --status=*)
        STATUS="${1#*=}"
        shift 1
        ;;
        -T)
        TIMEOUT="$2"
        if [ -z "${TIMEOUT}" ]; then break; fi
        shift 2
        ;;
        --timeout=*)
        TIMEOUT="${1#*=}"
        shift 1
        ;;
        -V | --version)
        version
        ;;
        -*)
        echoto 2 "Unknown argument: $1"
        usage 1
        ;;
        *)
        CMD="$@"
        break
        ;;
    esac
done

# read from stdin, if no cmd provided
if [ -z "${CMD}" ]; then
    read CMD
fi

if [ -z "${CMD}" ]; then
    echoto 2 "Error: you need to provide a COMMAND to test as the last argument or via standard input.\n"
    usage 1
fi

CHILD=${CHILD:-0}
INTERVAL=${INTERVAL:-1}
PROGRESS=${PROGRESS:-0}
QUIET=${QUIET:-0}
STATUS=${STATUS:-0}
TIMEOUT=${TIMEOUT:-1}

# check to see if timeout is from busybox/alpine => '-t' switch is required or not
TIMEOUT_TEST="$(timeout 1 sleep 0 2>&1)"
case "${TIMEOUT_TEST}" in
    timeout:\ can\'t\ execute\ \'1\':*) TIMEOUT_FLAG="-t" ;;
    *) TIMEOUT_FLAG="" ;;
esac

TIMEOUT_TEST="$(timeout ${TIMEOUT_FLAG} 1 sleep 0 2>&1)"
TIMEOUT_TEST_STATUS="$?"

# fallback for osx (uses gtimeout)
if [ "${TIMEOUT_TEST_STATUS}" -eq 127 ]; then
    TIMEOUT_TEST="$(gtimeout ${TIMEOUT_FLAG} 1 sleep 0 2>&1)"
    TIMEOUT_TEST_STATUS="$?"

    if [ "${TIMEOUT_TEST_STATUS}" -eq 127 ]; then
        TIMEOUT_TEST="$(gnu-timeout ${TIMEOUT_FLAG} 1 sleep 0 2>&1)"
        TIMEOUT_TEST_STATUS="$?"

        if [ "${TIMEOUT_TEST_STATUS}" -eq 127 ]; then
            echoto 2 "timeout|gtimeout|gnu-timeout is required by the script, but not found!\n"
            exit 1
        fi
        TIMEOUT_CMD="gnu-timeout"
    else
        TIMEOUT_CMD="gtimeout"
    fi
else
    TIMEOUT_CMD="timeout"
fi

start_ts=$(date +%s)

if [ "${CHILD}" -eq 1 ]; then
    wait_for
    RESULT=$?
    exit $RESULT
else
    if [ "${TIMEOUT}" -gt 0 ]; then
        wait_for_wrapper
        RESULT=$?
    else
        wait_for
        RESULT=$?
    fi
fi

if [ "${RESULT}" -ne "${STATUS}" ]; then
    echoto 2 "$cmdname: timeout occurred after waiting $TIMEOUT seconds for $CMD to return status: $STATUS (was status: $RESULT)\n"
    if [ "${RESULT}" -eq 0 ]; then
        # exit with 1, inspite the fact original ended with 0 (as we expected non-0)
        exit 1
    else
        exit $RESULT
    fi
else
    end_ts=$(date +%s)
    echoto 1 "$cmdname: $CMD finished with expected status $RESULT after $((end_ts - start_ts)) seconds\n"
    exit 0
fi