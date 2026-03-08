# GPO Analyzer Frontend Dockerfile
# Multi-stage build: build with Node, serve with Nginx

# Stage 1: Build
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (legacy-peer-deps for MSAL compatibility with React 19)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build arguments for Azure AD / Entra ID authentication
ARG VITE_AZURE_CLIENT_ID=your-client-id
ARG VITE_AZURE_TENANT_ID=your-tenant-id
ENV VITE_AZURE_CLIENT_ID=${VITE_AZURE_CLIENT_ID}
ENV VITE_AZURE_TENANT_ID=${VITE_AZURE_TENANT_ID}

# Build the app
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
