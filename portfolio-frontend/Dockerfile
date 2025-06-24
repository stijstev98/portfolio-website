FROM node:18-bullseye-slim as builder

# Install dependencies for sharp (much simpler than imagemin!)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libvips-dev \
    build-essential

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build static site
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/_site /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
