FROM node:18-alpine

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build Strapi admin
RUN npm run build

# Create uploads directory
RUN mkdir -p public/uploads

# Expose Strapi port
EXPOSE 1337

# Use node user for security
USER node

CMD ["npm", "start"]
