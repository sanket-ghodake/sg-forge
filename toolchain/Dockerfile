# syntax=docker/dockerfile:1.7
# Base image with essential build tools
FROM debian:bookworm-slim

# Install system dependencies with APT cache mounts
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    make \
    xz-utils \
    unzip

# Install Go 1.24
RUN curl -sSL https://go.dev/dl/go1.24.0.linux-amd64.tar.gz | tar -xz -C /usr/local
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Install Node.js 24 LTS
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs

# Install Bun
ENV BUN_INSTALL="/root/.bun"
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Python-based tools with pip cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --break-system-packages \
    ruff>=0.9.0 \
    sqlfluff>=3.0.0 \
    semgrep>=1.90.0 \
    mkdocs>=1.6.0 \
    mkdocs-material>=9.5.40

# Pre-compiled binaries for golangci-lint, govulncheck & Gitleaks
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest && \
    go install golang.org/x/vuln/cmd/govulncheck@latest && \
    cp /go/bin/golangci-lint /usr/local/bin/ && \
    cp /go/bin/govulncheck /usr/local/bin/ && \
    curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.24.0/gitleaks_8.24.0_linux_x64.tar.gz | tar -xz -C /usr/local/bin gitleaks

# Copy Trivy from the official image
COPY --from=aquasec/trivy:latest /usr/local/bin/trivy /usr/local/bin/trivy

# Install dependency-cruiser globally with npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install -g dependency-cruiser@latest

# Set workspace directory
WORKDIR /app

# Set default entrypoint to shell wrapper
COPY run-checks.sh /usr/local/bin/run-checks
RUN chmod +x /usr/local/bin/run-checks

ENTRYPOINT ["run-checks"]
CMD ["all"]

