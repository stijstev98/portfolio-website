#!/bin/sh
set -e

echo "Pulling latest code..."
# Pull latest code (including submodules)
git pull --recurse-submodules origin main

echo "Building containers..."
# Build only necessary services
docker compose build --pull strapi eleventy webhook

echo "Restarting services..."
docker compose up -d strapi eleventy webhook
