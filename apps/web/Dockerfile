# Pre-built stage — artifacts come from host build (npx nx build web)
FROM nginx:1.25-alpine

# Copy built SPA assets
COPY dist/apps/web /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
