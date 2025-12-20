# Automaker UI
# Multi-stage build for minimal production image

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/ui/package*.json ./apps/ui/
COPY scripts ./scripts

# Install dependencies (skip electron postinstall)
RUN npm ci --workspace=apps/ui --ignore-scripts

# Copy source
COPY apps/ui ./apps/ui

# Build for web (skip electron)
# VITE_SERVER_URL tells the UI where to find the API server
# Using localhost:3008 since both containers expose ports to the host
ENV VITE_SKIP_ELECTRON=true
ENV VITE_SERVER_URL=http://localhost:3008
RUN npm run build --workspace=apps/ui

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/apps/ui/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
