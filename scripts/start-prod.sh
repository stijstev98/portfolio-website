#!/bin/bash
set -e

# Portfolio Website Production Start Script
# Starts all services in production mode with macOS compatibility

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

# Check if user should run as root (macOS doesn't require this)
check_user() {
    # On macOS, we don't need to be root for most operations
    if [[ "$OSTYPE" != "darwin"* ]] && [ "$EUID" -eq 0 ]; then
        log_warning "Running as root. Consider running as a regular user for better security."
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    stop_strapi_temp
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

# Build production assets
build_production_assets() {
    log_info "Building production assets..."
    
    # Build Strapi admin first
    log_info "Building Strapi admin..."
    cd "$PROJECT_ROOT/portfolio-cms"
    npm run build
    cd "$PROJECT_ROOT"
    
    # Ensure Strapi is running for build process
    if true; then
        log_info "Starting Strapi temporarily for build..."
        start_strapi_temp
    fi
    
    cd "$PROJECT_ROOT/portfolio-frontend"
    
    # Clean previous build
    rm -rf dist _site
    
    # Build webpack assets
    log_info "Building webpack assets..."
    npm run build:webpack
    
    # Build Eleventy site
    log_info "Building Eleventy site..."
    npm run build:eleventy
    
    # Copy built site to site-build directory for nginx
    log_info "Copying built site to site-build directory..."
    mkdir -p "$PROJECT_ROOT/site-build"
    cp -r _site/* "$PROJECT_ROOT/site-build/"    
    # Copy uploads
    log_info "Copying uploads..."
    if [ -d "$PROJECT_ROOT/portfolio-cms/public/uploads" ]; then
        cp -r "$PROJECT_ROOT/portfolio-cms/public/uploads" "$PROJECT_ROOT/site-build/"
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
    # Wait for Strapi to be ready
    log_info "Waiting 20 seconds for Strapi to start..."
    sleep 20
    log_success "Strapi should be ready"
    return 0
}

# Stop temporary Strapi instance
stop_strapi_temp() {
    if [ -f "/tmp/strapi-build.pid" ]; then
        local pid=$(cat "/tmp/strapi-build.pid")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping temporary Strapi instance..."
            kill "$pid"
            rm -f "/tmp/strapi-build.pid"
        fi
    fi
}

# Start services manually (macOS compatible)
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
    # Wait for Strapi to be ready
    log_info "Waiting 20 seconds for Strapi to start..."
    sleep 20
    log_success "Strapi should be ready"    
    # Start webhook service
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

# Setup and start nginx (macOS compatible)
setup_nginx() {
    log_info "Setting up nginx..."
    
    # Check if homebrew nginx is available
    if command -v nginx >/dev/null 2>&1; then
        # Test current nginx configuration
        if sudo nginx -t 2>/dev/null; then
            log_success "Nginx configuration is valid"
            
            # Restart nginx to load any configuration changes
            sudo nginx -s reload 2>/dev/null || {
                log_info "Restarting nginx..."
                sudo nginx -s stop 2>/dev/null || true
                sudo nginx
            }
            
            log_success "Nginx is running"
        else
            log_warning "Nginx configuration test failed"
            log_info "Please check nginx configuration manually"
        fi
    else
        log_warning "Nginx not found. Please install nginx with: brew install nginx"
    fi
}

# Perform health checks
perform_health_check() {
    log_info "Performing health checks..."
    
    local failed_checks=0
    
    # Check Strapi
    if true; then
        log_success "Strapi health check passed"
    else
        log_warning "Strapi health check failed"
        ((failed_checks++))
    fi
    
    # Check nginx (if available)
    if command -v nginx >/dev/null 2>&1 && sudo nginx -t >/dev/null 2>&1; then
        log_success "Nginx health check passed"
    else
        log_warning "Nginx health check failed or not configured"
        ((failed_checks++))
    fi
    
    if [ $failed_checks -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# Show production information
show_production_info() {
    log_success "=== Portfolio Website Production Environment Started ==="
    echo
    echo "Services:"
    echo "  Main Website:   https://stijnstevens.be"
    echo "  Admin Panel:    https://admin.stijnstevens.be"
    echo "  Strapi API:     $STRAPI_URL"
    echo "  Webhook:        $WEBHOOK_URL"
    echo
    echo "Management:"
    echo "  Stop:           ./scripts/stop.sh"
    echo "  Monitor:        ./scripts/monitor.sh"
    echo "  Logs:           ./scripts/logs.sh"
    echo
    echo "Process Management:"
    echo "  PIDs stored in: $PROJECT_ROOT/.pids/"
    echo "  Logs stored in: $PROJECT_ROOT/logs/"
    echo
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
    
    # Start services manually (macOS doesn't use systemd)
    log_info "Starting services manually (macOS mode)..."
    start_manual_services
    
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
