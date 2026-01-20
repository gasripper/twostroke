FROM docker.io/node:24-alpine

USER node
WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node . /app/

RUN set -exu \
  && cd /app \
  && npm install \
  && npm run build

ENTRYPOINT ["/bin/sh"]

CMD ["-c", "node /app/dist/main.mjs"]
