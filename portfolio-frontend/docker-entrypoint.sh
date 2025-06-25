#!/bin/sh
set -e

echo "Starting frontend service..."

# Wait for Strapi to be reachable at the API endpoint
until wget -q --spider "$STRAPI_URL/api/posts" > /dev/null 2>&1; do
  echo "Waiting for Strapi at $STRAPI_URL..."
  sleep 3
done

echo "Building static site..."
npm run build

echo "Copying Strapi uploads to static site..."
# Copy uploads from the mounted volume (if it exists)
if [ -d "/app/public/uploads" ]; then
  cp -r /app/public/uploads /usr/share/nginx/html/ 2>/dev/null || true
fi

echo "Copying files to nginx..."
cp -r _site/* /usr/share/nginx/html/

echo "Starting nginx..."
exec nginx -g 'daemon off;'
