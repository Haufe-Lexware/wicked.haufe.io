ARG BASE_IMAGE_UBUNTU
ARG SDK_TAG
FROM wicked.sdk:${SDK_TAG} as node-sdk

FROM ${BASE_IMAGE_UBUNTU}

RUN groupadd -r wicked --gid=888 && useradd -r -g wicked --uid=888 wicked \
    && set -x \
    && apt-get update && apt-get install -y --no-install-recommends ca-certificates wget gosu dumb-init jq \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /usr/src/portal-env /usr/src/app && chown -R wicked:wicked /usr/src \
    && mkdir -p /home/wicked && chown -R wicked:wicked /home/wicked

USER wicked
COPY . /usr/src/portal-env
COPY package.all.json /usr/src/app/package.json
COPY --from=node-sdk /wicked-sdk.tgz /usr/src/app/wicked-sdk.tgz
COPY forever.sh /usr/src/app/forever.sh
COPY git_* /usr/src/app/

WORKDIR /usr/src/app
RUN cd /usr/src/portal-env \
    && npm pack \
    && mv /usr/src/portal-env/portal-env-* /usr/src/portal-env.tgz \
    && cd /usr/src/app \
    && npm install --production

# We install all node_modules in this base image; no need to do it later
ONBUILD RUN date -u "+%Y-%m-%d %H:%M:%S" > /usr/src/app/build_date
ONBUILD COPY . /usr/src/app

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./forever.sh", "npm", "start" ]
