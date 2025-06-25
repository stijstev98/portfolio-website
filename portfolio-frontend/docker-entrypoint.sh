#!/bin/sh
set -e

# wait for Strapi to be reachable
until curl -s "$STRAPI_URL" >/dev/null 2>&1; do
  echo "Waiting for Strapi at $STRAPI_URL..."
  sleep 3
done

npm run build
cp -r _site/* /usr/share/nginx/html/
exec nginx -g 'daemon off;'
