#!/bin/bash
echo "Triggering Eleventy rebuild..."
cd /workspace
docker-compose up eleventy --no-deps
echo "Eleventy build completed"
