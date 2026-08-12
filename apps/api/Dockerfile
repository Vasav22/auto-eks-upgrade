# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Use the minimal API-only package.json + its lock file
# npm ci uses the lock file — skips dependency resolution, much faster
COPY apps/api/package.docker.json ./package.json
COPY apps/api/package-lock.docker.json ./package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

COPY tsconfig.base.json nx.json ./
COPY apps/api ./apps/api
COPY libs ./libs

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

ENV TS_NODE_PROJECT=apps/api/tsconfig.app.json
ENV TS_NODE_TRANSPILE_ONLY=true

CMD ["node", \
     "-r", "tsconfig-paths/register", \
     "-r", "ts-node/register/transpile-only", \
     "apps/api/src/main.ts"]
