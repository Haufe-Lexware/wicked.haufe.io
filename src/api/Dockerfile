ARG ENV_TAG
FROM wicked.env:${ENV_TAG}

# Default user is "wicked", but we need root to set all access rights
# correctly, and then start node as wicked using gosu.
USER root

EXPOSE 3001

RUN cp -R /usr/src/portal-env/initial-config /var/portal-api

CMD [ "/usr/src/app/bin/docker-start.sh" ]
