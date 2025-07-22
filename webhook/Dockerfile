FROM node:18-alpine

# Install Docker CLI and bash for script execution
RUN apk add --no-cache docker-cli docker-compose bash curl

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Run as root to access Docker socket
# In production, this should be secured with proper Docker socket permissions

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "index.js"]
