# wicked.k8s-wait

A simple script that allows to wait for a k8s service, job or pods to enter desired state.

This script was forked from [https://github.com/groundnuty/k8s-wait-for](https://github.com/groundnuty/k8s-wait-for) and adapted slightly for use with the [wicked.haufe.io](http://wicked.haufe.io) project.

Thanks a bunch to @groundnuty for sharing this piece of work! This derivative work is using the [same license](LICENSE) (MIT License) as the original work. All other parts of wicked are applying the Apache 2.0 license.

## Using

Please consult `k8s-tool.sh -h` for detailed documentation.

## Usage in wicked

This container is used as an init container in the [wicked Helm chart](https://github.com/Haufe-Lexware/wicked.haufe.io/tree/master/wicked) to make sure the services come up in the right order and successfully.

Nothing speaks against you using this container for your own purposes, but it's also not said that it will not get adapted further along the release line of wicked.haufe.io, so please take care that you don't break your own things if you rely on this project.
