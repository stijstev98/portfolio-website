# Complete Docker Migration & Deployment Guide

## Overview

This guide will help you migrate from your current PM2/manual setup to a robust Docker-based deployment that includes:
- ✅ Separate Strapi CMS and Eleventy containers
- ✅ Automatic deployments on GitHub push
- ✅ Automatic site rebuilds when Strapi content changes
- ✅ Fixed image display issues
- ✅ SSL termination and reverse proxy
- ✅ Easy maintenance and updates

**Total Time Required**: 1.5-2 hours  
**Difficulty**: Intermediate  
**Prerequisites**: SSH access to your Mac Mini, GitHub account

---

## Part 1: Pre-Migration Setup (20 minutes)

### Step 1: Create Backups (5 minutes)

SSH into your Mac Mini:
```bash
ssh username@213.119.10.249
```

Create comprehensive backups:
```bash
# Backup current Strapi data
cd ~/Developer/portfolio-website/portfolio-cms
cp -r .tmp ~/strapi-backup-$(date +%Y%m%d)
cp -r public/uploads ~/uploads-backup-$(date +%Y%m%d)
cp .env ~/strapi-env-backup-$(date +%Y%m%d) 2>/dev/null || echo "No .env file found"

# Backup current nginx config
sudo cp /opt/homebrew/etc/nginx/nginx.conf ~/nginx-backup-$(date +%Y%m%d).conf

echo "✅ Backups created in home directory"
```

### Step 2: Stop Current Services (3 minutes)

```bash
# Stop all PM2 processes
pm2 stop all
pm2 save

# Stop nginx
sudo brew services stop nginx

echo "✅ Old services stopped"
```

### Step 3: Install Docker (5 minutes)

```bash
# Install Docker Desktop or CLI tools
brew install docker docker-compose

# If you prefer Docker Desktop:
# brew install --cask docker
# (Then start Docker Desktop via Applications)

echo "✅ Docker installed"
```

### Step 4: Prepare Current Repository (7 minutes)

Since you already have separated directories, we just need to add Docker configurations:

```bash
cd ~/Developer/portfolio-website

# Ensure we're on the latest code
git status
git pull origin main || echo "Already up to date"

echo "✅ Repository prepared"
```

### Step 5: Add Docker Configuration to Frontend (5 minutes)

```bash
cd ~/Developer/portfolio-website/portfolio-frontend
```

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build static site
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/_site /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

Update your Strapi data fetching to use environment variable. Check if you have `src/_data/strapi.js` or similar:
```javascript
module.exports = {
  url: process.env.STRAPI_URL || 'http://localhost:1337',
  apiUrl: function() {
    return `${this.url}/api`;
  }
};
```

### Step 6: Add Docker Configuration to CMS (5 minutes)

```bash
cd ~/Developer/portfolio-website/portfolio-cms
```

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build Strapi admin
RUN npm run build

# Create uploads directory
RUN mkdir -p public/uploads

# Expose Strapi port
EXPOSE 1337

# Use node user for security
USER node

CMD ["npm", "start"]
```

Update `config/middlewares.js` to fix CORS:
```javascript
module.exports = [
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: ['https://stijnstevens.be', 'https://admin.stijnstevens.be', 'http://localhost:8080'],
      headers: ['Content-Type', 'Authorization', 'X-Frame-Options'],
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

---

## Part 2: Server Setup (40 minutes)

### Step 7: Create Docker Project Structure (5 minutes)

Back on your **Mac Mini server**:

```bash
# Create project directory
cd ~
mkdir portfolio-docker
cd portfolio-docker

# Create required directories
mkdir -p nginx/ssl scripts webhook-handler

# Clone your existing repository
git clone https://github.com/stijstev98/portfolio-website.git

echo "✅ Project structure created"
```

### Step 8: Create Docker Compose Configuration (10 minutes)

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  nginx-proxy:
    image: nginx:alpine
    container_name: portfolio-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - strapi-uploads:/app/uploads:ro
    depends_on:
      - strapi
      - eleventy
    networks:
      - portfolio
    restart: unless-stopped

  strapi:
    build:
      context: ./portfolio-website/portfolio-cms
      dockerfile: Dockerfile
    container_name: portfolio-strapi
    environment:
      - DATABASE_CLIENT=sqlite
      - DATABASE_FILENAME=/data/strapi.db
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
      - APP_KEYS=${APP_KEYS}
      - API_TOKEN_SALT=${API_TOKEN_SALT}
      - TRANSFER_TOKEN_SALT=${TRANSFER_TOKEN_SALT}
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=1337
    volumes:
      - strapi-data:/data
      - strapi-uploads:/app/public/uploads
    networks:
      - portfolio
    restart: unless-stopped

  eleventy:
    build:
      context: ./portfolio-website/portfolio-frontend
      dockerfile: Dockerfile
    container_name: portfolio-eleventy
    environment:
      - STRAPI_URL=http://strapi:1337
    depends_on:
      - strapi
    networks:
      - portfolio
    restart: unless-stopped

  webhook-handler:
    build:
      context: ./webhook-handler
      dockerfile: Dockerfile
    container_name: portfolio-webhooks
    environment:
      - GITHUB_SECRET=${GITHUB_WEBHOOK_SECRET}
      - STRAPI_SECRET=${STRAPI_WEBHOOK_SECRET}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./scripts:/scripts
      - ./portfolio-website:/portfolio-website
    networks:
      - portfolio
    restart: unless-stopped

networks:
  portfolio:
    driver: bridge

volumes:
  strapi-data:
  strapi-uploads:
```

### Step 9: Create Nginx Configuration (10 minutes)

Create `nginx/nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # HTTP to HTTPS redirect for main site
    server {
        listen 80;
        server_name stijnstevens.be www.stijnstevens.be;
        return 301 https://stijnstevens.be$request_uri;
    }

    # Main portfolio site (HTTPS)
    server {
        listen 443 ssl http2;
        server_name stijnstevens.be www.stijnstevens.be;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Redirect www to non-www
        if ($host = www.stijnstevens.be) {
            return 301 https://stijnstevens.be$request_uri;
        }

        # Serve Eleventy static files
        location / {
            proxy_pass http://eleventy:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Enable caching for static assets
            location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                proxy_pass http://eleventy:80;
                proxy_set_header Host $host;
                expires 30d;
                add_header Cache-Control "public, immutable";
            }
        }

        # Serve Strapi uploads directly - FIXES IMAGE DISPLAY
        location /uploads/ {
            alias /app/uploads/;
            expires 30d;
            add_header Cache-Control "public, immutable";
            add_header Access-Control-Allow-Origin "https://stijnstevens.be" always;
            
            # Handle missing files gracefully
            try_files $uri =404;
        }

        # Webhook endpoints
        location /webhook/ {
            limit_req zone=api burst=5 nodelay;
            proxy_pass http://webhook-handler:3000/webhook/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # HTTP to HTTPS redirect for admin
    server {
        listen 80;
        server_name admin.stijnstevens.be;
        return 301 https://admin.stijnstevens.be$request_uri;
    }

    # Strapi admin subdomain (HTTPS)
    server {
        listen 443 ssl http2;
        server_name admin.stijnstevens.be;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Increase body size for file uploads
        client_max_body_size 50M;

        location / {
            proxy_pass http://strapi:1337;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeout settings for long operations
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
```

### Step 10: Create Webhook Handler (10 minutes)

Create `webhook-handler/package.json`:
```json
{
  "name": "portfolio-webhook-handler",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

Create `webhook-handler/index.js`:
```javascript
const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

const GITHUB_SECRET = process.env.GITHUB_SECRET;
const STRAPI_SECRET = process.env.STRAPI_SECRET;

console.log('Webhook handler starting...');
console.log('GitHub secret configured:', !!GITHUB_SECRET);
console.log('Strapi secret configured:', !!STRAPI_SECRET);

// Helper function to execute commands
function executeScript(scriptPath, description) {
    return new Promise((resolve, reject) => {
        console.log(`Starting: ${description}`);
        exec(scriptPath, { cwd: '/scripts' }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error in ${description}:`, error);
                reject(error);
            } else {
                console.log(`Success: ${description}`);
                console.log('STDOUT:', stdout);
                if (stderr) console.log('STDERR:', stderr);
                resolve(stdout);
            }
        });
    });
}

// GitHub webhook - redeploy on push
app.post('/webhook/github', async (req, res) => {
    try {
        const signature = req.headers['x-hub-signature-256'];
        const payload = JSON.stringify(req.body);
        const hash = `sha256=${crypto.createHmac('sha256', GITHUB_SECRET).update(payload).digest('hex')}`;
        
        if (signature !== hash) {
            console.log('GitHub signature mismatch!');
            return res.status(401).send('Unauthorized');
        }

        // Only deploy on main branch pushes
        if (req.body.ref === 'refs/heads/main') {
            console.log('Valid GitHub webhook received for main branch');
            res.status(200).send('Deployment started');
            
            try {
                await executeScript('./deploy-site.sh', 'Site deployment');
            } catch (error) {
                console.error('Deployment failed:', error);
            }
        } else {
            console.log('GitHub webhook received for non-main branch, ignoring');
            res.status(200).send('Non-main branch, ignored');
        }
    } catch (error) {
        console.error('GitHub webhook error:', error);
        res.status(500).send('Internal server error');
    }
});

// Strapi webhook - rebuild site on content change
app.post('/webhook/strapi', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (token !== STRAPI_SECRET) {
            console.log('Strapi authorization failed!');
            return res.status(401).send('Unauthorized');
        }

        console.log('Valid Strapi webhook received');
        res.status(200).send('Rebuild started');
        
        try {
            await executeScript('./rebuild-eleventy.sh', 'Eleventy rebuild');
        } catch (error) {
            console.error('Rebuild failed:', error);
        }
    } catch (error) {
        console.error('Strapi webhook error:', error);
        res.status(500).send('Internal server error');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        github_secret: !!GITHUB_SECRET,
        strapi_secret: !!STRAPI_SECRET
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Webhook handler listening on port ${PORT}`);
});
```

Create `webhook-handler/Dockerfile`:
```dockerfile
FROM node:18-alpine

# Install docker CLI for container management
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
```

### Step 11: Create Deployment Scripts (5 minutes)

Create `scripts/deploy-site.sh`:
```bash
#!/bin/sh
set -e

echo "🚀 Starting full site deployment..."

# Navigate to project root
cd /portfolio-website

echo "📥 Pulling latest changes..."
git pull origin main

echo "🏗️  Building new images..."
cd /
docker-compose build --no-cache

echo "🔄 Restarting services..."
docker-compose up -d

echo "✅ Site deployment complete!"
```

Create `scripts/rebuild-eleventy.sh`:
```bash
#!/bin/sh
set -e

echo "🔄 Starting Eleventy rebuild..."

echo "🏗️  Rebuilding frontend with latest content..."
docker-compose build eleventy --no-cache

echo "🔄 Restarting Eleventy service..."
docker-compose restart eleventy

echo "✅ Eleventy rebuild complete!"
```

```bash
chmod +x scripts/*.sh
echo "✅ Deployment scripts created"
```

---

## Part 3: Data Migration & Launch (30 minutes)

### Step 12: Configure Environment Variables (5 minutes)

Create `.env` file with secure secrets:
```bash
# Generate environment file
cat > .env << EOF
# Strapi Secrets
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_JWT_SECRET=$(openssl rand -base64 32)
APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)
API_TOKEN_SALT=$(openssl rand -base64 32)
TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)

# Webhook Secrets
GITHUB_WEBHOOK_SECRET=$(openssl rand -base64 32)
STRAPI_WEBHOOK_SECRET=$(openssl rand -base64 32)
EOF

echo "✅ Environment variables configured"
echo "📝 Save these webhook secrets for later configuration:"
echo "GitHub Secret: $(grep GITHUB_WEBHOOK_SECRET .env | cut -d= -f2)"
echo "Strapi Secret: $(grep STRAPI_WEBHOOK_SECRET .env | cut -d= -f2)"
```

### Step 13: Migrate SSL Certificates (5 minutes)

```bash
# Copy existing certificates
sudo cp /etc/letsencrypt/live/stijnstevens.be/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/stijnstevens.be/privkey.pem nginx/ssl/
sudo chown -R $(whoami):staff nginx/ssl/

echo "✅ SSL certificates copied"
```

### Step 14: Migrate Strapi Data (10 minutes)

```bash
echo "📦 Migrating Strapi data..."

# Copy Strapi database if it exists
if [ -f ~/Developer/portfolio-website/portfolio-cms/.tmp/data.db ]; then
    cp ~/Developer/portfolio-website/portfolio-cms/.tmp/data.db ./portfolio-website/portfolio-cms/
    echo "✅ Database copied"
else
    echo "⚠️  No existing database found, will create new one"
fi

# Copy existing uploads to Docker volume location
if [ -d ~/Developer/portfolio-website/portfolio-cms/public/uploads ]; then
    # Create temporary container to populate volume
    docker volume create portfolio-docker_strapi-uploads
    docker run --rm -v ~/Developer/portfolio-website/portfolio-cms/public/uploads:/source -v portfolio-docker_strapi-uploads:/dest alpine sh -c "cp -r /source/* /dest/ 2>/dev/null || echo 'No files to copy'"
    echo "✅ Uploads migrated to Docker volume"
else
    echo "⚠️  No existing uploads found"
fi

# Copy environment variables from old setup
if [ -f ~/Developer/portfolio-website/portfolio-cms/.env ]; then
    echo "📋 Found existing Strapi .env file"
    echo "🔧 You may want to merge any custom configurations manually"
    cp ~/Developer/portfolio-website/portfolio-cms/.env ./portfolio-website/portfolio-cms/.env.backup
fi

echo "✅ Data migration complete"
```

### Step 15: Build and Start Services (10 minutes)

```bash
echo "🚀 Building and starting Docker services..."

# Build all images
echo "🏗️  Building images (this may take a few minutes)..."
docker-compose build

# Start services
echo "🔄 Starting services..."
docker-compose up -d

# Wait a moment for services to start
sleep 15

# Check service status
echo "📊 Service status:"
docker-compose ps

echo "📋 Container logs (last 10 lines each):"
docker-compose logs --tail=10 strapi
docker-compose logs --tail=10 eleventy
docker-compose logs --tail=10 nginx-proxy
docker-compose logs --tail=10 webhook-handler

echo "✅ Docker services started"
```

---

## Part 4: Configuration & Testing (20 minutes)

### Step 16: Configure Webhooks (10 minutes)

```bash
echo "🔗 Webhook configuration required:"
echo ""
echo "1. GitHub Webhook (Main Repository):"
echo "   - Go to: https://github.com/stijstev98/portfolio-website/settings/hooks"
echo "   - Add webhook with these settings:"
echo "     • Payload URL: https://stijnstevens.be/webhook/github"
echo "     • Content type: application/json"
echo "     • Secret: $(grep GITHUB_WEBHOOK_SECRET .env | cut -d= -f2)"
echo "     • Events: Just the push event"
echo ""
echo "2. Strapi Webhook (CMS Admin Panel):"
echo "   - Go to: https://admin.stijnstevens.be/admin"
echo "   - Navigate to: Settings → Webhooks → Create new webhook"
echo "   - Configure:"
echo "     • Name: Rebuild Eleventy"
echo "     • URL: https://stijnstevens.be/webhook/strapi"
echo "     • Headers: Authorization = Bearer $(grep STRAPI_WEBHOOK_SECRET .env | cut -d= -f2)"
echo "     • Events: Select all Entry events (create, update, delete)"
echo ""
echo "✅ Webhook configuration info provided"
```

### Step 17: Comprehensive Testing (10 minutes)

```bash
echo "🧪 Running comprehensive tests..."

# Test 1: Main site accessibility
echo "Test 1: Main site loading..."
if curl -f -s https://stijnstevens.be > /dev/null; then
    echo "✅ Main site accessible"
else
    echo "❌ Main site not accessible"
fi

# Test 2: Admin panel accessibility
echo "Test 2: Admin panel loading..."
if curl -f -s https://admin.stijnstevens.be > /dev/null; then
    echo "✅ Admin panel accessible"
else
    echo "❌ Admin panel not accessible"
fi

# Test 3: Image serving
echo "Test 3: Testing image serving..."
if docker volume ls | grep strapi-uploads > /dev/null; then
    echo "✅ Strapi uploads volume exists"
    
    # Test direct access to uploads
    if curl -f -s https://stijnstevens.be/uploads/ > /dev/null; then
        echo "✅ Upload directory accessible via web"
    else
        echo "⚠️  Upload directory not web accessible (may be empty)"
    fi
else
    echo "❌ Strapi uploads volume missing"
fi

# Test 4: Webhook endpoints
echo "Test 4: Testing webhook endpoints..."
if curl -f -s https://stijnstevens.be/webhook/health > /dev/null; then
    echo "✅ Webhook handler accessible"
else
    echo "❌ Webhook handler not accessible"
fi

echo "✅ Testing complete"
```

---

## Part 5: Finalization (10 minutes)

### Step 18: Clean Up Old Services (5 minutes)

```bash
echo "🧹 Cleaning up old services..."

# Remove old PM2 processes
if command -v pm2 >/dev/null 2>&1; then
    pm2 delete all 2>/dev/null || echo "No PM2 processes to delete"
    pm2 unstartup 2>/dev/null || echo "PM2 not configured for startup"
    echo "✅ PM2 processes cleaned up"
fi

# Archive old setup (keep the current one as backup)
if [ -d ~/Developer/portfolio-website-old ]; then
    rm -rf ~/Developer/portfolio-website-old
fi

# Move current dev setup to old
if [ -d ~/Developer/portfolio-website ]; then
    mv ~/Developer/portfolio-website ~/Developer/portfolio-website-old-backup-$(date +%Y%m%d)
    echo "✅ Old setup archived to ~/Developer/portfolio-website-old-backup-$(date +%Y%m%d)"
    echo "⚠️  Keep this backup for at least a week before deleting"
fi

echo "✅ Cleanup complete"
```

### Step 19: Create Operations Guide (5 minutes)

```bash
echo "📚 Creating operation reference..."

cat > ~/portfolio-docker/OPERATIONS.md << 'EOF'
# Portfolio Docker Operations

## Daily Commands

### Check Status
```bash
cd ~/portfolio-docker
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f strapi
docker-compose logs -f eleventy
docker-compose logs -f nginx-proxy
docker-compose logs -f webhook-handler
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart strapi
```

### Update Services
```bash
# Pull latest code and rebuild
cd portfolio-website && git pull && cd ..
docker-compose build
docker-compose up -d
```

## Maintenance Commands

### Backup Strapi Data
```bash
docker run --rm \
  -v portfolio-docker_strapi-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/strapi-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### SSL Certificate Renewal
```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/stijnstevens.be/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/stijnstevens.be/privkey.pem ./nginx/ssl/
sudo chown -R $(whoami):staff ./nginx/ssl/
docker-compose restart nginx-proxy
```

### Clean Up Docker
```bash
# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Full cleanup (careful!)
docker system prune -a
```

## Troubleshooting

### Services Won't Start
```bash
docker-compose logs [service-name]
docker-compose down
docker-compose up -d
```

### Website Not Loading
1. Check nginx logs: `docker-compose logs nginx-proxy`
2. Check if all containers running: `docker-compose ps`
3. Test internal connectivity: `docker-compose exec nginx-proxy curl -f http://eleventy:80`

### Images Not Displaying
1. Check uploads volume: `docker volume inspect portfolio-docker_strapi-uploads`
2. Check nginx uploads location: `docker-compose exec nginx-proxy ls -la /app/uploads/`
3. Test direct image access: `curl -I https://stijnstevens.be/uploads/[image-name]`

### Webhooks Not Working
1. Check webhook handler logs: `docker-compose logs webhook-handler`
2. Test webhook endpoint: `curl https://stijnstevens.be/webhook/health`
3. Verify secrets in GitHub/Strapi match .env file
EOF

# Create maintenance script
cat > ~/portfolio-maintenance.sh << 'EOF'
#!/bin/bash
cd ~/portfolio-docker

echo "🔍 Portfolio Docker Status"
echo "=========================="
docker-compose ps

echo ""
echo "📊 Resource Usage"
echo "=================="
docker stats --no-stream

echo ""
echo "💾 Volume Usage"
echo "==============="
docker system df

echo ""
echo "📋 Recent Logs"
echo "=============="
docker-compose logs --tail=5 --timestamps
EOF

chmod +x ~/portfolio-maintenance.sh

echo "✅ Operations guide and maintenance script created"
```

---

## Migration Complete! 🎉

### What You've Accomplished

✅ **Migrated to Docker**: Robust containerized architecture using your existing structure  
✅ **Fixed Images**: Strapi uploads now display correctly  
✅ **Automated Deployments**: Push to GitHub = automatic deployment  
✅ **Content Synchronization**: Strapi changes = automatic frontend rebuild  
✅ **Enhanced Security**: Isolated containers with proper SSL  
✅ **Easy Maintenance**: Simple Docker commands for all operations  

### Your New Workflow

**To update your site:**
1. Make changes to `portfolio-frontend/` or `portfolio-cms/`
2. Push to GitHub main branch
3. Site updates automatically!

**To update content:**
1. Login to admin.stijnstevens.be
2. Create/edit content in Strapi
3. Save changes
4. Frontend rebuilds automatically!

### Important URLs

- **Main Site**: https://stijnstevens.be
- **Admin Panel**: https://admin.stijnstevens.be  
- **Repository**: https://github.com/stijstev98/portfolio-website

### Quick Reference

```bash
# Check status
cd ~/portfolio-docker && docker-compose ps

# View logs
docker-compose logs -f

# Restart everything
docker-compose restart

# Run maintenance script
~/portfolio-maintenance.sh
```

### Manual Verification Checklist

Please verify the following manually:

1. **🌐 Website Loading:**
   - Visit: https://stijnstevens.be
   - Check: Site loads completely
   - Check: Images display correctly
   - Check: All pages work

2. **🔧 Strapi Admin:**
   - Visit: https://admin.stijnstevens.be
   - Login with your existing credentials
   - Check: All content is present
   - Check: Media library shows uploaded images
   - Test: Create/edit a post

3. **🔄 Automatic Updates:**
   - Make a small change to your repository
   - Push to main branch
   - Check: Site updates automatically (may take 1-2 minutes)

4. **📝 Content Updates:**
   - Edit content in Strapi admin
   - Save changes
   - Check: Frontend updates automatically (may take 1-2 minutes)

### Need Help?

If you encounter any issues:
1. Check the logs: `docker-compose logs -f`
2. Review the troubleshooting section in `~/portfolio-docker/OPERATIONS.md`
3. Check service status: `docker-compose ps`

Your portfolio is now running on a production-grade Docker infrastructure! 🚀