#!/bin/bash

echo "========================================"
echo "$0"
echo "========================================"

set -e

if [[ -z "${SP_APPID}" ]] || [[ -z "${SP_PASSWORD}" ]] || [[ -z "${TENANTID}" ]] || [[ -z "${SUBSCRIPTION_ID}" ]]; then
    cat << EOF
ERROR: The following env vars must be set before trying this out:
- SP_APPID
- SP_PASSWORD
- TENANTID
- SUBSCRIPTION_ID
EOF
fi

az login --service-principal -u ${SP_APPID} -p ${SP_PASSWORD} -t ${TENANTID}
az account set -s ${SUBSCRIPTION_ID}

export LOCATION=westeurope
echo "Using location ${LOCATION}"
export K8S_VERSION=1.9.6

if [[ "false" == "$(az group exists -n ${RESOURCE_GROUP})" ]]; then
    echo "Creating resource group ${RESOURCE_GROUP}"
    az group create -l ${LOCATION} -n ${RESOURCE_GROUP}
else
    echo "Resource group ${RESOURCE_GROUP} already exists."
fi

cp ~/.ssh/id_rsa ./azureuser.id_rsa
cp ~/.ssh/id_rsa.pub ./azureuser.id_rsa.pub

set -x
az aks create --name ${RESOURCE_GROUP} \
    --resource-group ${RESOURCE_GROUP} \
    --service-principal ${SP_APPID} \
    --client-secret ${SP_PASSWORD} \
    --admin-username azureuser \
    --kubernetes-version ${K8S_VERSION} \
    --location ${LOCATION} \
    --node-count 1 \
    --node-vm-size Standard_DS1_v2 \
    --ssh-key-value ./azureuser.id_rsa.pub
az aks get-credentials --name ${RESOURCE_GROUP} \
    --resource-group ${RESOURCE_GROUP} \
    --file ./kubeconfig-${RESOURCE_GROUP}
set +x
