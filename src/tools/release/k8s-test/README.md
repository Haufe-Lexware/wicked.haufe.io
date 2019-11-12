# Kubernetes test suite

The scripts in this repository can be used to set up a sample environment of wicked, using Azure AKS (managed Kubernetes), kube-lego and the wicked Helm chart.

These scripts assumes that you have cloned the wicked repositories in a way that `wicked.tools` is at the same level as the `wicked.haufe.io` repository, which contains the wicked Helm Chart.

## Prerequisites

Check out the `env.sh.template` file to see which the prereqs are in detail:

* An Azure Subscription where you are at least "Contributor", and/or
* An Azure Service Principal with at least the "Contributor" role on a given subscription
* An Azure DNS Zone which you can control via the Service Principal

## How to use

The scripts are enumerated, run them one after the other, after you have sourced your `env.sh` file:

```
$ . env.sh
$ ./01-create-env.sh
...
```

In the end, you will have a running installation of wicked on a one node AKS installation.
