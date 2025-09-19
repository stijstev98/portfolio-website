#!/bin/bash
set -e

# Portfolio Website Production Management Script
# Manages production services (start, stop, restart, status, logs, etc.)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

# Load environment
load_environment() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

# Check if systemd is available
has_systemd() {
    command -v systemctl >/dev/null 2>&1
}

# Check service status with systemd
check_systemd_status() {
    local service="$1"
    
    if systemctl is-active --quiet "$service"; then
        echo "running"
    elif systemctl is-enabled --quiet "$service"; then
        echo "stopped"
    else
        echo "disabled"
    fi
}

# Check manual service status (PID files)
check_manual_status() {
    local service="$1"
    local pid_file="$PROJECT_ROOT/.pids/$service.pid"
    
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "running"
        else
            echo "stopped"
        fi
    else
        echo "stopped"
    fi
}

# Show service status
show_status() {
    log_info "Portfolio Website Production Status"
    echo
    
    if has_systemd; then
        echo -e "${CYAN}=== Systemd Services ===${NC}"
        
        # Strapi status
        local strapi_status
        strapi_status=$(check_systemd_status "portfolio-strapi")
        printf "%-20s %s\n" "Strapi CMS:" "$(format_status "$strapi_status")"
        
        # Webhook status  
        local webhook_status
        webhook_status=$(check_systemd_status "portfolio-webhook")
        printf "%-20s %s\n" "Webhook:" "$(format_status "$webhook_status")"
        
        # Nginx status
        local nginx_status
        nginx_status=$(check_systemd_status "nginx")
        printf "%-20s %s\n" "Nginx:" "$(format_status "$nginx_status")"
        
    else
        echo -e "${CYAN}=== Manual Services ===${NC}"
        
        # Strapi status
        local strapi_status
        strapi_status=$(check_manual_status "strapi")
        printf "%-20s %s\n" "Strapi CMS:" "$(format_status "$strapi_status")"
        
        # Webhook status
        local webhook_status
        webhook_status=$(check_manual_status "webhook")
        printf "%-20s %s\n" "Webhook:" "$(format_status "$webhook_status")"
    fi
    
    echo
    echo -e "${CYAN}=== Health Checks ===${NC}"
    
    # Check if services are responding
    if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
        printf "%-20s %s\n" "Strapi API:" "$(format_status "healthy")"
    else
        printf "%-20s %s\n" "Strapi API:" "$(format_status "unhealthy")"
    fi
    
    if curl -s "$WEBHOOK_URL/health" >/dev/null 2>&1; then
        printf "%-20s %s\n" "Webhook API:" "$(format_status "healthy")"
    else
        printf "%-20s %s\n" "Webhook API:" "$(format_status "unhealthy")"
    fi
    
    # Check SSL certificates
    check_ssl_status
    
    echo
}

# Format status with colors
format_status() {
    local status="$1"
    
    case "$status" in
        "running"|"healthy")
            echo -e "${GREEN}✓ $status${NC}"
            ;;
        "stopped")
            echo -e "${YELLOW}● $status${NC}"
            ;;
        "disabled"|"unhealthy")
            echo -e "${RED}✗ $status${NC}"
            ;;
        *)
            echo -e "${BLUE}? $status${NC}"
            ;;
    esac
}

# Check SSL certificate status
check_ssl_status() {
    local domains=("$PRIMARY_DOMAIN" "$ADMIN_DOMAIN")
    
    for domain in "${domains[@]}"; do
        if [ -n "$domain" ]; then
            local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
            
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
                    printf "%-20s %s\n" "SSL ($domain):" "$(format_status "healthy") (${days_until_expiry}d)"
                elif [ "$days_until_expiry" -gt 0 ]; then
                    printf "%-20s %s\n" "SSL ($domain):" "$(format_status "unhealthy") (${days_until_expiry}d)"
                else
                    printf "%-20s %s\n" "SSL ($domain):" "$(format_status "unhealthy") (expired)"
                fi
            else
                printf "%-20s %s\n" "SSL ($domain):" "$(format_status "unhealthy") (missing)"
            fi
        fi
    done
}

# Start services
start_services() {
    log_info "Starting production services..."
    
    if has_systemd; then
        systemctl start portfolio-strapi portfolio-webhook nginx
        log_success "Services started with systemd"
    else
        # Start manually
        "$SCRIPT_DIR/start-prod.sh"
    fi
}

# Stop services
stop_services() {
    log_info "Stopping production services..."
    
    if has_systemd; then
        systemctl stop portfolio-strapi portfolio-webhook
        log_success "Services stopped"
    else
        # Stop manual processes
        local services=("strapi" "webhook")
        
        for service in "${services[@]}"; do
            local pid_file="$PROJECT_ROOT/.pids/$service.pid"
            
            if [ -f "$pid_file" ]; then
                local pid
                pid=$(cat "$pid_file")
                if kill -0 "$pid" 2>/dev/null; then
                    log_info "Stopping $service (PID: $pid)"
                    kill "$pid"
                fi
                rm -f "$pid_file"
            fi
        done
        
        log_success "Manual services stopped"
    fi
}

# Restart services
restart_services() {
    log_info "Restarting production services..."
    
    if has_systemd; then
        systemctl restart portfolio-strapi portfolio-webhook nginx
        log_success "Services restarted"
    else
        stop_services
        sleep 3
        start_services
    fi
}

# Show logs
show_logs() {
    local service="${1:-all}"
    local follow="${2:-false}"
    
    if has_systemd; then
        case "$service" in
            "strapi")
                if [ "$follow" = "follow" ]; then
                    journalctl -u portfolio-strapi -f
                else
                    journalctl -u portfolio-strapi -n 50
                fi
                ;;
            "webhook")
                if [ "$follow" = "follow" ]; then
                    journalctl -u portfolio-webhook -f
                else
                    journalctl -u portfolio-webhook -n 50
                fi
                ;;
            "nginx")
                if [ "$follow" = "follow" ]; then
                    tail -f /var/log/nginx/access.log /var/log/nginx/error.log
                else
                    tail -n 25 /var/log/nginx/access.log /var/log/nginx/error.log
                fi
                ;;
            "all"|*)
                if [ "$follow" = "follow" ]; then
                    journalctl -u portfolio-strapi -u portfolio-webhook -f
                else
                    echo -e "${CYAN}=== Strapi Logs ===${NC}"
                    journalctl -u portfolio-strapi -n 20
                    echo
                    echo -e "${CYAN}=== Webhook Logs ===${NC}"
                    journalctl -u portfolio-webhook -n 20
                fi
                ;;
        esac
    else
        # Manual logs
        local log_dir="$PROJECT_ROOT/logs"
        
        case "$service" in
            "strapi")
                local log_file="$log_dir/strapi-prod.log"
                if [ -f "$log_file" ]; then
                    if [ "$follow" = "follow" ]; then
                        tail -f "$log_file"
                    else
                        tail -n 50 "$log_file"
                    fi
                else
                    log_error "Strapi log file not found: $log_file"
                fi
                ;;
            "webhook")
                local log_file="$log_dir/webhook-prod.log"
                if [ -f "$log_file" ]; then
                    if [ "$follow" = "follow" ]; then
                        tail -f "$log_file"
                    else
                        tail -n 50 "$log_file"
                    fi
                else
                    log_error "Webhook log file not found: $log_file"
                fi
                ;;
            "all"|*)
                echo -e "${CYAN}=== Strapi Logs ===${NC}"
                local strapi_log="$log_dir/strapi-prod.log"
                if [ -f "$strapi_log" ]; then
                    tail -n 25 "$strapi_log"
                else
                    echo "No Strapi logs found"
                fi
                echo
                echo -e "${CYAN}=== Webhook Logs ===${NC}"
                local webhook_log="$log_dir/webhook-prod.log"
                if [ -f "$webhook_log" ]; then
                    tail -n 25 "$webhook_log"
                else
                    echo "No webhook logs found"
                fi
                ;;
        esac
    fi
}

# Backup database and configuration
backup_data() {
    log_info "Creating backup..."
    
    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="portfolio_backup_$timestamp"
    local backup_path="$backup_dir/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup database
    if [ -f "$DATABASE_FILENAME" ]; then
        log_info "Backing up database..."
        cp "$DATABASE_FILENAME" "$backup_path/strapi.db"
    fi
    
    # Backup uploads
    if [ -d "$PROJECT_ROOT/portfolio-cms/public/uploads" ]; then
        log_info "Backing up uploads..."
        cp -r "$PROJECT_ROOT/portfolio-cms/public/uploads" "$backup_path/"
    fi
    
    # Backup configuration
    log_info "Backing up configuration..."
    cp "$PROJECT_ROOT/config.prod.env" "$backup_path/"
    
    # Create archive
    cd "$backup_dir"
    tar -czf "$backup_name.tar.gz" "$backup_name"
    rm -rf "$backup_name"
    
    log_success "Backup created: $backup_dir/$backup_name.tar.gz"
}

# Update SSL certificates
update_ssl() {
    log_info "Updating SSL certificates..."
    
    if command -v certbot >/dev/null 2>&1; then
        certbot renew --quiet
        
        if has_systemd && systemctl is-active --quiet nginx; then
            systemctl reload nginx
        fi
        
        log_success "SSL certificates updated"
    else
        log_error "Certbot not found. Please install certbot first."
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Portfolio Website Production Management"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  status                 - Show service status and health"
    echo "  start                  - Start all services"
    echo "  stop                   - Stop all services"
    echo "  restart                - Restart all services"
    echo "  logs [service] [follow] - Show logs (strapi|webhook|nginx|all)"
    echo "  backup                 - Create backup of data and config"
    echo "  ssl-update             - Update SSL certificates"
    echo "  health                 - Perform health check"
    echo
    echo "Examples:"
    echo "  $0 status              - Show current status"
    echo "  $0 logs strapi follow  - Follow Strapi logs"
    echo "  $0 backup              - Create backup"
    echo "  $0 ssl-update          - Renew SSL certificates"
}

# Perform health check
health_check() {
    log_info "Performing health check..."
    
    local failed_checks=0
    
    # Check Strapi
    if curl -s -o /dev/null -w "%{http_code}" "$STRAPI_URL/api" | grep -q "200"; then
        log_success "Strapi API health check passed"
    else
        log_error "Strapi API health check failed"
        ((failed_checks++))
    fi
    
    # Check webhook
    if curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL/health" | grep -q "200"; then
        log_success "Webhook health check passed"
    else
        log_error "Webhook health check failed"
        ((failed_checks++))
    fi
    
    # Check database
    if [ -f "$DATABASE_FILENAME" ] && [ -r "$DATABASE_FILENAME" ]; then
        log_success "Database file accessible"
    else
        log_error "Database file not accessible"
        ((failed_checks++))
    fi
    
    # Check disk space
    local available_space
    available_space=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    
    if [ "$available_space" -lt 1 ]; then
        log_warning "Low disk space: ${available_space}GB available"
        ((failed_checks++))
    else
        log_success "Disk space check passed: ${available_space}GB available"
    fi
    
    if [ $failed_checks -eq 0 ]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "$failed_checks health check(s) failed"
        return 1
    fi
}

# Main function
main() {
    local command="${1:-status}"
    
    # Load environment
    load_environment
    
    case "$command" in
        "status")
            show_status
            ;;
        "start")
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            show_logs "$2" "$3"
            ;;
        "backup")
            backup_data
            ;;
        "ssl-update")
            update_ssl
            ;;
        "health")
            health_check
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
