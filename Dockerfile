FROM docker.io/node:24-alpine

USER root

# util-linux-misc for /usr/bin/eject
RUN set -exu \
  && apk add --no-cache \
    util-linux-misc

ADD --chmod=555 https://github.com/gasripper/discid-json/releases/latest/download/discid /usr/local/bin/discid

USER node
WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node . /app/

RUN set -exu \
  && cd /app \
  && npm install --include=dev \
  && npm run build

ENTRYPOINT ["/bin/sh"]

CMD ["-c", "node /app/dist/main.mjs"]
