#!/bin/bash
set -e

# Portfolio Website Dependency Validation Script
# Checks all required system dependencies and Node.js packages

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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_nodejs() {
    log_info "Checking Node.js installation..."
    
    if ! command_exists node; then
        log_error "Node.js is not installed"
        echo "Please install Node.js 18.x or higher from https://nodejs.org/"
        return 1
    fi
    
    local node_version
    node_version=$(node --version | sed 's/v//')
    local major_version
    major_version=$(echo "$node_version" | cut -d. -f1)
    
    if [ "$major_version" -lt 18 ]; then
        log_error "Node.js version $node_version is too old. Required: 18.x or higher"
        return 1
    fi
    
    log_success "Node.js version $node_version ✓"
}

# Check npm version
check_npm() {
    log_info "Checking npm installation..."
    
    if ! command_exists npm; then
        log_error "npm is not installed"
        return 1
    fi
    
    local npm_version
    npm_version=$(npm --version)
    log_success "npm version $npm_version ✓"
}

# Check system dependencies for image processing
check_image_processing_deps() {
    log_info "Checking image processing dependencies..."
    
    # Check for Sharp dependencies (libvips)
    if command_exists pkg-config; then
        if pkg-config --exists vips; then
            local vips_version
            vips_version=$(pkg-config --modversion vips)
            log_success "libvips version $vips_version ✓"
        else
            log_warning "libvips not found. Sharp may fall back to slower alternatives."
            echo "For better performance, install libvips:"
            echo "  macOS: brew install vips"
            echo "  Ubuntu/Debian: apt-get install libvips-dev"
        fi
    fi
    
    # Check for Canvas dependencies
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            if brew list cairo >/dev/null 2>&1; then
                log_success "Cairo (for Canvas) ✓"
            else
                log_warning "Cairo not found. Canvas may not work properly."
                echo "Install with: brew install pkg-config cairo pango libpng jpeg giflib librsvg"
            fi
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        local cairo_libs=(
            "libcairo2-dev"
            "libpango1.0-dev" 
            "libjpeg-dev"
            "libgif-dev"
            "librsvg2-dev"
        )
        
        for lib in "${cairo_libs[@]}"; do
            if dpkg -l | grep -q "$lib"; then
                log_success "$lib ✓"
            else
                log_warning "$lib not found"
            fi
        done
    fi
}

# Check PDF processing dependencies
check_pdf_deps() {
    log_info "Checking PDF processing dependencies..."
    
    if command_exists pdftoppm; then
        local poppler_version
        poppler_version=$(pdftoppm -v 2>&1 | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        log_success "Poppler utils (pdftoppm) version $poppler_version ✓"
    else
        log_warning "Poppler utils not found. PDF processing may not work."
        echo "Install with:"
        echo "  macOS: brew install poppler"
        echo "  Ubuntu/Debian: apt-get install poppler-utils"
    fi
}

# Check SQLite
check_sqlite() {
    log_info "Checking SQLite..."
    
    if command_exists sqlite3; then
        local sqlite_version
        sqlite_version=$(sqlite3 --version | cut -d' ' -f1)
        log_success "SQLite version $sqlite_version ✓"
    else
        log_error "SQLite3 is not installed"
        echo "Install with:"
        echo "  macOS: brew install sqlite"
        echo "  Ubuntu/Debian: apt-get install sqlite3"
        return 1
    fi
}

# Check database file permissions
check_database_permissions() {
    log_info "Checking database file permissions..."
    
    local db_file="$PROJECT_ROOT/strapi-data/strapi.db"
    local db_dir="$PROJECT_ROOT/strapi-data"
    
    if [ ! -d "$db_dir" ]; then
        log_info "Creating database directory: $db_dir"
        mkdir -p "$db_dir"
    fi
    
    if [ -f "$db_file" ]; then
        if [ -r "$db_file" ] && [ -w "$db_file" ]; then
            log_success "Database file permissions ✓"
        else
            log_error "Database file exists but is not readable/writable"
            return 1
        fi
    else
        # Test write permissions in directory
        local test_file="$db_dir/.write_test"
        if touch "$test_file" 2>/dev/null && rm "$test_file" 2>/dev/null; then
            log_success "Database directory write permissions ✓"
        else
            log_error "Cannot write to database directory: $db_dir"
            return 1
        fi
    fi
}

# Check Node.js packages for each component
check_node_packages() {
    local component="$1"
    local component_dir="$PROJECT_ROOT/$component"
    
    if [ ! -d "$component_dir" ]; then
        log_error "Component directory not found: $component_dir"
        return 1
    fi
    
    log_info "Checking Node.js packages for $component..."
    
    cd "$component_dir"
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in $component"
        return 1
    fi
    
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found in $component. Run 'npm install' first."
        return 1
    fi
    
    # Check if packages are up to date
    if npm list >/dev/null 2>&1; then
        log_success "$component packages ✓"
    else
        log_warning "$component packages have issues. Consider running 'npm install'"
    fi
    
    cd "$PROJECT_ROOT"
}

# Check SSL certificate requirements for production
check_ssl_requirements() {
    if [ "$NODE_ENV" = "production" ]; then
        log_info "Checking SSL requirements for production..."
        
        local cert_dir="$PROJECT_ROOT/nginx/certbot/conf/live"
        local domains=("stijnstevens.be" "admin.stijnstevens.be")
        
        for domain in "${domains[@]}"; do
            local cert_path="$cert_dir/$domain/fullchain.pem"
            local key_path="$cert_dir/$domain/privkey.pem"
            
            if [ -f "$cert_path" ] && [ -f "$key_path" ]; then
                # Check certificate expiry
                local expiry_date
                expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
                local expiry_timestamp
                expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
                local current_timestamp
                current_timestamp=$(date +%s)
                local days_until_expiry
                days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                
                if [ "$days_until_expiry" -gt 30 ]; then
                    log_success "SSL certificate for $domain (expires in $days_until_expiry days) ✓"
                elif [ "$days_until_expiry" -gt 0 ]; then
                    log_warning "SSL certificate for $domain expires soon ($days_until_expiry days)"
                else
                    log_error "SSL certificate for $domain has expired"
                fi
            else
                log_error "SSL certificate not found for $domain"
                echo "Certificate should be at: $cert_path"
            fi
        done
    fi
}

# Check system resources
check_system_resources() {
    log_info "Checking system resources..."
    
    # Check available disk space (require at least 1GB free)
    local available_space
    if [[ "$OSTYPE" == "darwin"* ]]; then
        available_space=$(df -g . | tail -1 | awk '{print $4}')
    else
        available_space=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    fi
    
    if [ "$available_space" -lt 1 ]; then
        log_warning "Low disk space: ${available_space}GB available"
    else
        log_success "Disk space: ${available_space}GB available ✓"
    fi
    
    # Check memory (require at least 1GB free)
    local available_memory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        available_memory=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' | awk '{print $1 * 4096 / 1024 / 1024 / 1024}')
    else
        available_memory=$(free -g | grep "^Mem:" | awk '{print $7}')
    fi
    
    if [ "${available_memory%.*}" -lt 1 ]; then
        log_warning "Low available memory: ${available_memory}GB"
    else
        log_success "Available memory: ${available_memory}GB ✓"
    fi
}

# Main dependency check
main() {
    log_info "=== Portfolio Website Dependency Check ==="
    
    local failed_checks=0
    
    # Load environment if available
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
    
    # Core dependencies
    check_nodejs || ((failed_checks++))
    check_npm || ((failed_checks++))
    check_sqlite || ((failed_checks++))
    
    # System dependencies
    check_image_processing_deps
    check_pdf_deps
    check_database_permissions || ((failed_checks++))
    
    # Node.js packages for each component
    check_node_packages "portfolio-cms" || ((failed_checks++))
    check_node_packages "portfolio-frontend" || ((failed_checks++))
    check_node_packages "webhook" || ((failed_checks++))
    
    # Environment-specific checks
    check_ssl_requirements
    check_system_resources
    
    echo
    if [ "$failed_checks" -eq 0 ]; then
        log_success "=== All Dependencies Check Passed ==="
        echo "Your system is ready to run the portfolio website."
        return 0
    else
        log_error "=== Dependency Check Failed ($failed_checks errors) ==="
        echo "Please resolve the issues above before running the application."
        return 1
    fi
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
