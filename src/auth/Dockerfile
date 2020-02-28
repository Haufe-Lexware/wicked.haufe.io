ARG ENV_TAG
FROM wicked.env:${ENV_TAG} as builder
USER root
# This is okay, as it's only the builder image. This will not work on Jenkins otherwise.
RUN npm config set unsafe-perm true 
RUN npm install -g typescript@$(jq .devDependencies.typescript package.json | tr -d '"')
RUN npm run build
RUN chown -R wicked:wicked /usr/src/app

FROM wicked.env:${ENV_TAG}
COPY --from=builder /usr/src/app/dist /usr/src/app/dist

EXPOSE 3010
