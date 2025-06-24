# Use a standard Debian-based image which has great ARM64 support
FROM node:18-bullseye as builder

# Install a comprehensive list of dependencies needed to compile `canvas` for ARM64
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libjpeg62-turbo-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Delete any existing node_modules that might have been copied (safety measure)
RUN rm -rf node_modules

# Install dependencies (will now compile canvas correctly for linux/arm64)
RUN npm ci

# Copy source files (excluding node_modules thanks to .dockerignore)
COPY . .

# Build static site
RUN npm run build

# --- Production Stage (still nice and small) ---
FROM nginx:alpine

# Copy built files from the builder stage
COPY --from=builder /app/_site /usr/share/nginx/html

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
