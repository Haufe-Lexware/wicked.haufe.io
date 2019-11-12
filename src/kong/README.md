# wicked.haufe.io

This is a part of the open source API Management solution wicked.haufe.io.

For more information, see the main documentation repository at

[github.com/Haufe-Lexware/wicked.haufe.io](https://github.com/Haufe-Lexware/wicked.haufe.io)

## Repository Content

This is the repository which decides which Kong image is used as a base image for the wicked.haufe.io API Management system. The image is called `wicked.kong:<version>`, and is versioned with the releases of the other wicked components, to make sure that everything fits together as it should. 

### Building the wicked.kong image locally

In order to build the Kong image locally (e.g. for testing compatibility of a new Kong release), use the `local-build.sh` shell script.

The script takes the following environment variables as input parameters:

* `WICKED_KONG_IMAGE`: The Kong docker image to use as a base, e.g. `kong:latest`
* `DOCKER_PREFIX`: A prefix for the create docker image
* `DOCKER_TAG`: The docker tag to add to the docker image.

The resulting image will be tagged as `${DOCKER_PREFIX}kong:${DOCKER_TAG}`. Haufe uses 

```
DOCKER_PREFIX=haufelexware/wicked.
```

## Changelog

* In preparation of migrating wicked to `0.9.x` of Kong, some environment variables were added to the `Dockerfile.template` to match the new configuration experience of Kong.
* `Dockerfile.template` was removed, it is not used anymore.

## License

Copyright 2016 Haufe-Lexware GmbH & Co. KG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
