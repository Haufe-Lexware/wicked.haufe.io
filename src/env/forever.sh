#!/bin/sh

while :
do
    "$@"
    echo "============================="
    echo " Process exited - restarting"
    echo "============================="
done
