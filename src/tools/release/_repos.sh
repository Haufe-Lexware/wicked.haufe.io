#!/bin/bash

baseRepos="wicked.ui \
    wicked.api \
    wicked.chatbot \
    wicked.env \
    wicked.kong-adapter \
    wicked.mailer \
    wicked.kickstarter \
    wicked.auth \
    wicked.k8s-init"

jsRepos="${baseRepos} \
    wicked.test"

versionDirs="${baseRepos} \
    wicked.test/portal-api \
    wicked.test/portal-auth \
    wicked.test/portal-kong-adapter"

repos="${jsRepos} \
    wicked.kong \
    wicked.k8s-tool \
    wicked.box"

sourceRepos="${repos} \
    wicked.node-sdk \
    wicked-sample-config"

imageRepos="${baseRepos} \
    wicked.k8s-tool \
    wicked.box"

imageBases=$(for r in ${imageRepos}; do echo ${r:7}; done)
versionDirBases=$(for v in ${versionDirs}; do echo ${v:7}; done)

alpineImageBases="kong \
    env \
    auth \
    api \
    chatbot \
    ui \
    kong-adapter \
    mailer \
    kickstarter"
