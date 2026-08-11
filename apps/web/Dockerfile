# Stage 1: build — monorepo root is the Docker build context
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root-level package files (package.json + lock live at monorepo root)
COPY package.json package-lock.json* pnpm-workspace.yaml* ./

# Install pnpm and use it if lockfile is pnpm-based, else fall back to npm
# Remove backend (NestJS/TypeORM) packages not needed for the frontend build
RUN node -e " \
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('./package.json','utf8')); \
  const strip = (obj) => { if (!obj) return; Object.keys(obj).forEach(k => { if (k.startsWith('@nestjs/') || ['typeorm','@mikro-orm','reflect-metadata','rxjs','class-validator','class-transformer'].includes(k)) delete obj[k]; }); }; \
  strip(pkg.dependencies); strip(pkg.devDependencies); \
  fs.writeFileSync('./package.json', JSON.stringify(pkg,null,2)); \
" && npm install --legacy-peer-deps && npm install uuid @types/uuid

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
