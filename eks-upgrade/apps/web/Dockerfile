# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY apps/web apps/web
COPY libs libs

# Build
RUN npm run build:web

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist/apps/web /usr/share/nginx/html

# Copy nginx configuration
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 101 -S nginx && \
    adduser -S nginx -u 101 -G nginx

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
