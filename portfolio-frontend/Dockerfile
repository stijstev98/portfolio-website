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

FROM node:18-alpine
RUN apk add --no-cache nginx
WORKDIR /app
COPY --from=base /app /app
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY nginx.conf /etc/nginx/http.d/default.conf
RUN chmod +x /docker-entrypoint.sh
ENV STRAPI_URL=http://strapi:1337
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
