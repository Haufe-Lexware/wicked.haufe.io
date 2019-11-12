# Kubernetes Init Container for applications needing OAuth2 credentials for wicked.haufe.io

This project implements a container which can be used to get client credentials (client id and secret) from a wicked.haufe.io instance running inside Kubernetes.

It will do the following things:

1. Initialize the wicked SDK and check there's a [Portal API](https://github.com/Haufe-Lexware/wicked.portal-api) instance to talk to
2. Locate or create a machine user called `auto-deploy`; machine users are always administrators internally
3. Locate or create a wicked application with the name `APP_ID` and the specified `CLIENT_TYPE`
4. Locate or create a subscription to the API `API_ID` with the plan `PLAN_ID`
5. Upsert (create or update) a secret inside Kubernetes in the namespace `NAMESPACE` with the name `SECRET_NAME`

The secret will contain two string keys, `client_id` and `client_secret`, which in turn can be used inside pod definitions to retrieve credentials to an application. This is how you can use credentials created in case you have an OAuth2 secured API:

```yml
# ....
    spec:
      containers:
      - name: your-container
        image: yourorg/your-container:latest
        env:
        # ...
        - name: CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: secret-name
              key: client_id
        - name: CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: secret-name
              key: client_secret
```

In case your API is secured by an API key, you will find the API Key in `key: apikey`:

```yml
# ....
    spec:
      containers:
      - name: your-container
        image: yourorg/your-container:latest
        env:
        # ...
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: secret-name
              key: api_key
```

## Usage

Use `haufelexware/wicked.k8s-init:latest` either as an [Init Container](https://kubernetes.io/docs/concepts/abstractions/init-containers/), or as a [Kubernetes Job](https://kubernetes.io/docs/user-guide/jobs/), see also [wicked-init.yml](kubernetes/wicked-init.yml) for an example.

### Sample init container configuration

Pre Kubernetes 1.6 (<= 1.5):

```yml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
  annotations:
    pod.beta.kubernetes.io/init-containers: '[
        {
            "name": "wicked-init",
            "image": "haufelexware/wicked.k8s-init:latest",
            "env": [
                {
                    "name": "APP_ID",
                    "value": "wicked-app-id"
                },
                {
                    "name": "API_ID",
                    "value": "some-api"
                },
                {
                    "name": "PLAN_ID",
                    "value": "unlimited"
                },
                {
                    "name": "NAMESPACE",
                    "value": "default"
                },
                {
                    "name": "REDIRECT_URI",
                    "value": "https://uri.of.your.app.com/callback"
                },
                {
                    "name": "SECRET_NAME",
                    "value": "wicked-client-creds"
                }
            ]
        }
    ]'
spec:
  containers:
  - name: myapp-container
    image: busybox
    command: ['sh', '-c', 'echo The app is running! && sleep 3600']
```

Kubernetes 1.6 or later (recommended):

```yml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
spec:
  initContainers:
  - name: wicked-init
    images: haufelexware/wicked.k8s-init:latest
    env:
    - name: APP_ID
      value: wicked-app-id
    - name: API_ID
      value: some-api
    - name: PLAN_ID
      value: unlimited
    - name: CLIENT_TYPE
      value: confidential
    - name: NAMESPACE
      value: default
    - name: REDIRECT_URI
      value: "https://uri.of.your.app.com/callback"
    - name: SECRET_NAME
      value: wicked-client-creds
  containers:
  - name: myapp-container
    image: busybox
    command: ['sh', '-c', 'echo The app is running! && sleep 3600']
```


## Parameters

Use the following environment variables when running the init container/job:

Env var | Default | Description
--------|---------|------------
`APP_ID` | `app-id` | The application ID in the wicked portal to be created
`API_ID` | `api-id` | The API ID of the API to create a subscription for
`PLAN_ID` | `unlimited` | The plan ID to use for the subscription
`CLIENT_TYPE` | `public_spa` | The client type; one of `public_spa`, `public_native` or `confidential`
`REDIRECT_URI` | -- | The redirect URI of the application; to specify multiple redirect URIs, separate them with a pipe `|` character; e.g. `https://app.yourcompany.com/callback|https://app.yourcompany.com/callback/silent-refresh.html`
`SECRET_NAME` | `some-secret` | The name of the kubernetes secret to create (retrieve with `kubectl get secret some-secret`)
`NAMESPACE`| `default` | The Kubernetes namespace to create the secret for
`PORTAL_API_URL` | `http://portal-api:3001` | If wicked runs in a different location, specify this env var; note that the portal API must be accessible directly via http!

The network connection to the Kubernetes API will be retrieved from the injected env vars `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT`, using the token automatically stored in `/var/run/secrets/kubernetes.io/serviceaccount/token`.

## License

Apache 2.0.
