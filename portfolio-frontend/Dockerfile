# Use Ubuntu LTS for best compatibility with native modules on ARM
FROM node:18-jammy as builder

# Install a comprehensive list of dependencies for both `sharp` and `canvas`
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    libvips-dev \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
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
