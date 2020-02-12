FROM node:10-alpine AS env_builder

RUN apk update && \
    apk add jq bash

COPY wicked.haufe.io/src/node-sdk /usr/src/app/node-sdk
RUN cd /usr/src/app/node-sdk && \
    npm config set unsafe-perm true && \
    npm install -g typescript@$(jq .devDependencies.typescript package.json | tr -d '"') && \
    npm install --production && \
    tsc && \
    cp $(npm pack) ../wicked-sdk.tgz

COPY wicked.haufe.io/src/env /usr/src/app/env
WORKDIR /usr/src/app/env
RUN npm pack && cp portal-env*.tgz ../portal-env.tgz
RUN cp package.all.json package.json && \
    cp ../wicked-sdk.tgz . && \
    npm install --production

COPY wicked.haufe.io/src/kong-adapter /usr/src/app/kong-adapter
WORKDIR /usr/src/app/kong-adapter
RUN ln -s /usr/src/app/env/node_modules ./node_modules
RUN npm run build

COPY wicked.haufe.io/src/auth /usr/src/app/auth
WORKDIR /usr/src/app/auth
RUN ln -s /usr/src/app/env/node_modules ./node_modules
RUN npm run build

# ======================================================

FROM node:10-alpine

ENV KONG_VERSION 0.14.1
ENV KONG_SHA256 e29937c5117ac2debcffe0d0016996dd5f0c516ef628f1edc029138715981387

ENV KONG_ADMIN_ACCESS_LOG "/tmp/stdout"
ENV KONG_ADMIN_ERROR_LOG "/tmp/stderr"
ENV KONG_PROXY_ACCESS_LOG "/tmp/stdout"
ENV KONG_PROXY_ERROR_LOG "/tmp/stderr"

# This will work on Docker for Mac and Docker for Windows, but currently
# NOT on Docker for Linux, see https://github.com/docker/for-linux/issues/264
ENV KONG_PG_HOST host.docker.internal
# Default settings, may be overridden
ENV KONG_PG_USER kong
ENV KONG_PG_PASSWORD kong
# Default env for wicked-in-a-box, may also be overridden
ENV NODE_ENV box
# See https://github.com/Haufe-Lexware/wicked.haufe.io/issues/196
ENV ALLOW_ANY_REDIRECT_URI ""

# Hack output of KONG to the output of PID 1, which is what docker
# outputs as logs.
RUN ln -sf /proc/1/fd/1 /tmp/stdout && \
    ln -sf /proc/1/fd/2 /tmp/stderr

RUN apk add --no-cache --virtual .build-deps wget tar ca-certificates \
	&& apk add --no-cache libgcc openssl pcre perl tzdata curl bash dumb-init redis \
	&& wget -O kong.tar.gz "https://bintray.com/kong/kong-community-edition-alpine-tar/download_file?file_path=kong-community-edition-$KONG_VERSION.apk.tar.gz" \
	&& echo "$KONG_SHA256 *kong.tar.gz" | sha256sum -c - \
	&& tar -xzf kong.tar.gz -C /tmp \
	&& rm -f kong.tar.gz \
	&& cp -R /tmp/usr / \
	&& rm -rf /tmp/usr \
	&& cp -R /tmp/etc / \
	&& rm -rf /tmp/etc \
	&& apk del .build-deps

RUN npm config set unsafe-perm true 
RUN npm install -g pm2

# This does not work on Jenkins, and I do not know why. It was downloaded manually and
# put into the "resources" sub directory.
# RUN wget -O /usr/local/bin/wtfc.sh https://raw.githubusercontent.com/typekpb/wtfc/1607d27280ba1ee8a74d74d97a1f9de6a6d38486/wtfc.sh \
#     && chmod +x /usr/local/bin/wtfc.sh

COPY wicked.haufe.io/src /usr/src/app
COPY resources /usr/src/app/resources
COPY docker-startup.sh /usr/src/app
COPY pm2.config.js /usr/src/app
COPY --from=env_builder /usr/src/app/env/node_modules /usr/src/app/env/node_modules
COPY --from=env_builder /usr/src/app/kong-adapter/dist /usr/src/app/kong-adapter/dist
COPY --from=env_builder /usr/src/app/auth/dist /usr/src/app/auth/dist

RUN for r in api ui auth kong-adapter mailer chatbot; do \
        echo "Linking node_modules for wicked.${r}" && \
        cd /usr/src/app/${r} && \
        ln -s /usr/src/app/env/node_modules ./node_modules; \
    done

EXPOSE 8000 8001 3000 3001 3002 3003 3004 3005 3010

ENTRYPOINT ["/usr/src/app/docker-startup.sh"]
