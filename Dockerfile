# =============================
# 🔧 Build backend dependencies
# =============================
FROM node:18-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

# Remove frontend to avoid copying it into backend later
RUN rm -rf client

# =============================
# 🎨 Build frontend
# =============================
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package.json and lockfile first for caching
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install

# Now copy the rest of the frontend app
COPY client/ /app/client/

# Build React app
RUN npm run build

# =============================
# 🚀 Production image
# =============================
FROM node:18-alpine AS production

# For graceful shutdown
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy backend
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

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', res => process.exit(res.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]