# Runtime-only: no TypeScript compilation step.
# Uses ts-node --transpile-only so type errors are ignored at build time.
FROM node:20-alpine

WORKDIR /app

# Install dependencies in a separate layer so it's cached between source changes
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --prefer-offline 2>/dev/null || npm install --legacy-peer-deps

COPY tsconfig.base.json nx.json ./
COPY apps/api ./apps/api
COPY libs ./libs

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

# TS_NODE_PROJECT points ts-node at the app tsconfig so paths resolve correctly
ENV TS_NODE_PROJECT=apps/api/tsconfig.app.json
ENV TS_NODE_TRANSPILE_ONLY=true

CMD ["node", \
     "-r", "tsconfig-paths/register", \
     "-r", "ts-node/register/transpile-only", \
     "apps/api/src/main.ts"]
