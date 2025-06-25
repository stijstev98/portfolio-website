#!/bin/sh
set -e

echo "Pulling latest code..."
git pull origin main

echo "Building containers..."
docker compose build --pull

echo "Restarting services..."
docker compose up -d
