#!/bin/bash
set -e

# Portfolio Website Backup Script
# Creates comprehensive backups of database, uploads, and configuration

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

# Load environment
load_environment() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

# Create backup directory structure
setup_backup_structure() {
    local backup_base="${BACKUP_PATH:-$PROJECT_ROOT/backups}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="portfolio_backup_$timestamp"
    
    export BACKUP_DIR="$backup_base/$backup_name"
    export BACKUP_ARCHIVE="$backup_base/$backup_name.tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$backup_base"
    
    log_info "Created backup directory: $BACKUP_DIR"
}

# Backup database
backup_database() {
    log_info "Backing up database..."
    
    local db_file="${DATABASE_FILENAME:-$PROJECT_ROOT/strapi-data/strapi.db}"
    local backup_db_dir="$BACKUP_DIR/database"
    
    mkdir -p "$backup_db_dir"
    
    if [ -f "$db_file" ]; then
        # Copy SQLite database
        cp "$db_file" "$backup_db_dir/strapi.db"
        
        # Create SQL dump for reference
        if command -v sqlite3 >/dev/null 2>&1; then
            sqlite3 "$db_file" .dump > "$backup_db_dir/strapi.sql"
            log_success "Database backed up (binary + SQL dump)"
        else
            log_success "Database backed up (binary only)"
        fi
        
        # Get database info
        local db_size
        db_size=$(du -sh "$db_file" | cut -f1)
        echo "Database size: $db_size" > "$backup_db_dir/info.txt"
        echo "Backup date: $(date)" >> "$backup_db_dir/info.txt"
        
    else
        log_warning "Database file not found: $db_file"
        echo "Database file not found at backup time" > "$backup_db_dir/info.txt"
    fi
}

# Backup uploads and media
backup_uploads() {
    log_info "Backing up uploads and media..."
    
    local uploads_dir="${UPLOADS_PATH:-$PROJECT_ROOT/portfolio-cms/public/uploads}"
    local backup_uploads_dir="$BACKUP_DIR/uploads"
    
    if [ -d "$uploads_dir" ]; then
        cp -r "$uploads_dir" "$backup_uploads_dir"
        
        local upload_count
        local upload_size
        upload_count=$(find "$backup_uploads_dir" -type f | wc -l)
        upload_size=$(du -sh "$backup_uploads_dir" | cut -f1)
        
        echo "Upload files: $upload_count" > "$backup_uploads_dir/../uploads_info.txt"
        echo "Upload size: $upload_size" >> "$backup_uploads_dir/../uploads_info.txt"
        echo "Backup date: $(date)" >> "$backup_uploads_dir/../uploads_info.txt"
        
        log_success "Uploads backed up ($upload_count files, $upload_size)"
    else
        log_warning "Uploads directory not found: $uploads_dir"
        echo "Uploads directory not found at backup time" > "$BACKUP_DIR/uploads_info.txt"
    fi
}

# Backup configuration
backup_configuration() {
    log_info "Backing up configuration..."
    
    local config_dir="$BACKUP_DIR/config"
    mkdir -p "$config_dir"
    
    # Backup environment files
    local env_files=(
        "$PROJECT_ROOT/config.dev.env"
        "$PROJECT_ROOT/config.prod.env"
        "$PROJECT_ROOT/.env"
    )
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            cp "$env_file" "$config_dir/"
        fi
    done
    
    # Backup Strapi configuration
    local strapi_config_dir="$PROJECT_ROOT/portfolio-cms/config"
    if [ -d "$strapi_config_dir" ]; then
        cp -r "$strapi_config_dir" "$config_dir/strapi-config"
    fi
    
    # Backup nginx configuration
    local nginx_config_dir="$PROJECT_ROOT/nginx-prod"
    if [ -d "$nginx_config_dir" ]; then
        cp -r "$nginx_config_dir" "$config_dir/nginx-config"
    fi
    
    # Backup package.json files
    local package_files=(
        "$PROJECT_ROOT/portfolio-cms/package.json"
        "$PROJECT_ROOT/portfolio-frontend/package.json"
        "$PROJECT_ROOT/webhook/package.json"
    )
    
    for package_file in "${package_files[@]}"; do
        if [ -f "$package_file" ]; then
            local dest_name
            dest_name=$(echo "$package_file" | sed "s|$PROJECT_ROOT/||g" | tr '/' '_')
            cp "$package_file" "$config_dir/$dest_name"
        fi
    done
    
    log_success "Configuration backed up"
}

# Backup SSL certificates
backup_ssl() {
    log_info "Backing up SSL certificates..."
    
    local ssl_dir="$BACKUP_DIR/ssl"
    mkdir -p "$ssl_dir"
    
    # Backup Let's Encrypt certificates
    local letsencrypt_dir="/etc/letsencrypt"
    if [ -d "$letsencrypt_dir" ]; then
        cp -r "$letsencrypt_dir" "$ssl_dir/letsencrypt"
        log_success "Let's Encrypt certificates backed up"
    fi
    
    # Backup project SSL certificates
    local project_ssl_dir="$PROJECT_ROOT/nginx/certbot/conf"
    if [ -d "$project_ssl_dir" ]; then
        cp -r "$project_ssl_dir" "$ssl_dir/project-ssl"
        log_success "Project SSL certificates backed up"
    fi
    
    if [ ! -d "$letsencrypt_dir" ] && [ ! -d "$project_ssl_dir" ]; then
        log_warning "No SSL certificates found to backup"
        echo "No SSL certificates found at backup time" > "$ssl_dir/info.txt"
    fi
}

# Backup logs
backup_logs() {
    log_info "Backing up logs..."
    
    local logs_dir="$BACKUP_DIR/logs"
    mkdir -p "$logs_dir"
    
    # Project logs
    local project_logs_dir="${LOG_PATH:-$PROJECT_ROOT/logs}"
    if [ -d "$project_logs_dir" ]; then
        cp -r "$project_logs_dir" "$logs_dir/project-logs"
    fi
    
    # System logs (if accessible)
    local system_logs=(
        "/var/log/nginx/access.log"
        "/var/log/nginx/error.log"
    )
    
    for log_file in "${system_logs[@]}"; do
        if [ -f "$log_file" ]; then
            local log_name
            log_name=$(basename "$log_file")
            cp "$log_file" "$logs_dir/system_$log_name" 2>/dev/null || log_warning "Could not backup $log_file"
        fi
    done
    
    log_success "Logs backed up"
}

# Create backup metadata
create_backup_metadata() {
    log_info "Creating backup metadata..."
    
    local metadata_file="$BACKUP_DIR/backup_info.txt"
    
    {
        echo "=== Portfolio Website Backup Information ==="
        echo "Backup Date: $(date)"
        echo "Backup Type: ${1:-full}"
        echo "Environment: ${NODE_ENV:-unknown}"
        echo "Hostname: $(hostname)"
        echo "System: $(uname -a)"
        echo
        
        echo "=== Backup Contents ==="
        echo "Database: $([ -f "$BACKUP_DIR/database/strapi.db" ] && echo "✓ Included" || echo "✗ Not found")"
        echo "Uploads: $([ -d "$BACKUP_DIR/uploads" ] && echo "✓ Included" || echo "✗ Not found")"
        echo "Configuration: $([ -d "$BACKUP_DIR/config" ] && echo "✓ Included" || echo "✗ Not found")"
        echo "SSL Certificates: $([ -d "$BACKUP_DIR/ssl" ] && echo "✓ Included" || echo "✗ Not found")"
        echo "Logs: $([ -d "$BACKUP_DIR/logs" ] && echo "✓ Included" || echo "✗ Not found")"
        echo
        
        echo "=== Directory Structure ==="
        tree "$BACKUP_DIR" 2>/dev/null || find "$BACKUP_DIR" -type d | sed 's|[^/]*/|  |g'
        
    } > "$metadata_file"
    
    log_success "Backup metadata created"
}

# Compress backup
compress_backup() {
    log_info "Compressing backup..."
    
    local backup_base
    backup_base=$(dirname "$BACKUP_DIR")
    local backup_name
    backup_name=$(basename "$BACKUP_DIR")
    
    cd "$backup_base"
    tar -czf "$backup_name.tar.gz" "$backup_name"
    
    # Remove uncompressed backup
    rm -rf "$backup_name"
    
    local archive_size
    archive_size=$(du -sh "$backup_name.tar.gz" | cut -f1)
    
    log_success "Backup compressed: $backup_name.tar.gz ($archive_size)"
    export BACKUP_ARCHIVE="$backup_base/$backup_name.tar.gz"
}

# Clean old backups
cleanup_old_backups() {
    local retention_days="${BACKUP_RETENTION_DAYS:-30}"
    local backup_base="${BACKUP_PATH:-$PROJECT_ROOT/backups}"
    
    log_info "Cleaning up backups older than $retention_days days..."
    
    if [ -d "$backup_base" ]; then
        local deleted_count
        deleted_count=$(find "$backup_base" -name "portfolio_backup_*.tar.gz" -mtime +$retention_days -delete -print | wc -l)
        
        if [ "$deleted_count" -gt 0 ]; then
            log_success "Deleted $deleted_count old backup(s)"
        else
            log_info "No old backups to delete"
        fi
    fi
}

# List existing backups
list_backups() {
    local backup_base="${BACKUP_PATH:-$PROJECT_ROOT/backups}"
    
    log_info "Available backups:"
    echo
    
    if [ -d "$backup_base" ]; then
        find "$backup_base" -name "portfolio_backup_*.tar.gz" -printf '%TY-%Tm-%Td %TH:%TM  %s bytes  %p\n' 2>/dev/null | sort -r || \
        find "$backup_base" -name "portfolio_backup_*.tar.gz" -exec ls -lh {} \; | awk '{print $6 " " $7 " " $8 "  " $5 "  " $9}' | sort -r
    else
        echo "No backup directory found at: $backup_base"
    fi
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        log_error "Please specify a backup file to restore from"
        echo "Usage: $0 restore <backup-file.tar.gz>"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_info "Restoring from backup: $backup_file"
    
    # Create restore directory
    local restore_dir="/tmp/portfolio_restore_$(date +%s)"
    mkdir -p "$restore_dir"
    
    # Extract backup
    tar -xzf "$backup_file" -C "$restore_dir"
    local backup_content_dir
    backup_content_dir=$(find "$restore_dir" -maxdepth 1 -type d -name "portfolio_backup_*" | head -1)
    
    if [ ! -d "$backup_content_dir" ]; then
        log_error "Invalid backup archive structure"
        rm -rf "$restore_dir"
        return 1
    fi
    
    # Show backup info
    if [ -f "$backup_content_dir/backup_info.txt" ]; then
        echo "=== Backup Information ==="
        cat "$backup_content_dir/backup_info.txt"
        echo
    fi
    
    # Confirm restore
    read -p "Are you sure you want to restore from this backup? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        rm -rf "$restore_dir"
        return 0
    fi
    
    # Stop services
    log_info "Stopping services for restore..."
    "$SCRIPT_DIR/manage.sh" stop || true
    
    # Restore database
    if [ -f "$backup_content_dir/database/strapi.db" ]; then
        log_info "Restoring database..."
        local db_file="${DATABASE_FILENAME:-$PROJECT_ROOT/strapi-data/strapi.db}"
        mkdir -p "$(dirname "$db_file")"
        cp "$backup_content_dir/database/strapi.db" "$db_file"
        log_success "Database restored"
    fi
    
    # Restore uploads
    if [ -d "$backup_content_dir/uploads" ]; then
        log_info "Restoring uploads..."
        local uploads_dir="${UPLOADS_PATH:-$PROJECT_ROOT/portfolio-cms/public/uploads}"
        rm -rf "$uploads_dir"
        cp -r "$backup_content_dir/uploads" "$uploads_dir"
        log_success "Uploads restored"
    fi
    
    # Restore configuration
    if [ -d "$backup_content_dir/config" ]; then
        log_info "Restoring configuration..."
        
        # Restore environment files
        find "$backup_content_dir/config" -name "*.env" -exec cp {} "$PROJECT_ROOT/" \;
        
        # Restore Strapi config
        if [ -d "$backup_content_dir/config/strapi-config" ]; then
            cp -r "$backup_content_dir/config/strapi-config"/* "$PROJECT_ROOT/portfolio-cms/config/"
        fi
        
        log_success "Configuration restored"
    fi
    
    # Clean up
    rm -rf "$restore_dir"
    
    log_success "Restore completed successfully"
    log_info "Please restart services: $SCRIPT_DIR/manage.sh start"
}

# Show usage
show_usage() {
    echo "Portfolio Website Backup Management"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  backup [type]          - Create backup (full|database|config)"
    echo "  list                   - List available backups"
    echo "  restore <file>         - Restore from backup file"
    echo "  cleanup                - Remove old backups"
    echo
    echo "Examples:"
    echo "  $0 backup              - Create full backup"
    echo "  $0 backup database     - Backup only database"
    echo "  $0 list                - Show available backups"
    echo "  $0 restore backup.tar.gz - Restore from specific backup"
    echo "  $0 cleanup             - Clean old backups"
}

# Main function
main() {
    local command="${1:-backup}"
    
    load_environment
    
    case "$command" in
        "backup")
            local backup_type="${2:-full}"
            setup_backup_structure
            
            case "$backup_type" in
                "full"|"")
                    backup_database
                    backup_uploads
                    backup_configuration
                    backup_ssl
                    backup_logs
                    ;;
                "database")
                    backup_database
                    ;;
                "config")
                    backup_configuration
                    backup_ssl
                    ;;
                *)
                    log_error "Unknown backup type: $backup_type"
                    echo "Available types: full, database, config"
                    exit 1
                    ;;
            esac
            
            create_backup_metadata "$backup_type"
            compress_backup
            cleanup_old_backups
            
            echo
            log_success "=== Backup Complete ==="
            echo "Backup file: $BACKUP_ARCHIVE"
            echo "Backup size: $(du -sh "$BACKUP_ARCHIVE" | cut -f1)"
            ;;
            
        "list")
            list_backups
            ;;
            
        "restore")
            restore_backup "$2"
            ;;
            
        "cleanup")
            cleanup_old_backups
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
