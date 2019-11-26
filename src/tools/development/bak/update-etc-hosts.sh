 #!/bin/bash

echo "ERROR: It shouldn't be necessary to call this anymore."
exit 1

if [ "$(whoami)" != "root" ]; then
    echo "ERROR: This script must run as root to modify /etc/hosts:"
    echo "  sudo $0"
    exit 1
fi

# # https://stackoverflow.com/questions/13322485/how-to-get-the-primary-ip-address-of-the-local-machine-on-linux-and-os-x
# localIP=$(ifconfig | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p' | tail -1)
nodeBin=$(which node)
if [ -z "${nodeBin}" ]; then
    if [ -z "$1" ]; then
        echo "Could not find 'node' binary; pass in path to node (NVM_BIN) to script, like this:"
        echo "  sudo $0 \$NVM_BIN"
        exit 1
    fi
    nodeBin=$1/node
    echo "INFO: Using node binary at $nodeBin"
fi

localIP=$(${nodeBin} js/get-local-ips.js)
if [ -z "$localIP" ]; then
    echo "ERROR: ifconfig did not return a valid IPv4 address for your system."
    echo "       Please connect to a network and try again."
    exit 1
fi

echo "=========================================="
echo "Local IPv4 address: ${localIP}"

if [ "$(uname)" = "Darwin" ]; then
    sed -i '' '/portal./d' /etc/hosts
else
    sed -i '/portal./d' /etc/hosts
fi
echo "${localIP}    portal.local" >> /etc/hosts
echo "${localIP}    api.portal.local" >> /etc/hosts
echo "${localIP}    portal.com" >> /etc/hosts
echo "${localIP}    api.portal.com" >> /etc/hosts
echo "=========================================="
echo "Content of /etc/hosts:"
echo "=========================================="

cat /etc/hosts

echo "=========================================="
