FROM oven/bun:1.1-alpine

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN bun install --production

# Copy application source
COPY server.ts index.html ./

# Expose app port
EXPOSE 8090

# Command to run the app
CMD ["bun", "run", "server.ts"]
