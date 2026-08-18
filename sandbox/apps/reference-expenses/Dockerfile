# syntax=docker/dockerfile:1.7
FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile || bun install

# Copy source with non-root ownership
COPY --chown=bun:bun . .

EXPOSE 8085

USER bun

CMD ["bun", "run", "server.ts"]
