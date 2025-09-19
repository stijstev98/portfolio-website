#!/bin/bash
set -e

# Portfolio Website Monitoring Script
# Monitors system health, service status, and performance

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

log_metric() {
    echo -e "${CYAN}[METRIC]${NC} $1"
}

# Load environment
load_environment() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

# Check system resources
check_system_resources() {
    log_info "=== System Resources ==="
    
    # CPU usage
    local cpu_usage
    if command -v top >/dev/null 2>&1; then
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        log_metric "CPU Usage: ${cpu_usage}%"
        
        if (( $(echo "$cpu_usage > 80" | bc -l) )); then
            log_warning "High CPU usage detected"
        fi
    fi
    
    # Memory usage
    local mem_total mem_used mem_free mem_usage_pct
    if [ -f /proc/meminfo ]; then
        mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        mem_free=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        mem_used=$((mem_total - mem_free))
        mem_usage_pct=$((mem_used * 100 / mem_total))
        
        log_metric "Memory Usage: $((mem_used / 1024))MB / $((mem_total / 1024))MB (${mem_usage_pct}%)"
        
        if [ "$mem_usage_pct" -gt 85 ]; then
            log_warning "High memory usage detected"
        fi
    elif command -v vm_stat >/dev/null 2>&1; then
        # macOS
        local vm_stat_output
        vm_stat_output=$(vm_stat)
        local pages_free pages_inactive pages_speculative
        pages_free=$(echo "$vm_stat_output" | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        pages_inactive=$(echo "$vm_stat_output" | grep "Pages inactive" | awk '{print $3}' | sed 's/\.//')
        pages_speculative=$(echo "$vm_stat_output" | grep "Pages speculative" | awk '{print $3}' | sed 's/\.//')
        
        local available_mb
        available_mb=$(( (pages_free + pages_inactive + pages_speculative) * 4096 / 1024 / 1024 ))
        log_metric "Available Memory: ${available_mb}MB"
    fi
    
    # Disk usage
    local disk_usage
    disk_usage=$(df -h "$PROJECT_ROOT" | tail -1 | awk '{print $5}' | sed 's/%//')
    local disk_available
    disk_available=$(df -h "$PROJECT_ROOT" | tail -1 | awk '{print $4}')
    
    log_metric "Disk Usage: ${disk_usage}% (${disk_available} free)"
    
    if [ "$disk_usage" -gt 85 ]; then
        log_warning "High disk usage detected"
    fi
    
    # Load average
    if [ -f /proc/loadavg ]; then
        local load_avg
        load_avg=$(cat /proc/loadavg | cut -d' ' -f1-3)
        log_metric "Load Average: $load_avg"
    elif command -v uptime >/dev/null 2>&1; then
        local load_avg
        load_avg=$(uptime | grep -oE 'load average[s:] [0-9.,]+ [0-9.,]+ [0-9.,]+' | cut -d' ' -f3- | tr -d ',')
        log_metric "Load Average: $load_avg"
    fi
}

# Check service health
check_service_health() {
    log_info "=== Service Health ==="
    
    local failed_services=0
    
    # Check Strapi
    if curl -s -o /dev/null -w "%{http_code}" "$STRAPI_URL/api" | grep -q "200"; then
        local response_time
        response_time=$(curl -s -o /dev/null -w "%{time_total}" "$STRAPI_URL/api")
        log_success "Strapi API: ✓ Running (${response_time}s)"
    else
        log_error "Strapi API: ✗ Not responding"
        ((failed_services++))
    fi
    
    # Check webhook
    if curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL/health" | grep -q "200"; then
        local response_time
        response_time=$(curl -s -o /dev/null -w "%{time_total}" "$WEBHOOK_URL/health")
        log_success "Webhook: ✓ Running (${response_time}s)"
    else
        log_error "Webhook: ✗ Not responding"
        ((failed_services++))
    fi
    
    # Check nginx (if running)
    if command -v nginx >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
        log_success "Nginx: ✓ Running"
    elif command -v nginx >/dev/null 2>&1; then
        log_warning "Nginx: Installed but not running"
    else
        log_warning "Nginx: Not installed"
    fi
    
    return $failed_services
}

# Check database health
check_database_health() {
    log_info "=== Database Health ==="
    
    local db_file="${DATABASE_FILENAME:-$PROJECT_ROOT/strapi-data/strapi.db}"
    
    if [ -f "$db_file" ]; then
        # Check file permissions
        if [ -r "$db_file" ] && [ -w "$db_file" ]; then
            log_success "Database file: ✓ Accessible"
        else
            log_error "Database file: ✗ Permission issues"
            return 1
        fi
        
        # Check file size and modification time
        local db_size db_modified
        db_size=$(du -sh "$db_file" | cut -f1)
        db_modified=$(stat -c %y "$db_file" 2>/dev/null || stat -f "%Sm" "$db_file" 2>/dev/null)
        
        log_metric "Database size: $db_size"
        log_metric "Last modified: $db_modified"
        
        # Check database integrity (if sqlite3 is available)
        if command -v sqlite3 >/dev/null 2>&1; then
            if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
                log_success "Database integrity: ✓ OK"
            else
                log_error "Database integrity: ✗ Issues detected"
                return 1
            fi
            
            # Get table count
            local table_count
            table_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "unknown")
            log_metric "Database tables: $table_count"
        fi
        
    else
        log_error "Database file not found: $db_file"
        return 1
    fi
    
    return 0
}

# Check SSL certificates
check_ssl_certificates() {
    log_info "=== SSL Certificates ==="
    
    local cert_dir="/etc/letsencrypt/live"
    local domains=("${PRIMARY_DOMAIN}" "${ADMIN_DOMAIN}")
    local issues=0
    
    for domain in "${domains[@]}"; do
        if [ -n "$domain" ]; then
            local cert_path="$cert_dir/$domain/fullchain.pem"
            
            if [ -f "$cert_path" ]; then
                local expiry_date expiry_timestamp current_timestamp days_until_expiry
                expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
                expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
                current_timestamp=$(date +%s)
                days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                
                if [ "$days_until_expiry" -gt 30 ]; then
                    log_success "SSL ($domain): ✓ Valid (expires in $days_until_expiry days)"
                elif [ "$days_until_expiry" -gt 7 ]; then
                    log_warning "SSL ($domain): ⚠ Expires soon ($days_until_expiry days)"
                    ((issues++))
                elif [ "$days_until_expiry" -gt 0 ]; then
                    log_error "SSL ($domain): ✗ Expires very soon ($days_until_expiry days)"
                    ((issues++))
                else
                    log_error "SSL ($domain): ✗ Expired"
                    ((issues++))
                fi
            else
                log_error "SSL ($domain): ✗ Certificate not found"
                ((issues++))
            fi
        fi
    done
    
    return $issues
}

# Check website accessibility
check_website_accessibility() {
    log_info "=== Website Accessibility ==="
    
    local issues=0
    
    # Check main site
    if [ -n "$PRIMARY_DOMAIN" ]; then
        local main_url="https://$PRIMARY_DOMAIN"
        local http_code response_time
        
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$main_url" || echo "000")
        response_time=$(curl -s -o /dev/null -w "%{time_total}" "$main_url" 2>/dev/null || echo "timeout")
        
        if [ "$http_code" = "200" ]; then
            log_success "Main site: ✓ Accessible (${response_time}s)"
        else
            log_error "Main site: ✗ HTTP $http_code"
            ((issues++))
        fi
    fi
    
    # Check admin site
    if [ -n "$ADMIN_DOMAIN" ]; then
        local admin_url="https://$ADMIN_DOMAIN"
        local http_code response_time
        
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$admin_url" || echo "000")
        response_time=$(curl -s -o /dev/null -w "%{time_total}" "$admin_url" 2>/dev/null || echo "timeout")
        
        if [ "$http_code" = "200" ]; then
            log_success "Admin site: ✓ Accessible (${response_time}s)"
        else
            log_error "Admin site: ✗ HTTP $http_code"
            ((issues++))
        fi
    fi
    
    return $issues
}

# Check log files for errors
check_log_files() {
    log_info "=== Log Analysis ==="
    
    local log_dir="${LOG_PATH:-$PROJECT_ROOT/logs}"
    local error_count=0
    
    # Check recent errors in application logs
    if [ -d "$log_dir" ]; then
        local recent_minutes=60
        
        # Strapi logs
        local strapi_log="$log_dir/strapi-prod.log"
        if [ -f "$strapi_log" ]; then
            local strapi_errors
            strapi_errors=$(find "$strapi_log" -mmin -$recent_minutes -exec grep -i "error\|exception\|fail" {} \; 2>/dev/null | wc -l)
            
            if [ "$strapi_errors" -eq 0 ]; then
                log_success "Strapi logs: ✓ No recent errors"
            else
                log_warning "Strapi logs: $strapi_errors error(s) in last ${recent_minutes}m"
                ((error_count += strapi_errors))
            fi
        fi
        
        # Webhook logs
        local webhook_log="$log_dir/webhook.log"
        if [ -f "$webhook_log" ]; then
            local webhook_errors
            webhook_errors=$(find "$webhook_log" -mmin -$recent_minutes -exec grep -i "error\|fail" {} \; 2>/dev/null | wc -l)
            
            if [ "$webhook_errors" -eq 0 ]; then
                log_success "Webhook logs: ✓ No recent errors"
            else
                log_warning "Webhook logs: $webhook_errors error(s) in last ${recent_minutes}m"
                ((error_count += webhook_errors))
            fi
        fi
    fi
    
    # Check nginx error logs
    local nginx_error_log="/var/log/nginx/error.log"
    if [ -f "$nginx_error_log" ]; then
        local nginx_errors
        nginx_errors=$(find "$nginx_error_log" -mmin -60 -exec grep -v "info" {} \; 2>/dev/null | wc -l)
        
        if [ "$nginx_errors" -eq 0 ]; then
            log_success "Nginx logs: ✓ No recent errors"
        else
            log_warning "Nginx logs: $nginx_errors error(s) in last hour"
            ((error_count += nginx_errors))
        fi
    fi
    
    return $error_count
}

# Performance monitoring
check_performance() {
    log_info "=== Performance Metrics ==="
    
    # Check response times
    if [ -n "$STRAPI_URL" ]; then
        local api_time
        api_time=$(curl -s -o /dev/null -w "%{time_total}" "$STRAPI_URL/api" 2>/dev/null || echo "timeout")
        log_metric "Strapi API response time: ${api_time}s"
        
        if (( $(echo "$api_time > 2" | bc -l 2>/dev/null || echo 0) )); then
            log_warning "Slow API response time"
        fi
    fi
    
    # Check build directory size
    local site_dir="${SITE_BUILD_PATH:-$PROJECT_ROOT/portfolio-frontend/_site}"
    if [ -d "$site_dir" ]; then
        local site_size file_count
        site_size=$(du -sh "$site_dir" | cut -f1)
        file_count=$(find "$site_dir" -type f | wc -l)
        
        log_metric "Site build: $file_count files, $site_size"
    fi
    
    # Check uploads directory size
    local uploads_dir="${UPLOADS_PATH:-$PROJECT_ROOT/portfolio-cms/public/uploads}"
    if [ -d "$uploads_dir" ]; then
        local uploads_size upload_count
        uploads_size=$(du -sh "$uploads_dir" | cut -f1)
        upload_count=$(find "$uploads_dir" -type f | wc -l)
        
        log_metric "Uploads: $upload_count files, $uploads_size"
    fi
}

# Generate monitoring report
generate_report() {
    local report_file="${LOG_PATH:-$PROJECT_ROOT/logs}/monitoring_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "=== Portfolio Website Monitoring Report ==="
        echo "Generated: $(date)"
        echo "Hostname: $(hostname)"
        echo "Environment: ${NODE_ENV:-unknown}"
        echo
        
        # Redirect all monitoring output to report
        check_system_resources
        echo
        check_service_health
        echo
        check_database_health
        echo
        check_ssl_certificates
        echo
        check_website_accessibility
        echo
        check_log_files
        echo
        check_performance
        
    } > "$report_file" 2>&1
    
    log_success "Monitoring report generated: $report_file"
}

# Run continuous monitoring
run_continuous() {
    local interval="${1:-300}" # 5 minutes default
    
    log_info "Starting continuous monitoring (interval: ${interval}s)"
    log_info "Press Ctrl+C to stop"
    
    while true; do
        echo
        echo "=== Monitoring Check - $(date) ==="
        
        local total_issues=0
        
        check_service_health || ((total_issues += $?))
        check_database_health || ((total_issues += $?))
        check_ssl_certificates || ((total_issues += $?))
        check_website_accessibility || ((total_issues += $?))
        check_log_files || ((total_issues += $?))
        
        if [ "$total_issues" -eq 0 ]; then
            log_success "All checks passed"
        else
            log_warning "$total_issues issue(s) detected"
        fi
        
        sleep "$interval"
    done
}

# Show usage
show_usage() {
    echo "Portfolio Website Monitoring"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  check                  - Run all health checks once"
    echo "  system                 - Check system resources"
    echo "  services               - Check service health"
    echo "  database               - Check database health"
    echo "  ssl                    - Check SSL certificates"
    echo "  website                - Check website accessibility"
    echo "  logs                   - Analyze log files"
    echo "  performance            - Check performance metrics"
    echo "  report                 - Generate full monitoring report"
    echo "  continuous [interval]  - Run continuous monitoring"
    echo
    echo "Examples:"
    echo "  $0 check               - Run all checks once"
    echo "  $0 services            - Check only services"
    echo "  $0 continuous 60       - Monitor every 60 seconds"
    echo "  $0 report              - Generate detailed report"
}

# Main function
main() {
    local command="${1:-check}"
    
    load_environment
    
    case "$command" in
        "check")
            check_system_resources
            echo
            check_service_health
            echo
            check_database_health
            echo
            check_ssl_certificates
            echo
            check_website_accessibility
            echo
            check_log_files
            echo
            check_performance
            ;;
        "system")
            check_system_resources
            ;;
        "services")
            check_service_health
            ;;
        "database")
            check_database_health
            ;;
        "ssl")
            check_ssl_certificates
            ;;
        "website")
            check_website_accessibility
            ;;
        "logs")
            check_log_files
            ;;
        "performance")
            check_performance
            ;;
        "report")
            generate_report
            ;;
        "continuous")
            run_continuous "$2"
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
