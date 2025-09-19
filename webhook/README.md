# Strapi Webhook Handler

A lightweight Node.js service that handles webhooks from Strapi CMS to automatically rebuild the portfolio website when content changes.

## Features

- Receives webhooks from Strapi when posts are added, updated, or deleted
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
  "message": "Site rebuild completed successfully"
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
3. If valid, it executes the webhook script to rebuild the site
4. The webhook script triggers a rebuild of the Eleventy site with fresh data from Strapi
5. The rebuilt site is served by nginx

## Script-Based Setup

The service runs as a native Node.js process and is managed by the portfolio management scripts. Use `./scripts/portfolio.sh` to manage the webhook service along with other components.

## Security

- Token-based authentication for webhook verification
- Runs as a system process without elevated privileges
- Only exposes necessary ports for webhook handling
