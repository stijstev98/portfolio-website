FROM node:18-bullseye as base

# Install build requirements for canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libjpeg62-turbo-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

FROM node:18-bullseye
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libgif7 \
    librsvg2-2 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=base /app /app
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY nginx.conf /etc/nginx/sites-available/default
RUN chmod +x /docker-entrypoint.sh && \
    mkdir -p /usr/share/nginx/html && \
    chown -R www-data:www-data /usr/share/nginx/html

ENV STRAPI_URL=http://strapi:1337
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
