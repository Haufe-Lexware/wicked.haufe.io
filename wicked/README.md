# wicked.haufe.io Helm Chart

**THIS IS STILL WORK IN PROGRESS**

This directory contains a [Kubernetes Helm](https://github.com/kubernetes/helm) chart for wicked.haufe.io. This will be the preferred way of deploying wicked in the future, so feel free to try it out on `minikube` or similar, and please give feedback.

Deploying wicked using a Helm chart is quite certainly the easiest way to get wicked up and running on Kubernetes, without a doubt. The default configuration will deploy a sample portal assuming an ingress at `https://portal.local` (for the API Portal) and `https://api.portal.local` (for the API Gateway).

Most things are already configurable, like which parts of wicked you want to deploy (mailer and chatbot are e.g. not deployed by default), whether you want persistence or not, and whether you want to deploy a separate Postgres instance for Kong, or perhaps use your own.

Please check [values.yaml](values.yaml) for an overview of how you can configure this chart.

## Deploying to `minikube`

### Prerequisites

This little "tutorial" assumes that you have `minikube` v0.14 or higher installed. Additionally you will need the `helm` binary on your machine and in your path. Further it's assumed that you have run `helm init` for your cluster so that the `tiller` component is already running on your cluster.

### Configure ingress

wicked usually needs an ingress controller, and thus `minikube` must enable its internal ingress controller, so make sure you have run the following command on your cluster:

```
$ minikube addons enable ingress
```

It is also assumed that you have some knowledge of Helm, and that you have run `helm init` to install the `tiller` component on your cluster.

### Deploy wicked

If that is set and done, you may now install wicked using the Helm chart. Clone this repository, and `cd` into it:

```
$ git clone https://github.com/Haufe-Lexware/wicked.haufe.io
...
$ cd wicked.haufe.io
$ helm install --set minikubeIP=$(minikube ip) wicked
...
```

Then run `minikube ip` once more, and edit your own `/etc/hosts` (or corresponding file on Windows) to add the names `portal.local` and `api.portal.local` to point to this IP address.

### Open the wicked portal

You should now be able to open the API portal at [https://portal.local](https://portal.local). You may log in using the default dummy admin user `admin@foo.com` with the password `wicked`.
