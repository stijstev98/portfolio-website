#!/bin/bash
set -e

# Portfolio Website Production Webhook Handler Script
# Handles Strapi content change webhooks and triggers site rebuilds

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

# Log with timestamp
log_with_timestamp() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Setup environment
setup_environment() {
    # Load production environment
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

# Wait for Strapi to be ready
wait_for_strapi() {
    log_info "Waiting for Strapi to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi is ready"
            return 0
        fi
        
        ((attempt++))
        log_info "Waiting for Strapi... ($attempt/$max_attempts)"
        sleep 2
    done
    
    log_error "Strapi is not responding after $max_attempts attempts"
    return 1
}

# Build production site
build_production_site() {
    local trigger_reason="${1:-webhook}"
    
    log_with_timestamp "Starting site rebuild (triggered by: $trigger_reason)" >> "$PROJECT_ROOT/logs/webhook.log"
    log_info "Building production site..."
    
    cd "$PROJECT_ROOT/portfolio-frontend"
    
    # Set environment variables
    export NODE_ENV=production
    export ELEVENTY_ENV=production
    export STRAPI_URL="$STRAPI_URL"
    export NODE_OPTIONS="--openssl-legacy-provider"
    
    # Clean previous build
    rm -rf _site
    
    # Build webpack assets
    log_info "Building webpack assets..."
    if npm run build:webpack >> "$PROJECT_ROOT/logs/webhook.log" 2>&1; then
        log_success "Webpack build completed"
    else
        log_error "Webpack build failed"
        return 1
    fi
    
    # Build Eleventy site
    log_info "Building Eleventy site..."
    if npm run build:eleventy >> "$PROJECT_ROOT/logs/webhook.log" 2>&1; then
        log_success "Eleventy build completed"
    else
        log_error "Eleventy build failed"
        return 1
    fi
    
    # Copy uploads
    if [ -d "$PROJECT_ROOT/portfolio-cms/public/uploads" ]; then
        log_info "Copying uploads..."
        cp -r "$PROJECT_ROOT/portfolio-cms/public/uploads" "_site/" || {
            log_warning "Failed to copy uploads, continuing..."
        }
    fi
    
    # Copy to deployment location
    if [ -n "$SITE_BUILD_PATH" ] && [ "$SITE_BUILD_PATH" != "_site" ]; then
        log_info "Copying site to deployment location..."
        mkdir -p "$SITE_BUILD_PATH"
        cp -r _site/* "$SITE_BUILD_PATH/" || {
            log_error "Failed to copy to deployment location"
            return 1
        }
    fi
    
    log_success "Site rebuild completed"
    log_with_timestamp "Site rebuild completed successfully" >> "$PROJECT_ROOT/logs/webhook.log"
    
    cd "$PROJECT_ROOT"
}

# Handle webhook trigger
handle_webhook() {
    local payload="${1:-}"
    
    log_with_timestamp "Webhook triggered" >> "$PROJECT_ROOT/logs/webhook.log"
    
    # Check if Strapi is ready
    if ! wait_for_strapi; then
        log_error "Strapi is not ready, cannot rebuild site"
        return 1
    fi
    
    # Build the site
    if build_production_site "webhook"; then
        log_success "Webhook handled successfully"
        return 0
    else
        log_error "Webhook handling failed"
        return 1
    fi
}

# Manual rebuild
manual_rebuild() {
    log_info "Manual site rebuild triggered"
    
    # Check if Strapi is ready
    if ! wait_for_strapi; then
        log_error "Strapi is not ready, cannot rebuild site"
        return 1
    fi
    
    # Build the site
    if build_production_site "manual"; then
        log_success "Manual rebuild completed"
        return 0
    else
        log_error "Manual rebuild failed"
        return 1
    fi
}

# Test webhook functionality
test_webhook() {
    log_info "Testing webhook functionality..."
    
    # Check if webhook server is running
    if curl -s "$WEBHOOK_URL/health" >/dev/null 2>&1; then
        log_success "Webhook server is responding"
    else
        log_error "Webhook server is not responding"
        return 1
    fi
    
    # Test the webhook endpoint
    local test_payload='{"event":"entry.create","model":"test"}'
    local webhook_secret="${STRAPI_WEBHOOK_SECRET:-test-secret}"
    
    log_info "Sending test webhook..."
    local response
    response=$(curl -s -X POST "$WEBHOOK_URL/strapi" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $webhook_secret" \
        -d "$test_payload" \
        -w "%{http_code}")
    
    local http_code
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        log_success "Test webhook successful"
        return 0
    else
        log_error "Test webhook failed (HTTP $http_code)"
        return 1
    fi
}

# Show webhook status
show_webhook_status() {
    log_info "Webhook Status"
    echo
    
    # Check webhook server
    if curl -s "$WEBHOOK_URL/health" >/dev/null 2>&1; then
        echo "Webhook Server: ✓ Running ($WEBHOOK_URL)"
    else
        echo "Webhook Server: ✗ Not responding ($WEBHOOK_URL)"
    fi
    
    # Check Strapi connection
    if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
        echo "Strapi Connection: ✓ OK ($STRAPI_URL)"
    else
        echo "Strapi Connection: ✗ Failed ($STRAPI_URL)"
    fi
    
    # Check last build
    if [ -f "$PROJECT_ROOT/logs/webhook.log" ]; then
        local last_build
        last_build=$(grep "Site rebuild completed" "$PROJECT_ROOT/logs/webhook.log" | tail -1 | cut -d' ' -f1-2)
        if [ -n "$last_build" ]; then
            echo "Last Build: $last_build"
        else
            echo "Last Build: No successful builds found"
        fi
    else
        echo "Last Build: No webhook log found"
    fi
    
    # Check build directory
    if [ -d "$PROJECT_ROOT/portfolio-frontend/_site" ]; then
        local build_size
        build_size=$(du -sh "$PROJECT_ROOT/portfolio-frontend/_site" | cut -f1)
        echo "Build Directory: ✓ Exists ($build_size)"
    else
        echo "Build Directory: ✗ Not found"
    fi
}

# Show webhook logs
show_webhook_logs() {
    local lines="${1:-50}"
    
    local log_file="$PROJECT_ROOT/logs/webhook.log"
    
    if [ -f "$log_file" ]; then
        echo "=== Webhook Logs (last $lines lines) ==="
        tail -n "$lines" "$log_file"
    else
        log_warning "Webhook log file not found: $log_file"
    fi
}

# Setup webhook logging
setup_logging() {
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Create log file if it doesn't exist
    local log_file="$PROJECT_ROOT/logs/webhook.log"
    if [ ! -f "$log_file" ]; then
        touch "$log_file"
    fi
    
    # Log rotation (keep last 1000 lines)
    if [ -f "$log_file" ]; then
        local line_count
        line_count=$(wc -l < "$log_file")
        if [ "$line_count" -gt 1000 ]; then
            tail -n 500 "$log_file" > "$log_file.tmp"
            mv "$log_file.tmp" "$log_file"
        fi
    fi
}

# Show usage
show_usage() {
    echo "Portfolio Website Webhook Handler"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  webhook [payload]      - Handle webhook trigger"
    echo "  rebuild                - Manual site rebuild"
    echo "  test                   - Test webhook functionality"
    echo "  status                 - Show webhook status"
    echo "  logs [lines]           - Show webhook logs"
    echo
    echo "Examples:"
    echo "  $0 webhook             - Handle webhook (typically called by webhook server)"
    echo "  $0 rebuild             - Manually rebuild the site"
    echo "  $0 test                - Test that webhook is working"
    echo "  $0 status              - Show current webhook status"
    echo "  $0 logs 100            - Show last 100 log lines"
}

# Main function
main() {
    local command="${1:-webhook}"
    
    # Setup environment and logging
    setup_environment
    setup_logging
    
    case "$command" in
        "webhook")
            handle_webhook "$2"
            ;;
        "rebuild")
            manual_rebuild
            ;;
        "test")
            test_webhook
            ;;
        "status")
            show_webhook_status
            ;;
        "logs")
            show_webhook_logs "$2"
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
