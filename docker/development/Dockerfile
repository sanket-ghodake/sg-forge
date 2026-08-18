# syntax=docker/dockerfile:1.7
FROM oven/bun:1.2-alpine AS development

# Install minimal system dependencies
RUN apk add --no-cache \
    bash \
    python3 \
    postgresql15-client \
    ca-certificates \
    docker-cli \
    wget

WORKDIR /app

# Copy dependency manifests to leverage Docker layer caching
COPY package.json bun.lock* ./
COPY core/package.json ./core/
COPY core/src/frontend/package.json ./core/src/frontend/
COPY packages/sdk/package.json ./packages/sdk/
COPY sandbox/apps/reference-expenses/package.json ./sandbox/apps/reference-expenses/

# Pre-install workspace dependencies at build time using BuildKit cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile || bun install

# Copy entrypoint script
COPY docker/development/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose all portal and app ports
EXPOSE 3001 3002 3003 8085 8086 8087

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]




