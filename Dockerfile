# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ARG APP_BUILD_ID=dev
LABEL com.project="vaultbase"
ENV NODE_ENV=production \
    SERVE_STATIC=true \
    API_PORT=8787 \
    APP_BUILD_ID=$APP_BUILD_ID
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg restic rclone \
 && install -d -m 0755 /etc/apt/keyrings \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY server/migrations ./server-dist/migrations
COPY docker/entrypoint.sh /usr/local/bin/vaultbase-entrypoint
RUN chmod 0555 /usr/local/bin/vaultbase-entrypoint \
 && mkdir -p /var/lib/vaultbase/secrets /var/lib/vaultbase/storage-cache /var/lib/vaultbase/work /var/cache/vaultbase/restic \
 && chown -R node:node /var/lib/vaultbase /var/cache/vaultbase
USER node
EXPOSE 8787
ENTRYPOINT ["vaultbase-entrypoint"]
CMD ["node", "server-dist/index.js"]
