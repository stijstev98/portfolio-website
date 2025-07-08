#!/bin/sh
echo "Restarting Eleventy container to trigger rebuild..."
docker restart portfolio-website-eleventy-1
echo "Eleventy restart completed"
