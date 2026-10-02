FROM ghcr.io/imputnet/cobalt:11.7.1
USER root
COPY --chown=node:node start.mjs /app/creator-start.mjs
USER node
ENV API_AUTH_REQUIRED=1
ENV API_KEY_URL=file:///tmp/creator-cobalt-keys.json
ENV DURATION_LIMIT=600
ENV RATELIMIT_WINDOW=60
ENV RATELIMIT_MAX=5
ENV CORS_WILDCARD=0
EXPOSE 9000
CMD ["node", "/app/creator-start.mjs"]
