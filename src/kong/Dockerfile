# Note: This base image is multi-arch; supports both x86_64 and aarch64 (ARMv8)
FROM kong:2.8.1-alpine

ENV KONG_PG_HOST kong-database
ENV KONG_PG_PORT 5432
ENV KONG_PG_USER kong
ENV KONG_PG_PASSWORD kong
ENV KONG_DATABASE postgres
ENV KONG_ADMIN_ACCESS_LOG "/tmp/stdout"
ENV KONG_ADMIN_ERROR_LOG "/tmp/stderr"
ENV KONG_PROXY_ACCESS_LOG "/tmp/stdout"
ENV KONG_PROXY_ERROR_LOG "/tmp/stderr"

USER root
RUN apk update && apk add dumb-init bash

# Hack output of KONG to the output of PID 1, which is what docker
# outputs as logs.
RUN ln -sf /proc/1/fd/1 /tmp/stdout && \
    ln -sf /proc/1/fd/2 /tmp/stderr

COPY resources/wtfc.sh /usr/local/bin/wtfc.sh

COPY startup.sh /startup.sh
COPY git_* /usr/src/app/

USER kong
CMD ["/startup.sh"]
