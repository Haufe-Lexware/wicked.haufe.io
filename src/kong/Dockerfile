FROM kong:1.5.1-alpine
#FROM kong:0.14.1-centos

ENV KONG_PG_HOST kong-database
ENV KONG_PG_PORT 5432
ENV KONG_PG_USER kong
ENV KONG_PG_PASSWORD kong
ENV KONG_DATABASE postgres
ENV KONG_ADMIN_ACCESS_LOG "/tmp/stdout"
ENV KONG_ADMIN_ERROR_LOG "/tmp/stderr"
ENV KONG_PROXY_ACCESS_LOG "/tmp/stdout"
ENV KONG_PROXY_ERROR_LOG "/tmp/stderr"

RUN apk update && apk add dumb-init bash

# Hack output of KONG to the output of PID 1, which is what docker
# outputs as logs.
RUN ln -sf /proc/1/fd/1 /tmp/stdout && \
    ln -sf /proc/1/fd/2 /tmp/stderr

COPY resources/wtfc.sh /usr/local/bin/wtfc.sh

COPY startup.sh /startup.sh
COPY git_* /usr/src/app/

CMD ["/startup.sh"]
