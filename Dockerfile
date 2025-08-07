# Multi-stage build for optimal image size
FROM oven/bun:1 as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-slim

# Install necessary system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production && \
    bun pm cache clean

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/generate-report.ts ./

# Create necessary directories
RUN mkdir -p /app/.cache /app/report-output && \
    chown -R nodejs:nodejs /app/.cache /app/report-output

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port (if running as API server)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    CACHE_DIR=/app/.cache \
    OUTPUT_DIR=/app/report-output

# Default command
CMD ["bun", "run", "generate-report.ts"]