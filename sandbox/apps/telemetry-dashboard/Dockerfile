# syntax=docker/dockerfile:1.7
FROM oven/bun:1.2-alpine

WORKDIR /app

COPY --chown=bun:bun . .

EXPOSE 8080

USER bun

CMD ["bun", "run", "server.ts"]
