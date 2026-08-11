# Pre-built stage — artifacts come from host build (npx nx build api)
FROM node:20-alpine

WORKDIR /app

# Copy production node_modules from monorepo root
COPY node_modules ./node_modules

# Copy compiled API output
COPY dist/apps/api ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/main.js"]
