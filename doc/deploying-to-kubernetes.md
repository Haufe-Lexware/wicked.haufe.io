# Deploying wicked to Kubernetes

The previous scripts in this repository to deploy and update wicked on Kubernetes have been superseded by the Helm Chart for wicked, which can be found here:

[wicked.haufe.io Helm Chart](https://github.com/Haufe-Lexware/wicked.haufe.io/tree/master/wicked)

**IMPORTANT**: The scripts under the above link are currently for wicked 0.12.5, not for the beta version of wicked 1.0.0. Read on for a description on how to deploy wicked 1.0.0.beta.

## Why Helm?

Helm is the official "package manager" for Kubernetes, and as wicked.haufe.io is intended to be a "pluggable" API Management system, it makes sense to supply the installation guidelines of wicked as a Chart, to make it easier for everybody to have a clean and working installation on Kubernetes. The project wicked.haufe.io intends to keep the Helm Charts updated, so that even if there are changes to deployments, the process of upgrading will be a lot smoother, as we can take care of that as well from the maintainers side - most things which can be tricky when installing and upgrading can and will be included in the charts eventually.

In due time we are also targeting to be included in the official charts library, but for this period of time, we keep the Chart inside this repository.

## DEPLOYING WICKED 1.0.0 beta

Go here: [wicked.haufe.io 1.0.0 Helm Chart](https://github.com/Haufe-Lexware/wicked.haufe.io/tree/wicked_1_0/wicked)

Use an override tag of `1.0.0.beta<n>`, e.g. `1.0.0.beta1`.

## Links

* [Helm](https://helm.sh)
* [Helm on GitHub](https://github.com/kubernetes/helm)
* [Official Charts](https://github.com/kubernetes/charts)
