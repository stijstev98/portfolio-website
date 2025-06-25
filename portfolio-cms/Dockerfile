FROM node:18-alpine

# Install dependencies for building native modules and image processing
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (including dev for build)
RUN npm ci

# Copy application files
COPY . .

# Build Strapi admin
RUN npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production && rm -rf /root/.npm

# Create uploads directory
RUN mkdir -p public/uploads

# Expose Strapi port
EXPOSE 1337

# Run as root so the container can write to mounted volumes
# (the mounted volumes are owned by root by default)
USER root

CMD ["npm", "start"]
