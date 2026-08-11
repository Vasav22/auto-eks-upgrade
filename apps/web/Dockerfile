# syntax=docker/dockerfile:1
# Stage 1: build — monorepo root is the Docker build context
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

# Use BuildKit cache so npm packages are only downloaded once across builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# Copy config files needed by Nx/Vite
COPY tsconfig.base.json nx.json ./
COPY apps/web ./apps/web
COPY libs ./libs

# Build the web app (vite outputs to dist/apps/web relative to monorepo root)
RUN cd apps/web && npx vite build

# Stage 2: serve
FROM nginx:1.25-alpine

COPY --from=builder /app/dist/apps/web /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
