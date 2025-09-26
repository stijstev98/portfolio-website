#!/bin/bash
set -e

# SSL Certificate Renewal Script for macOS
# Renews Let's Encrypt certificates using webroot method

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root for certbot
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

log_info "=== SSL Certificate Renewal ==="

# Domains to renew
DOMAINS="stijnstevens.be admin.stijnstevens.be"
EMAIL="stijn@stijnstevens.be"

# Create temporary webroot directory for ACME challenge
WEBROOT_PATH="/tmp/acme-challenge"
mkdir -p "$WEBROOT_PATH/.well-known/acme-challenge"
chmod -R 755 "$WEBROOT_PATH"

# Update nginx configuration temporarily for ACME challenge
log_info "Temporarily updating nginx configuration for ACME challenge..."

cat > /opt/homebrew/etc/nginx/nginx-ssl-renewal.conf << 'NGINX_EOF'
events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    # Temporary server for SSL renewal
    server {
        listen 80;
        server_name stijnstevens.be www.stijnstevens.be admin.stijnstevens.be;
        
        location /.well-known/acme-challenge/ {
            root /tmp/acme-challenge;
            try_files $uri =404;
        }
        
        location / {
            return 301 https://$server_name$request_uri;
        }
    }
}
NGINX_EOF

# Backup current nginx config and use temporary one
cp /opt/homebrew/etc/nginx/nginx.conf /opt/homebrew/etc/nginx/nginx.conf.backup
cp /opt/homebrew/etc/nginx/nginx-ssl-renewal.conf /opt/homebrew/etc/nginx/nginx.conf

# Test and reload nginx configuration
if nginx -t; then
    nginx -s reload
    log_success "Nginx configuration updated for SSL renewal"
else
    log_error "Nginx configuration test failed"
    # Restore original config
    cp /opt/homebrew/etc/nginx/nginx.conf.backup /opt/homebrew/etc/nginx/nginx.conf
    exit 1
fi

# Attempt certificate renewal
log_info "Attempting certificate renewal..."

if certbot certonly --webroot \
    -w "$WEBROOT_PATH" \
    -d stijnstevens.be \
    -d admin.stijnstevens.be \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --force-renewal; then
    
    log_success "SSL certificates renewed successfully!"
    
    # Copy new certificates to project directory
    log_info "Copying certificates to project directory..."
    cp /etc/letsencrypt/live/stijnstevens.be/fullchain.pem "$PROJECT_ROOT/nginx/certbot/conf/live/stijnstevens.be/"
    cp /etc/letsencrypt/live/stijnstevens.be/privkey.pem "$PROJECT_ROOT/nginx/certbot/conf/live/stijnstevens.be/"
    cp /etc/letsencrypt/live/stijnstevens.be/fullchain.pem "$PROJECT_ROOT/nginx/certbot/conf/live/admin.stijnstevens.be/"
    cp /etc/letsencrypt/live/stijnstevens.be/privkey.pem "$PROJECT_ROOT/nginx/certbot/conf/live/admin.stijnstevens.be/"
    
    renewal_success=true
else
    log_error "Certificate renewal failed"
    renewal_success=false
fi

# Restore original nginx configuration
log_info "Restoring original nginx configuration..."
cp /opt/homebrew/etc/nginx/nginx.conf.backup /opt/homebrew/etc/nginx/nginx.conf

if nginx -t; then
    nginx -s reload
    log_success "Original nginx configuration restored"
else
    log_error "Failed to restore nginx configuration"
fi

# Clean up
rm -f /opt/homebrew/etc/nginx/nginx-ssl-renewal.conf
rm -rf "$WEBROOT_PATH"

if [ "$renewal_success" = true ]; then
    # Check certificate expiry
    expiry_date=$(openssl x509 -in /etc/letsencrypt/live/stijnstevens.be/cert.pem -text -noout | grep "Not After" | sed 's/.*Not After : //')
    log_success "Certificates are now valid until: $expiry_date"
    
    log_info "=== SSL Certificate Renewal Complete ==="
    echo "Your SSL certificates have been successfully renewed!"
    echo "The certificates are valid for both:"
    echo "  - stijnstevens.be"
    echo "  - admin.stijnstevens.be"
    echo ""
    echo "To set up automatic renewal, add this to your crontab (sudo crontab -e):"
    echo "0 2 1 * * $SCRIPT_DIR/renew-ssl.sh >> $PROJECT_ROOT/logs/ssl-renewal.log 2>&1"
else
    exit 1
fi
