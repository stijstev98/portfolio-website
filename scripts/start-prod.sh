#!/bin/bash
set -e

# Portfolio Website Production Start Script
# Starts all services in production mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Setup environment
setup_environment() {
    log_info "Setting up production environment..."
    
    # Load production environment
    source "$SCRIPT_DIR/env-setup.sh" prod
    
    # Check dependencies
    if ! "$SCRIPT_DIR/check-dependencies.sh"; then
        log_error "Dependency check failed. Please resolve issues before continuing."
        exit 1
    fi
    
    log_success "Environment setup complete"
}

# Check if running as appropriate user
check_user() {
    local current_user
    current_user=$(whoami)
    
    if [ "$current_user" = "root" ]; then
        log_warning "Running as root. Consider running as service user for security."
    fi
}

# Build production assets
build_production_assets() {
    log_info "Building production assets..."
    
    # Ensure Strapi is running for build process
    if ! curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
        log_info "Starting Strapi temporarily for build..."
        start_strapi_temp
    fi
    
    cd "$PROJECT_ROOT/portfolio-frontend"
    
    # Clean previous build
    rm -rf _site
    
    # Set production environment
    export NODE_ENV=production
    export ELEVENTY_ENV=production
    export STRAPI_URL="$STRAPI_URL"
    export NODE_OPTIONS="--openssl-legacy-provider"
    
    # Build webpack assets
    log_info "Building webpack assets..."
    npm run build:webpack
    
    # Build Eleventy site
    log_info "Building Eleventy site..."
    npm run build:eleventy
    
    # Copy uploads
    if [ -d "$PROJECT_ROOT/portfolio-cms/public/uploads" ]; then
        log_info "Copying uploads..."
        cp -r "$PROJECT_ROOT/portfolio-cms/public/uploads" "_site/"
    fi
    
    # Copy built site to deployment location
    if [ -n "$SITE_BUILD_PATH" ] && [ "$SITE_BUILD_PATH" != "./_site" ]; then
        log_info "Copying site to deployment location..."
        mkdir -p "$SITE_BUILD_PATH"
        cp -r _site/* "$SITE_BUILD_PATH/"
    fi
    
    log_success "Production assets built"
    cd "$PROJECT_ROOT"
}

# Start Strapi temporarily for build
start_strapi_temp() {
    cd "$PROJECT_ROOT/portfolio-cms"
    
    export NODE_ENV=production
    export DATABASE_CLIENT=sqlite
    # DATABASE_FILENAME is set in .env file
    export STRAPI_TELEMETRY_DISABLED=true
    
    # Start Strapi in background
    npm run start &
    local strapi_pid=$!
    echo $strapi_pid > "/tmp/strapi-build.pid"
    
    # Wait for Strapi to be ready
    local max_wait=60
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi is ready"
            break
        fi
        sleep 2
        ((waited += 2))
    done
    
    cd "$PROJECT_ROOT"
}

# Stop temporary Strapi
stop_strapi_temp() {
    if [ -f "/tmp/strapi-build.pid" ]; then
        local strapi_pid
        strapi_pid=$(cat "/tmp/strapi-build.pid")
        if kill -0 "$strapi_pid" 2>/dev/null; then
            log_info "Stopping temporary Strapi instance..."
            kill "$strapi_pid" 2>/dev/null || true
        fi
        rm -f "/tmp/strapi-build.pid"
    fi
}

# Start services using systemd
start_systemd_services() {
    if ! command -v systemctl >/dev/null 2>&1; then
        log_warning "systemctl not available, cannot manage services"
        return 1
    fi
    
    log_info "Starting services with systemd..."
    
    # Start Strapi
    log_info "Starting Strapi service..."
    systemctl start portfolio-strapi
    
    # Wait for Strapi to be ready
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if systemctl is-active --quiet portfolio-strapi && curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi service is running"
            break
        fi
        
        ((attempt++))
        log_info "Waiting for Strapi service... ($attempt/$max_attempts)"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Strapi service failed to start"
        return 1
    fi
    
    # Start Webhook
    log_info "Starting webhook service..."
    systemctl start portfolio-webhook
    
    # Check webhook status
    if systemctl is-active --quiet portfolio-webhook; then
        log_success "Webhook service is running"
    else
        log_error "Webhook service failed to start"
        return 1
    fi
    
    return 0
}

# Start services manually (fallback)
start_manual_services() {
    log_info "Starting services manually..."
    
    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Start Strapi
    log_info "Starting Strapi..."
    cd "$PROJECT_ROOT/portfolio-cms"
    
    export NODE_ENV=production
    export DATABASE_CLIENT=sqlite
    # DATABASE_FILENAME is set in .env file
    export STRAPI_TELEMETRY_DISABLED=true
    
    nohup npm run start > "$PROJECT_ROOT/logs/strapi-prod.log" 2>&1 &
    local strapi_pid=$!
    echo $strapi_pid > "$PROJECT_ROOT/.pids/strapi.pid"
    
    log_success "Strapi started with PID: $strapi_pid"
    
    # Wait for Strapi to be ready
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi is ready at $STRAPI_URL"
            break
        fi
        
        ((attempt++))
        log_info "Waiting for Strapi... ($attempt/$max_attempts)"
        sleep 2
    done
    
    # Start Webhook
    log_info "Starting webhook service..."
    cd "$PROJECT_ROOT/webhook"
    
    export NODE_ENV=production
    export PORT=3000
    
    nohup npm run start > "$PROJECT_ROOT/logs/webhook-prod.log" 2>&1 &
    local webhook_pid=$!
    echo $webhook_pid > "$PROJECT_ROOT/.pids/webhook.pid"
    
    log_success "Webhook started with PID: $webhook_pid"
    
    cd "$PROJECT_ROOT"
}

# Setup and start nginx
setup_nginx() {
    log_info "Setting up nginx..."
    
    # Copy nginx configuration
    local nginx_config_source="$PROJECT_ROOT/nginx-prod/conf.d/default.conf"
    local nginx_config_dest="/etc/nginx/sites-available/portfolio"
    
    if [ -f "$nginx_config_source" ]; then
        cp "$nginx_config_source" "$nginx_config_dest"
        
        # Enable site
        ln -sf "$nginx_config_dest" "/etc/nginx/sites-enabled/portfolio"
        
        # Remove default site if exists
        rm -f "/etc/nginx/sites-enabled/default"
        
        # Test nginx configuration
        if nginx -t; then
            log_success "Nginx configuration is valid"
            
            # Restart nginx
            if command -v systemctl >/dev/null 2>&1; then
                systemctl restart nginx
            else
                nginx -s reload
            fi
            
            log_success "Nginx restarted"
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    else
        log_warning "Nginx configuration not found at $nginx_config_source"
        log_info "Please configure nginx manually"
    fi
}

# Health check
perform_health_check() {
    log_info "Performing health check..."
    
    local failed_checks=0
    
    # Check Strapi
    if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
        log_success "Strapi health check passed"
    else
        log_error "Strapi health check failed"
        ((failed_checks++))
    fi
    
    # Check webhook
    if curl -s "$WEBHOOK_URL/health" >/dev/null 2>&1; then
        log_success "Webhook health check passed"
    else
        log_error "Webhook health check failed"
        ((failed_checks++))
    fi
    
    # Check nginx (if configured)
    if command -v nginx >/dev/null 2>&1 && nginx -t >/dev/null 2>&1; then
        log_success "Nginx health check passed"
    else
        log_warning "Nginx health check failed or not configured"
    fi
    
    return $failed_checks
}

# Display production info
show_production_info() {
    echo
    log_success "=== Production Environment Started ==="
    echo
    echo "Services:"
    echo "  Strapi CMS:     $STRAPI_URL"
    echo "  Strapi Admin:   $STRAPI_ADMIN_URL"
    echo "  Webhook:        $WEBHOOK_URL"
    echo
    echo "Domains:"
    echo "  Main Site:      https://$PRIMARY_DOMAIN"
    echo "  Admin Panel:    https://$ADMIN_DOMAIN"
    echo
    echo "Management:"
    echo "  Status:         ./scripts/manage.sh status"
    echo "  Stop:           ./scripts/manage.sh stop"
    echo "  Restart:        ./scripts/manage.sh restart"
    echo "  Logs:           ./scripts/manage.sh logs"
    echo
    echo "Systemd (if available):"
    echo "  Status:         sudo systemctl status portfolio-strapi portfolio-webhook"
    echo "  Logs:           sudo journalctl -u portfolio-strapi -f"
    echo
}

# Cleanup function
cleanup() {
    stop_strapi_temp
}

# Set up cleanup on exit
trap cleanup EXIT

# Main function
main() {
    log_info "=== Starting Portfolio Website Production Environment ==="
    
    # Check user
    check_user
    
    # Setup environment
    setup_environment
    
    # Build production assets
    build_production_assets
    
    # Stop temporary Strapi
    stop_strapi_temp
    
    # Create PID directory
    mkdir -p "$PROJECT_ROOT/.pids"
    
    # Try to start services with systemd, fallback to manual
    if start_systemd_services; then
        log_success "Services started with systemd"
    else
        log_warning "Systemd not available or failed, starting manually"
        start_manual_services
    fi
    
    # Setup nginx
    setup_nginx
    
    # Wait a bit for services to stabilize
    sleep 5
    
    # Perform health check
    if perform_health_check; then
        log_success "All health checks passed"
    else
        log_warning "Some health checks failed, but continuing..."
    fi
    
    # Show production information
    show_production_info
}

# Run main function
main "$@"
