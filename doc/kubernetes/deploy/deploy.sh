#!/bin/bash

set -e

echo "================================================="
echo "Validating environment..."

if [ -z "$GIT_REPO" ]; then
    echo "ERROR: GIT_REPO is not set. GIT_REPO has to be set to the repository"
    echo "containing the API configuration (static folder)."
    echo ""
    echo "Exiting."
    exit 1
fi

if [ -z "$GIT_CREDENTIALS" ]; then
    echo "WARNING: GIT_CREDENTIALS is not set, assuming publicly available git repo."
fi

if [ -z "$GIT_REVISION" ] && [ -z "$GIT_BRANCH" ]; then
    echo "WARNING: Neither GIT_REVISION nor GIT_BRANCH is set."
    echo "Assuming HEAD of master branch."
fi

if [ -z "$DOCKER_PREFIX" ]; then
    echo "WARNING: DOCKER_PREFIX is not set, assuming images from Docker Hub."
    export DOCKER_PREFIX="haufelexware/wicked."
fi

if [ -z "$DOCKER_TAG" ]; then
    echo "WARNING: DOCKER_TAG is not set, assuming latest."
    echo "WARNING: Do not deploy to production with latest, use a named tag."
    export DOCKER_TAG=latest    
fi

if [ -z "$PORTAL_CONFIG_KEY" ]; then
    echo "ERROR: PORTAL_CONFIG_KEY needs to be set to the value of the deploy.envkey"
    echo "file which was created at repository creation."
    echo ""
    echo "Exiting."
    exit 1
fi

if [ -z "$NODE_ENV" ]; then
    echo "ERROR: NODE_ENV has to be defined and set to the name of the environment"
    echo "in your API configuration to use for deployment."
    echo ""
    echo "Exiting."
    exit 1
fi

if [ -z "$REGISTRY_SECRET" ]; then
    echo "ERROR: REGISTRY_SECRET must name the secret in Kubernetes containing the"
    echo "credentials for pulling images from a private repository."
    echo ""
    echo "Exiting."
    exit 1
fi

if [ -z "$PORTAL_NETWORK_APIHOST" ]; then
    echo "ERROR: In order for the ingress configuration to work correctly, you will"
    echo "need to specify the environment variable PORTAL_NETWORK_APIHOST to point"
    echo "to the desired FQDN (DNS entry) of the API Gateway."
    echo "This has to match the corresponding value in your API Configuration"
    echo "(in globals.json)."
    echo ""
    echo "Exiting."
    exit 1
fi

if [ -z "$PORTAL_NETWORK_PORTALHOST" ]; then
    echo "ERROR: In order for the ingress configuration to work correctly, you will"
    echo "need to specify the environment variable PORTAL_NETWORK_PORTALHOST to point"
    echo "to the desired FQDN (DNS entry) of the API Portal."
    echo "This has to match the corresponding value in your API Configuration"
    echo "(in globals.json)."
    echo ""
    echo "Exiting."
    exit 1
fi

echo "Done."
echo "================================================="
echo "Templating configuration ymls..."

echo "Cleaning up old templates..."
for tmpl in $(find . | grep .yml.template); do
    targetFile=${tmpl%.*}
    if [ -f "$targetFile" ]; then
        echo "Deleting ${targetFile}..."
        rm -f $targetFile
    fi
done

for tmpl in $(find . | grep .yml.template); do
    targetFile=${tmpl%.*}
    echo "Templating ${tmpl} to ${targetFile}..."
    perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' $tmpl > $targetFile
done

echo "Done."
echo "================================================="
echo "Adding configuration and secrets..."

if ! kubectl get configmap apim-config; then
    echo "Creating configmap."
    kubectl create -f configmaps/apim-config.yml
else
    echo "Updating configmap via Patch."
    if [ ! -z "$GIT_REPO" ]; then
        kubectl patch configmap apim-config -p "{\"data\":{\"GIT_REPO\":\"${GIT_REPO}\"}}"
    fi
    if [ ! -z "$GIT_BRANCH" ]; then
        kubectl patch configmap apim-config -p "{\"data\":{\"GIT_BRANCH\":\"${GIT_BRANCH}\"}}"
    fi
    if [ ! -z "$GIT_REVISION" ]; then
        kubectl patch configmap apim-config -p "{\"data\":{\"GIT_REVISION\":\"${GIT_REVISION}\"}}"
    fi
    if [ ! -z "$DEBUG" ]; then
        kubectl patch configmap apim-config -p "{\"data\":{\"DEBUG\":\"${DEBUG}\"}}"
    fi
fi

# kubectl apply -f configmaps/apim-secrets.yml
if kubectl get secret apim-secrets; then
    kubectl delete secret apim-secrets
fi
kubectl create secret generic apim-secrets --from-literal=GIT_CREDENTIALS="${GIT_CREDENTIALS}" --from-literal=PORTAL_CONFIG_KEY=${PORTAL_CONFIG_KEY}

# TLS secrets
if kubectl get secret api-tls; then
    kubectl delete secret api-tls
fi
# This will fail if you don't have these files.
kubectl create secret tls api-tls --cert=api-cert.pem --key=api-key.pem
if kubectl get secret portal-tls; then
    kubectl delete secret portal-tls
fi
# This will fail if you don't have these files.
kubectl create secret tls portal-tls --cert=portal-cert.pem --key=portal-key.pem

echo "Done."
echo "================================================="
echo "Applying persistent volume claims..."

for claimYml in $(ls volume-claims/*.yml); do
    kubectl apply -f $claimYml
done

echo "Done."
echo "================================================="
echo "Deploying services..."

for serviceYml in $(ls services/*.yml); do
    kubectl apply -f $serviceYml
done

echo "Done."
echo "================================================="
echo "Deploying deployments..."

for deploymentYml in $(ls deployments/*.yml); do
    kubectl apply -f $deploymentYml
done

echo "Done."
echo "================================================="
echo "Deploying ingress..."

for ingressYml in $(ls ingress/*.yml); do
    kubectl apply -f $ingressYml
done

echo "Done."
