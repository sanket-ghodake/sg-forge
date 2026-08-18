# syntax=docker/dockerfile:1.7
# ==========================================
# STAGE 1: Go Builder (Compile static Go binary)
# ==========================================
FROM golang:1.24-alpine AS go-builder
WORKDIR /build
ENV GOPROXY=https://proxy.golang.org,https://goproxy.io,direct

# Separate go.mod/go.sum copy to cache dependencies
COPY sandbox/apps/reference-go/go.mod sandbox/apps/reference-go/go.sum ./reference-go/
WORKDIR /build/reference-go
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY sandbox/apps/reference-go ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/reference-go-bin main.go

# ==========================================
# STAGE 2: Bun JS/TS Builder (Install & Build Frontend/Backend)
# ==========================================
FROM oven/bun:1.2-alpine AS js-builder
WORKDIR /app

# Copy package manifests for optimal layer caching
COPY package.json bun.lock* ./
COPY core/package.json ./core/
COPY packages/sdk/package.json ./packages/sdk/
COPY sandbox/apps/reference-expenses/package.json ./sandbox/apps/reference-expenses/
COPY core/src/frontend/package.json ./core/src/frontend/

# Install workspace dependencies using Bun with package caching
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile || bun install

# Copy remaining source code after dependencies are cached
COPY . .

# Build Next.js production bundle with build cache mount
ENV NEXT_TELEMETRY_DISABLED=1
ENV JWT_SECRET=production-build-placeholder-key-min-32-chars-long
RUN --mount=type=cache,target=/app/core/src/frontend/.next/cache cd core/src/frontend && bun run build

# ==========================================
# STAGE 3: Final Production Runner (Alpine + Bun runtime)
# ==========================================
FROM oven/bun:1.2-alpine AS runner

# Install essential system runtimes
RUN apk add --no-cache \
    bash \
    python3 \
    postgresql15-client \
    ca-certificates \
    docker-cli

WORKDIR /app

# Copy workspace source trees with non-root ownership
COPY --chown=bun:bun --from=js-builder /app/node_modules ./node_modules
COPY --chown=bun:bun --from=js-builder /app/core ./core
COPY --chown=bun:bun --from=js-builder /app/packages ./packages
COPY --chown=bun:bun --from=js-builder /app/sandbox ./sandbox
COPY --chown=bun:bun --from=js-builder /app/scripts ./scripts
COPY --chown=bun:bun --from=js-builder /app/test ./test
COPY --chown=bun:bun --from=js-builder /app/package.json /app/bun.lock* /app/tsconfig.json ./

# Copy Next.js standalone distribution
COPY --chown=bun:bun --from=js-builder /app/core/src/frontend/.next/standalone ./core/src/frontend/.next/standalone
COPY --chown=bun:bun --from=js-builder /app/core/src/frontend/public ./core/src/frontend/.next/standalone/core/src/frontend/public
COPY --chown=bun:bun --from=js-builder /app/core/src/frontend/.next/static ./core/src/frontend/.next/standalone/core/src/frontend/.next/static

# Copy compiled static Go binary
COPY --chown=bun:bun --from=go-builder /build/reference-go-bin /app/sandbox/apps/reference-go/reference-go-bin

# Expose ports
EXPOSE 3001 3002 3003 8085 8086 8087

# Copy and set production entrypoint
COPY docker/production/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER bun

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]



