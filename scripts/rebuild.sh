#!/bin/sh
set -e

echo "Rebuilding static site..."
docker compose restart eleventy
