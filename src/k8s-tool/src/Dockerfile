FROM alpine:3.16

LABEL maintainer="Michal Orzechowski <orzechowski.michal@gmail.com>, Martin Danielsson <martin.danielsson@haufe-lexware.com>"

ARG KUBE_LATEST_VERSION
ARG DOCKER_ARCH

RUN echo "Installing kubectl ${KUBE_LATEST_VERSION}"
RUN apk add --update ca-certificates \
 && apk add --update -t deps curl\
 && curl -L https://dl.k8s.io/release/${KUBE_LATEST_VERSION}/bin/linux/${DOCKER_ARCH}/kubectl -o /usr/local/bin/kubectl \
 && chmod +x /usr/local/bin/kubectl \
 && apk del --purge deps \
 && apk add --update jq \
 && rm /var/cache/apk/* \
 && mkdir -p /usr/src/app

ADD k8s-tool.sh /usr/local/bin/k8s-tool.sh
ADD git_branch /usr/src/app/git_branch
ADD git_last_commit /usr/src/app/git_last_commit

ARG VCS_REF
ARG BUILD_DATE

# Metadata
LABEL org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/Haufe-Lexware/wicked.haufe.io" \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.docker.dockerfile="/src/k8s-tool/src/Dockerfile"

ENTRYPOINT ["k8s-tool.sh"]
