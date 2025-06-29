#!/bin/sh
set -e

echo "Restarting Eleventy container to rebuild with fresh data..."
# Restart the Eleventy service to rebuild with latest Strapi data
docker-compose restart eleventy
echo "Eleventy container restarted successfully!"
