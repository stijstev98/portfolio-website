#!/bin/sh
set -e

echo "Starting frontend build..."

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
  cp -r /app/public/uploads /app/_site/
fi

echo "Build finished. The files are in /app/_site. The volume is mounted there."
