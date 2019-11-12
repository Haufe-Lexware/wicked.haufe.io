#!/bin/bash

echo "========================================"
echo "$0"
echo "========================================"

set -e

if [[ -z "$RESOURCE_GROUP" ]]; then
    echo "ERROR: Env var RESOURCE_GROUP must be set."
    exit 1
fi

if [[ -z "$DNS_ZONE" ]] || [[ -z "$DNS_RESOURCE_GROUP" ]]; then
    echo "ERROR: Env vars DNS_ZONE and DNS_RESOURCE_GROUP must be set."
    exit 1
fi

export KUBECONFIG=./kubeconfig-${RESOURCE_GROUP}

ip_found=false
lb_ip=""
while [[ -z "${lb_ip}" ]]; do
    echo "checking load balancer ip..."
    lb_ip=$(kubectl get svc ic-nginx-ingress-controller -ojsonpath='{.status.loadBalancer.ingress[0].ip}')
    [[ -z "${lb_ip}" ]] && sleep 10 || echo "ip found!"
done

echo "load balancer IP: ${lb_ip}"

set -x
for d in api portal; do
    az network dns record-set a delete --name ${d}.${RESOURCE_GROUP} --resource-group ${DNS_RESOURCE_GROUP} --zone-name ${DNS_ZONE} --yes
    az network dns record-set a add-record --ipv4-address ${lb_ip} --record-set-name ${d}.${RESOURCE_GROUP} --resource-group ${DNS_RESOURCE_GROUP} --zone-name ${DNS_ZONE}
done
set +x
