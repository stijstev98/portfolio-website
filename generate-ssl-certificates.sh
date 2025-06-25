#!/bin/bash

# SSL Certificate Generation Script for stijnstevens.be
# Run this on your production server where the domain points to

echo "🔒 Generating Let's Encrypt SSL certificates for stijnstevens.be"
echo "Email: stijn.stevens@live.com"
echo ""

# Ensure we're in HTTP-only mode for ACME challenge
echo "📝 Switching to HTTP-only mode for certificate generation..."
cat > nginx/conf.d/default.conf <<'NGINX_CONF'
# Temporary config for certificate generation
server {
    listen 80;
    server_name stijnstevens.be admin.stijnstevens.be;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        if ($host = admin.stijnstevens.be) {
            proxy_pass http://strapi:1337;
        }
        proxy_pass http://eleventy:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook endpoints
    location /webhook/ {
        proxy_pass http://webhook:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_Set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# Restart nginx with HTTP-only config
echo "🔄 Restarting nginx..."
docker-compose restart nginx

# Remove any existing certificates
echo "🧹 Cleaning up old certificates..."
rm -rf nginx/certbot/conf/live/stijnstevens.be
rm -rf nginx/certbot/conf/live/admin.stijnstevens.be

# Generate certificate for main domain
echo "📋 Generating certificate for stijnstevens.be..."
docker run --rm \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  --network portfolio-website_default \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email stijn.stevens@live.com \
  --agree-tos --no-eff-email \
  -d stijnstevens.be \
  --non-interactive

if [ $? -eq 0 ]; then
    echo "✅ Successfully generated certificate for stijnstevens.be"
else
    echo "❌ Failed to generate certificate for stijnstevens.be"
    exit 1
fi

# Generate certificate for admin subdomain
echo "📋 Generating certificate for admin.stijnstevens.be..."
docker run --rm \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  --network portfolio-website_default \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email stijn.stevens@live.com \
  --agree-tos --no-eff-email \
  -d admin.stijnstevens.be \
  --non-interactive

if [ $? -eq 0 ]; then
    echo "✅ Successfully generated certificate for admin.stijnstevens.be"
else
    echo "❌ Failed to generate certificate for admin.stijnstevens.be"
    exit 1
fi

# Restore SSL configuration
echo "📝 Restoring full SSL configuration..."
cp nginx/conf.d/default.conf.backup nginx/conf.d/default.conf

# Restart nginx with SSL
echo "🔄 Restarting nginx with SSL..."
docker-compose restart nginx

echo ""
echo "🎉 SSL certificate generation complete!"
echo "✅ Certificates installed for:"
echo "   - stijnstevens.be"
echo "   - admin.stijnstevens.be"
echo ""
echo "📅 Certificates are valid for 90 days"
echo "🔄 Automatic renewal is configured via the certbot container"
