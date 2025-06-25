# Deployment Guide

This project is split into two parts:
- **portfolio-cms** – a Strapi CMS.
- **portfolio-frontend** – an Eleventy static site that pulls data from Strapi.

The provided Docker Compose setup builds and runs both applications along with a
small webhook server. The webhook server listens for GitHub pushes and Strapi
content changes so the static site stays up to date.

## 1. Prerequisites

* A machine with Docker and Docker Compose installed (your Mac mini).
* Ports 22, 80 and 443 forwarded to that machine.
* A domain name pointing to your home IP (optional but recommended).

## 2. Preparing the Repository

Clone the repository on the server:

```bash
git clone <your fork or repo url>
cd portfolio-website
```

Copy the example environment file and edit the values to strong secrets:

```bash
cp .env.example .env
nano .env
```

The **APP_KEYS** and other Strapi variables must be filled in. The webhook
secrets can be any random strings; you will use them when configuring GitHub and
Strapi.

## 3. Building and Running with Docker

From the project root run:

```bash
docker compose build
docker compose up -d
```

This will build the Strapi, frontend and webhook images, then start the
containers. The first start may take a while because the frontend waits for
Strapi and then generates the static files.

Once the containers are running you should be able to visit:

* `http://<server-ip>/` – your static site.
* `http://<server-ip>/admin/` – the Strapi admin panel.

## 4. Configuring Webhooks

### GitHub

1. Go to the repository settings on GitHub and open **Webhooks**.
2. Add a webhook with:
   * **Payload URL**: `http://<your-domain>/webhook/github`
   * **Content type**: `application/json`
   * **Secret**: the value of `GITHUB_SECRET` from your `.env` file.
   * **Event**: choose **Just the push event**.

When you push to the `main` branch the webhook container will pull the latest
code, rebuild the images and restart the services.

### Strapi

In the Strapi admin panel open **Settings → Webhooks** and create a new webhook:

* **URL**: `http://<your-domain>/webhook/strapi`
* **Header**: `Authorization: Bearer <STRAPI_WEBHOOK_SECRET from .env>`
* **Events**: choose the entry create/update/delete events you want.

Whenever content changes, the frontend container is restarted which rebuilds the
static site using the new data.

## 5. Useful Commands

- `docker compose ps` – check running containers.
- `docker compose logs -f <service>` – view logs.
- `docker compose down` – stop all containers.
- `docker compose pull && docker compose build && docker compose up -d` – manual
  update without the webhook server.

## 6. Notes on Building Packages

Both Strapi and Eleventy depend on native modules (`sharp` and `canvas`). The
Dockerfiles install the build tools and libraries required for these modules so
they compile correctly on Apple Silicon. If you ever run `npm install` outside
Docker on your Mac, run `./portfolio-frontend/fix-canvas-module.sh` to rebuild
`canvas` for your architecture.

---
With this setup you can manage content in Strapi and push code to GitHub.
Everything is rebuilt automatically using Docker.

