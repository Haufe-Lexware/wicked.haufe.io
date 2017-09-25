#!/bin/bash

set -e

latestVersion=$(curl -Ls https://api.github.com/repos/Haufe-Lexware/wicked.haufe.io/releases/latest | grep tag_name | cut -d '"' -f 4 | tr -d v)

echo "INFO: Latest release is v${latestVersion}."
echo "INFO: Downloading Helm Chart..."

helm fetch --untar https://github.com/Haufe-Lexware/wicked.haufe.io/releases/download/v${latestVersion}/wicked-${latestVersion}.tgz

echo "INFO: Helm Chart has been downloaded into directory 'wicked'."
