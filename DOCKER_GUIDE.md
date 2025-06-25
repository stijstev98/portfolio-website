# Docker Container Management Guide

This guide explains how to manage the Docker containers for your portfolio website.

## Overview

Your portfolio website consists of the following containers:
- **Strapi**: Backend CMS (API and admin interface)
- **Eleventy**: Static site generator with Nginx
- **Nginx**: Main web server and reverse proxy
- **Webhook**: Deployment trigger service
- **Certbot**: SSL certificate management

## Quick Commands

### Stop All Containers
```bash
docker-compose down
```

### Start All Containers (without rebuilding)
```bash
docker-compose up -d
```

### Rebuild and Start All Containers
```bash
docker-compose build && docker-compose up -d
```

### Check Container Status
```bash
docker-compose ps
```

### View Logs
```bash
# All containers
docker-compose logs

# Specific container
docker-compose logs strapi
docker-compose logs eleventy
docker-compose logs nginx

# Follow logs in real-time
docker-compose logs -f eleventy
```

## Step-by-Step Container Management

### 1. Stopping Containers

**Stop all containers:**
```bash
docker-compose down
```

**Stop specific containers:**
```bash
docker-compose stop strapi eleventy
```

### 2. Building Containers

**Build all containers:**
```bash
docker-compose build
```

**Build specific containers:**
```bash
docker-compose build strapi
docker-compose build eleventy
```

**Force rebuild (no cache):**
```bash
docker-compose build --no-cache
```

### 3. Running Containers

**Start all containers:**
```bash
docker-compose up -d
```

**Start specific containers:**
```bash
docker-compose up -d strapi eleventy
```

**Start containers and view logs:**
```bash
docker-compose up
```

## Recommended Workflow

### For Content Updates (Strapi changes)
When you update content in Strapi, you typically need to rebuild Eleventy to regenerate the static site:

```bash
# Rebuild and restart Eleventy to fetch latest content
docker-compose build eleventy && docker-compose up -d eleventy
```

### For Code Changes

**Frontend changes (Eleventy):**
```bash
docker-compose build eleventy && docker-compose up -d eleventy
```

**Backend changes (Strapi):**
```bash
docker-compose build strapi && docker-compose up -d strapi
```

**Full rebuild after major changes:**
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### For Complete Fresh Start
```bash
# Stop everything
docker-compose down

# Rebuild Strapi first (backend dependency)
docker-compose build strapi && docker-compose up -d strapi

# Wait a moment for Strapi to start, then build others
sleep 10
docker-compose build && docker-compose up -d
```

## Troubleshooting

### Check if containers are running
```bash
docker-compose ps
```

### View recent logs for debugging
```bash
docker-compose logs --tail=50 eleventy
docker-compose logs --tail=50 strapi
```

### Check specific error messages
```bash
docker-compose logs eleventy | grep -i error
```

### Restart a problematic container
```bash
docker-compose restart eleventy
```

### Complete cleanup and restart
```bash
# Stop all containers
docker-compose down

# Remove old images (optional)
docker system prune -f

# Rebuild and start fresh
docker-compose build --no-cache && docker-compose up -d
```

## Container Dependencies

- **Strapi** should start first (provides API for Eleventy)
- **Eleventy** depends on Strapi for content
- **Nginx** serves the static files from Eleventy
- **Webhook** and **Certbot** are independent services

## Environment Variables

Make sure your `.env` file contains:
```
STRAPI_URL=http://strapi:1337
```

## Common Workflows

### Morning startup:
```bash
docker-compose up -d
```

### After content changes:
```bash
docker-compose build eleventy && docker-compose up -d eleventy
```

### End of day shutdown:
```bash
docker-compose down
```

### Weekly maintenance:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Notes

- Always start Strapi before Eleventy when doing fresh builds
- The `--no-cache` flag forces a complete rebuild but takes longer
- Use `-d` flag to run containers in detached mode (background)
- View logs without `-d` to debug build issues
- Eleventy builds the static site from Strapi data during container startup
