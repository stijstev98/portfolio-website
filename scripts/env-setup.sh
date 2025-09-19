#!/bin/bash
set -e

# Portfolio Website Environment Setup Script
# Detects environment and sets up appropriate configuration

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

# Detect environment
detect_environment() {
    local env_mode="${1:-auto}"
    
    if [ "$env_mode" = "dev" ] || [ "$env_mode" = "development" ]; then
        echo "dev"
        return 0
    elif [ "$env_mode" = "prod" ] || [ "$env_mode" = "production" ]; then
        echo "prod"
        return 0
    fi
    
    # Auto-detection logic
    if [ -n "${CI}" ] || [ -n "${DEPLOYMENT}" ]; then
        echo "prod"
    elif [ -f "/etc/nginx/nginx.conf" ] && systemctl is-active --quiet nginx 2>/dev/null; then
        echo "prod"
    elif [ "$(whoami)" = "root" ]; then
        echo "prod"
    else
        echo "dev"
    fi
}

# Load environment configuration
load_env_config() {
    local env_type="$1"
    local config_file="$PROJECT_ROOT/config.$env_type.env"
    
    if [ ! -f "$config_file" ]; then
        log_error "Configuration file not found: $config_file"
        return 1
    fi
    
    log_info "Loading $env_type environment configuration"
    
    # Export variables from config file
    set -a
    source "$config_file"
    set +a
    
    # Create .env symlink for compatibility
    ln -sf "config.$env_type.env" "$PROJECT_ROOT/.env"
    
    log_success "Environment configured for $env_type mode"
}

# Create necessary directories
create_directories() {
    local directories=(
        "$SITE_BUILD_PATH"
        "$UPLOADS_PATH"
        "$(dirname "$DATABASE_FILENAME")"
    )
    
    if [ "$NODE_ENV" = "production" ]; then
        directories+=(
            "$LOG_PATH"
            "$BACKUP_PATH"
            "$NGINX_CONFIG_PATH"
        )
    fi
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            log_info "Creating directory: $dir"
            mkdir -p "$dir"
        fi
    done
}

# Validate required environment variables
validate_environment() {
    local required_vars=(
        "NODE_ENV"
        "STRAPI_HOST"
        "STRAPI_PORT"
        "DATABASE_FILENAME"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        return 1
    fi
    
    log_success "Environment validation passed"
}

# Setup SSL certificates for development
setup_dev_ssl() {
    if [ "$NODE_ENV" = "development" ] && [ "$SSL_ENABLED" = "true" ]; then
        local ssl_dir="$(dirname "$SSL_CERT_PATH")"
        
        if [ ! -d "$ssl_dir" ]; then
            log_info "Creating SSL directory for development: $ssl_dir"
            mkdir -p "$ssl_dir"
        fi
        
        if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
            log_info "Generating self-signed SSL certificates for development"
            
            openssl req -x509 -newkey rsa:4096 -keyout "$SSL_KEY_PATH" -out "$SSL_CERT_PATH" \
                -days 365 -nodes -subj "/CN=localhost" 2>/dev/null || {
                log_warning "Failed to generate SSL certificates. Disabling SSL for development."
                export SSL_ENABLED=false
            }
        fi
    fi
}

# Main function
main() {
    local env_mode="${1:-auto}"
    
    log_info "=== Portfolio Website Environment Setup ==="
    log_info "Project root: $PROJECT_ROOT"
    
    # Detect and set environment
    local detected_env
    detected_env=$(detect_environment "$env_mode")
    log_info "Environment detected: $detected_env"
    
    # Load configuration
    load_env_config "$detected_env"
    
    # Validate environment
    validate_environment
    
    # Create necessary directories
    create_directories
    
    # Setup development SSL if needed
    setup_dev_ssl
    
    # Output environment summary
    log_success "=== Environment Setup Complete ==="
    echo "Environment: $NODE_ENV"
    echo "Strapi URL: $STRAPI_URL"
    
    if [ "$NODE_ENV" = "development" ]; then
        echo "Eleventy URL: $ELEVENTY_URL"
        echo "SSL Enabled: $SSL_ENABLED"
    else
        echo "Primary Domain: $PRIMARY_DOMAIN"
        echo "Admin Domain: $ADMIN_DOMAIN"
        echo "SSL Enabled: $SSL_ENABLED"
    fi
    
    return 0
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
