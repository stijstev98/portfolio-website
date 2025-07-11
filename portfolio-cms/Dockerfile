FROM node:18-alpine

# Install dependencies for building native modules and image processing
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies, clearing cache and node_modules first
RUN rm -rf node_modules package-lock.json && npm cache clean --force && npm install

# Copy application files
COPY . .

# Build Strapi admin
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production && rm -rf /root/.npm

# Create uploads directory and fix permissions
RUN mkdir -p public/uploads && \
    chown -R node:node /app

# Expose Strapi port
EXPOSE 1337

# Use node user for security
USER node

CMD ["npm", "start"]
