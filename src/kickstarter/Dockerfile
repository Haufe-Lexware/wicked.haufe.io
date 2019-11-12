ARG ENV_TAG
FROM wicked.env:${ENV_TAG}

ENV LOG_PLAIN true
USER root

ENTRYPOINT ["/usr/src/app/bin/docker-entrypoint.sh"]
CMD ["/var/portal-api"]

EXPOSE 3333
