# Multi-stage build for production
FROM node:18-alpine AS backend-builder

# Set working directory for backend
WORKDIR /app

# Copy backend package files
COPY package*.json ./
RUN npm install --only=production

# Copy backend source code
COPY . .

# Remove client directory from backend build
RUN rm -rf client

# Build frontend
FROM node:18-alpine AS frontend-builder

# Set working directory for frontend
WORKDIR /app/client

# Copy frontend package files first
COPY client/package*.json ./
RUN npm install

# Copy all frontend files (ensuring all necessary files are included)
COPY client/ .

# Build frontend for production
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy backend dependencies and source
COPY --from=backend-builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=backend-builder --chown=nodejs:nodejs /app/server.js ./
COPY --from=backend-builder --chown=nodejs:nodejs /app/config ./config
COPY --from=backend-builder --chown=nodejs:nodejs /app/models ./models
COPY --from=backend-builder --chown=nodejs:nodejs /app/routes ./routes
COPY --from=backend-builder --chown=nodejs:nodejs /app/middleware ./middleware
COPY --from=backend-builder --chown=nodejs:nodejs /app/socket ./socket
COPY --from=backend-builder --chown=nodejs:nodejs /app/utils ./utils

# Copy built frontend
COPY --from=frontend-builder --chown=nodejs:nodejs /app/client/build ./client/build

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"] 