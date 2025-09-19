#!/bin/bash
set -e

# Portfolio Website Nginx Configuration Management Script
# Manages nginx configuration for development and production

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

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo) for production setup"
        echo "Usage: sudo $0 <command>"
        exit 1
    fi
}

# Load environment
load_environment() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

# Setup development nginx configuration
setup_dev_config() {
    log_info "Setting up nginx configuration for development..."
    
    local nginx_config_dir="/etc/nginx"
    local project_config_dir="$PROJECT_ROOT/nginx-prod"
    
    # Check if nginx is installed
    if ! command -v nginx >/dev/null 2>&1; then
        log_error "Nginx is not installed. Please install nginx first."
        exit 1
    fi
    
    # Create SSL directory for development
    local ssl_dir="/var/www/portfolio/ssl-dev"
    mkdir -p "$ssl_dir"
    
    # Generate self-signed certificate if not exists
    if [ ! -f "$ssl_dir/cert.pem" ]; then
        log_info "Generating self-signed SSL certificate for development..."
        openssl req -x509 -newkey rsa:2048 -keyout "$ssl_dir/key.pem" -out "$ssl_dir/cert.pem" \
            -days 365 -nodes -subj "/CN=localhost" 2>/dev/null || {
            log_error "Failed to generate SSL certificate"
            exit 1
        }
    fi
    
    # Copy development site configuration
    cp "$project_config_dir/sites-available/portfolio-dev" "$nginx_config_dir/sites-available/"
    
    # Enable the site
    ln -sf "$nginx_config_dir/sites-available/portfolio-dev" "$nginx_config_dir/sites-enabled/"
    
    # Disable default site
    rm -f "$nginx_config_dir/sites-enabled/default"
    
    log_success "Development nginx configuration setup complete"
}

# Setup production nginx configuration
setup_prod_config() {
    log_info "Setting up nginx configuration for production..."
    
    local nginx_config_dir="/etc/nginx"
    local project_config_dir="$PROJECT_ROOT/nginx-prod"
    
    # Backup existing nginx configuration
    if [ -f "$nginx_config_dir/nginx.conf" ]; then
        cp "$nginx_config_dir/nginx.conf" "$nginx_config_dir/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "Backed up existing nginx.conf"
    fi
    
    # Copy main nginx configuration
    cp "$project_config_dir/nginx.conf" "$nginx_config_dir/"
    
    # Copy site configuration
    cp "$project_config_dir/conf.d/default.conf" "$nginx_config_dir/sites-available/portfolio"
    
    # Enable the site
    ln -sf "$nginx_config_dir/sites-available/portfolio" "$nginx_config_dir/sites-enabled/"
    
    # Disable default site
    rm -f "$nginx_config_dir/sites-enabled/default"
    
    # Create necessary directories
    mkdir -p /var/www/portfolio/site-build
    mkdir -p /var/www/certbot
    mkdir -p /etc/nginx/ssl
    
    # Create dummy SSL certificates for default server
    if [ ! -f "/etc/nginx/ssl/dummy.crt" ]; then
        log_info "Creating dummy SSL certificate..."
        openssl req -x509 -newkey rsa:2048 -keyout "/etc/nginx/ssl/dummy.key" -out "/etc/nginx/ssl/dummy.crt" \
            -days 365 -nodes -subj "/CN=dummy" 2>/dev/null
    fi
    
    log_success "Production nginx configuration setup complete"
}

# Test nginx configuration
test_config() {
    log_info "Testing nginx configuration..."
    
    if nginx -t; then
        log_success "Nginx configuration test passed"
        return 0
    else
        log_error "Nginx configuration test failed"
        return 1
    fi
}

# Reload nginx
reload_nginx() {
    log_info "Reloading nginx..."
    
    if test_config; then
        if systemctl is-active --quiet nginx; then
            systemctl reload nginx
            log_success "Nginx reloaded successfully"
        else
            systemctl start nginx
            log_success "Nginx started successfully"
        fi
    else
        log_error "Cannot reload nginx due to configuration errors"
        return 1
    fi
}

# Show nginx status
show_status() {
    log_info "Nginx Status"
    echo
    
    # Check if nginx is installed
    if command -v nginx >/dev/null 2>&1; then
        local nginx_version
        nginx_version=$(nginx -v 2>&1 | grep -o 'nginx/[0-9.]*')
        echo "Nginx Version: $nginx_version"
    else
        echo "Nginx: Not installed"
        return 1
    fi
    
    # Check if nginx is running
    if systemctl is-active --quiet nginx; then
        echo "Nginx Service: ✓ Running"
    else
        echo "Nginx Service: ✗ Not running"
    fi
    
    # Check configuration
    if nginx -t >/dev/null 2>&1; then
        echo "Configuration: ✓ Valid"
    else
        echo "Configuration: ✗ Invalid"
    fi
    
    # Show enabled sites
    echo
    echo "Enabled Sites:"
    if [ -d "/etc/nginx/sites-enabled" ]; then
        ls -la /etc/nginx/sites-enabled/ | grep -v '^total' | grep -v '^d' | awk '{print "  " $NF " -> " $(NF-2)}'
    else
        echo "  No sites-enabled directory found"
    fi
    
    # Show listening ports
    echo
    echo "Listening Ports:"
    ss -tlnp | grep nginx | awk '{print "  " $4}' | sort -u || netstat -tlnp 2>/dev/null | grep nginx | awk '{print "  " $4}' | sort -u
}

# Show SSL certificate status
show_ssl_status() {
    log_info "SSL Certificate Status"
    echo
    
    local cert_dir="/etc/letsencrypt/live"
    local domains=("stijnstevens.be" "admin.stijnstevens.be")
    
    for domain in "${domains[@]}"; do
        local cert_path="$cert_dir/$domain/fullchain.pem"
        
        if [ -f "$cert_path" ]; then
            local expiry_date
            expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
            local expiry_timestamp
            expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
            local current_timestamp
            current_timestamp=$(date +%s)
            local days_until_expiry
            days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
            
            if [ "$days_until_expiry" -gt 30 ]; then
                echo "$domain: ✓ Valid (expires in $days_until_expiry days)"
            elif [ "$days_until_expiry" -gt 0 ]; then
                echo "$domain: ⚠ Expires soon ($days_until_expiry days)"
            else
                echo "$domain: ✗ Expired"
            fi
        else
            echo "$domain: ✗ Certificate not found"
        fi
    done
}

# Show logs
show_logs() {
    local log_type="${1:-access}"
    local lines="${2:-50}"
    
    case "$log_type" in
        "access")
            echo "=== Nginx Access Logs (last $lines lines) ==="
            tail -n "$lines" /var/log/nginx/access.log 2>/dev/null || echo "Access log not found"
            ;;
        "error")
            echo "=== Nginx Error Logs (last $lines lines) ==="
            tail -n "$lines" /var/log/nginx/error.log 2>/dev/null || echo "Error log not found"
            ;;
        "all")
            echo "=== Nginx Error Logs (last $((lines/2)) lines) ==="
            tail -n $((lines/2)) /var/log/nginx/error.log 2>/dev/null || echo "Error log not found"
            echo
            echo "=== Nginx Access Logs (last $((lines/2)) lines) ==="
            tail -n $((lines/2)) /var/log/nginx/access.log 2>/dev/null || echo "Access log not found"
            ;;
        *)
            log_error "Unknown log type: $log_type"
            echo "Available log types: access, error, all"
            return 1
            ;;
    esac
}

# Show usage
show_usage() {
    echo "Portfolio Website Nginx Configuration Management"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  setup-dev              - Setup nginx for development"
    echo "  setup-prod             - Setup nginx for production (requires root)"
    echo "  test                   - Test nginx configuration"
    echo "  reload                 - Reload nginx configuration"
    echo "  status                 - Show nginx status"
    echo "  ssl-status             - Show SSL certificate status"
    echo "  logs [type] [lines]    - Show nginx logs (access|error|all)"
    echo
    echo "Examples:"
    echo "  sudo $0 setup-prod     - Setup production configuration"
    echo "  $0 test                - Test current configuration"
    echo "  $0 status              - Show nginx status"
    echo "  $0 logs error 100      - Show last 100 error log lines"
}

# Main function
main() {
    local command="${1:-status}"
    
    case "$command" in
        "setup-dev")
            check_root
            load_environment
            setup_dev_config
            test_config && reload_nginx
            ;;
        "setup-prod")
            check_root
            load_environment
            setup_prod_config
            test_config && reload_nginx
            ;;
        "test")
            test_config
            ;;
        "reload")
            check_root
            reload_nginx
            ;;
        "status")
            show_status
            ;;
        "ssl-status")
            show_ssl_status
            ;;
        "logs")
            show_logs "$2" "$3"
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
