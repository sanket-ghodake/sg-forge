# syntax=docker/dockerfile:1.7
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git
WORKDIR /app
ENV GOPROXY=https://proxy.golang.org,https://goproxy.io,direct

# Separate dependency caching
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

# Build static binary
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o main .

FROM alpine:3.21

WORKDIR /app
RUN adduser -D -u 1000 appuser

COPY --chown=appuser:appuser --from=builder /app/main .
COPY --chown=appuser:appuser --from=builder /app/app.json .

EXPOSE 8086

USER appuser

CMD ["./main"]
