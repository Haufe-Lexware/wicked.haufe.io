# wicked-in-a-box

This is an image which makes creating local development environments which include wicked.haufe.io a lot easier to handle.

The container which is built here contains (almost) everything which is needed to make a local wicked deployment work:

* wicked API
* wicked UI
* wicked Kong-Adapter
* wicked Auth Server
* wicked Chatbot
* wicked Mailer
* Kong
* Redis

It just needs the following things from the outside:

* A static configuration mounted to `/var/portal-api` (so that `/var/portal-api/static` points to the `static` directory of the configuration)
* A Postgres 9.6 running so that it's available

## Compatibility

This docker image is purpose-built for development environments and is (at least currently) **not suited for production**. Please use a more robust runtime environment such as Kubernets for that, which also enables you to scale up each components. In this image, all services (including Kong) only run once, and the container **can not** be scaled.

Further, this image will (at least currently) **not work out of the box on Linux**, only on macOS and Windows. This is due to the fact that it makes use of the `host.docker.internal` DNS entry in not (yet) implemented for Docker for Linux. There are workarounds for this which will be described in the documentation of wicked on https://github.com/Haufe-Lexware/wicked.haufe.io.

## Default Postgres

The default installation assumes that there is a Postgres 9.6 running on the usual port 5432, with a username `kong` and a password `kong`. You can run this in docker using the following command:

```
$ docker run -d -p 5432:5432 -e POSTGRES_USER=kong -e POSTGRES_PASSWORD=kong --name wicked-postgres postgres:9.6
```
