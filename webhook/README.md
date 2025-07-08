# Strapi Webhook Handler

A lightweight Node.js service that handles webhooks from Strapi CMS to automatically rebuild the portfolio website when content changes.

## Features

- Receives webhooks from Strapi when projects are added, updated, or deleted
- Triggers automatic rebuild of the Eleventy-based portfolio site
- Secure token-based authentication
- Docker-based container management
- Health check endpoint for monitoring

## Environment Variables

- `STRAPI_WEBHOOK_SECRET`: Secret token for webhook authentication
- `PORT`: Server port (default: 3000)

## Endpoints

### POST /strapi
Webhook endpoint for Strapi content changes. Requires `Authorization: Bearer <token>` header.

Response format:
```json
{
  "success": true,
  "message": "Site rebuild triggered successfully"
}
```

### GET /health
Health check endpoint for monitoring.

Response format:
```json
{
  "status": "ok",
  "timestamp": "2025-06-29T12:00:00.000Z",
  "service": "strapi-webhook-handler"
}
```

### GET /
Service information endpoint.

## How it Works

1. Strapi sends a webhook when content changes
2. The webhook handler verifies the authentication token
3. If valid, it stops and removes the current Eleventy container
4. Starts a new Eleventy container that rebuilds the site with fresh data
5. The rebuilt site is served by nginx

## Docker Setup

The service runs in a Docker container with access to the Docker socket to manage other containers. It's configured in the main `docker-compose.yml` file.

## Security

- Token-based authentication for webhook verification
- Runs as non-root user in container
- Only exposes necessary ports and volumes
