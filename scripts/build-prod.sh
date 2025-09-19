#!/bin/bash
set -e

# Portfolio Website Production Build Script
# Comprehensive build pipeline for production deployment

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
    log_info "Setting up production build environment..."
    
    # Load production environment
    source "$SCRIPT_DIR/env-setup.sh" prod
    
    log_success "Environment setup complete"
}

# Pre-build validation
validate_prebuild() {
    log_info "Validating build environment..."
    
    local validation_failed=0
    
    # Check Node.js version
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed"
        ((validation_failed++))
    else
        local node_version
        node_version=$(node --version | sed 's/v//')
        local major_version
        major_version=$(echo "$node_version" | cut -d. -f1)
        
        if [ "$major_version" -lt 18 ]; then
            log_error "Node.js version $node_version is too old. Required: 18+"
            ((validation_failed++))
        else
            log_success "Node.js version $node_version ✓"
        fi
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed"
        ((validation_failed++))
    fi
    
    # Check required directories
    local required_dirs=(
        "$PROJECT_ROOT/portfolio-cms"
        "$PROJECT_ROOT/portfolio-frontend"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            log_error "Required directory not found: $dir"
            ((validation_failed++))
        fi
    done
    
    # Check package.json files
    local package_files=(
        "$PROJECT_ROOT/portfolio-cms/package.json"
        "$PROJECT_ROOT/portfolio-frontend/package.json"
    )
    
    for file in "${package_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required package.json not found: $file"
            ((validation_failed++))
        fi
    done
    
    if [ $validation_failed -eq 0 ]; then
        log_success "Build environment validation passed"
        return 0
    else
        log_error "Build environment validation failed ($validation_failed errors)"
        return 1
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing production dependencies..."
    
    # Install Strapi dependencies
    log_info "Installing Strapi dependencies..."
    cd "$PROJECT_ROOT/portfolio-cms"
    npm install --production
    
    # Install Eleventy dependencies
    log_info "Installing Eleventy dependencies..."
    cd "$PROJECT_ROOT/portfolio-frontend"
    npm install --production
    
    # Install webpack dependencies
    npm install webpack webpack-cli --save-dev
    
    cd "$PROJECT_ROOT"
    log_success "Dependencies installed"
}

# Start Strapi for build
start_strapi_for_build() {
    log_info "Starting Strapi for build process..."
    
    cd "$PROJECT_ROOT/portfolio-cms"
    
    # Set environment variables
    export NODE_ENV=production
    export DATABASE_CLIENT=sqlite
    export DATABASE_FILENAME="$DATABASE_FILENAME"
    export STRAPI_TELEMETRY_DISABLED=true
    
    # Check if database exists
    if [ ! -f "$DATABASE_FILENAME" ]; then
        log_warning "Database file not found. Strapi will create a new one."
    fi
    
    # Start Strapi in background
    nohup npm run start > "$PROJECT_ROOT/logs/strapi-build.log" 2>&1 &
    local strapi_pid=$!
    echo $strapi_pid > "/tmp/strapi-build.pid"
    
    log_info "Strapi started for build (PID: $strapi_pid)"
    
    # Wait for Strapi to be ready
    log_info "Waiting for Strapi API to be available..."
    local max_wait=120
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi API is ready"
            break
        fi
        
        if [ $((waited % 10)) -eq 0 ]; then
            log_info "Still waiting for Strapi... ($waited/$max_wait seconds)"
        fi
        
        sleep 2
        ((waited += 2))
    done
    
    if [ $waited -ge $max_wait ]; then
        log_error "Strapi failed to start within $max_wait seconds"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    return 0
}

# Stop build Strapi
stop_strapi_for_build() {
    if [ -f "/tmp/strapi-build.pid" ]; then
        local strapi_pid
        strapi_pid=$(cat "/tmp/strapi-build.pid")
        if kill -0 "$strapi_pid" 2>/dev/null; then
            log_info "Stopping build Strapi (PID: $strapi_pid)"
            kill "$strapi_pid" 2>/dev/null || true
            
            # Wait for process to stop
            local attempts=0
            while [ $attempts -lt 10 ] && kill -0 "$strapi_pid" 2>/dev/null; do
                sleep 1
                ((attempts++))
            done
            
            # Force kill if still running
            if kill -0 "$strapi_pid" 2>/dev/null; then
                kill -9 "$strapi_pid" 2>/dev/null || true
            fi
        fi
        rm -f "/tmp/strapi-build.pid"
    fi
}

# Build frontend assets
build_frontend() {
    log_info "Building frontend assets..."
    
    cd "$PROJECT_ROOT/portfolio-frontend"
    
    # Set environment variables
    export NODE_ENV=production
    export ELEVENTY_ENV=production
    export STRAPI_URL="$STRAPI_URL"
    export NODE_OPTIONS="--openssl-legacy-provider"
    
    # Clean previous build
    log_info "Cleaning previous build..."
    rm -rf _site
    npm run clean || true
    
    # Build webpack assets
    log_info "Building webpack assets..."
    if ! npm run build:webpack; then
        log_error "Webpack build failed"
        return 1
    fi
    
    # Build Eleventy site
    log_info "Building Eleventy site..."
    if ! npm run build:eleventy; then
        log_error "Eleventy build failed"
        return 1
    fi
    
    # Validate build output
    if [ ! -d "_site" ]; then
        log_error "Build output directory not created"
        return 1
    fi
    
    local file_count
    file_count=$(find _site -type f | wc -l)
    
    if [ "$file_count" -lt 1 ]; then
        log_error "No files found in build output"
        return 1
    fi
    
    log_success "Frontend build completed ($file_count files)"
    
    cd "$PROJECT_ROOT"
}

# Copy assets and uploads
copy_assets() {
    log_info "Copying assets and uploads..."
    
    local site_dir="$PROJECT_ROOT/portfolio-frontend/_site"
    
    # Copy Strapi uploads
    local uploads_src="$PROJECT_ROOT/portfolio-cms/public/uploads"
    local uploads_dest="$site_dir/uploads"
    
    if [ -d "$uploads_src" ]; then
        log_info "Copying Strapi uploads..."
        cp -r "$uploads_src" "$uploads_dest"
        local upload_count
        upload_count=$(find "$uploads_dest" -type f | wc -l)
        log_success "Copied $upload_count upload files"
    else
        log_warning "No uploads directory found at $uploads_src"
    fi
    
    # Copy additional static assets if they exist
    local static_assets="$PROJECT_ROOT/static"
    if [ -d "$static_assets" ]; then
        log_info "Copying static assets..."
        cp -r "$static_assets"/* "$site_dir/"
    fi
}

# Optimize production build
optimize_build() {
    log_info "Optimizing production build..."
    
    local site_dir="$PROJECT_ROOT/portfolio-frontend/_site"
    
    # Compress HTML files (if html-minifier is available)
    if command -v html-minifier >/dev/null 2>&1; then
        log_info "Minifying HTML files..."
        find "$site_dir" -name "*.html" -exec html-minifier --collapse-whitespace --remove-comments --minify-css --minify-js {} -o {} \;
    fi
    
    # Create gzip versions for nginx
    if command -v gzip >/dev/null 2>&1; then
        log_info "Creating gzip versions..."
        find "$site_dir" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" \) -exec gzip -c {} > {}.gz \;
    fi
    
    # Generate file checksums for cache busting
    log_info "Generating checksums..."
    find "$site_dir" -type f -name "*.css" -o -name "*.js" | while read -r file; do
        local checksum
        checksum=$(md5sum "$file" | cut -d' ' -f1)
        echo "$checksum  $(basename "$file")" >> "$site_dir/checksums.txt"
    done
    
    log_success "Build optimization completed"
}

# Deploy build
deploy_build() {
    log_info "Deploying build..."
    
    local site_dir="$PROJECT_ROOT/portfolio-frontend/_site"
    local deploy_dir="$SITE_BUILD_PATH"
    
    if [ -z "$deploy_dir" ] || [ "$deploy_dir" = "$site_dir" ]; then
        log_info "No deployment directory specified, build remains at $site_dir"
        return 0
    fi
    
    # Create deployment directory
    mkdir -p "$deploy_dir"
    
    # Create backup of current deployment
    if [ -d "$deploy_dir" ] && [ "$(ls -A "$deploy_dir")" ]; then
        local backup_dir="$deploy_dir.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "Creating backup at $backup_dir"
        cp -r "$deploy_dir" "$backup_dir"
    fi
    
    # Deploy new build
    log_info "Copying build to deployment directory..."
    cp -r "$site_dir"/* "$deploy_dir/"
    
    # Set appropriate permissions
    find "$deploy_dir" -type d -exec chmod 755 {} \;
    find "$deploy_dir" -type f -exec chmod 644 {} \;
    
    log_success "Build deployed to $deploy_dir"
}

# Generate build report
generate_build_report() {
    log_info "Generating build report..."
    
    local site_dir="$PROJECT_ROOT/portfolio-frontend/_site"
    local report_file="$PROJECT_ROOT/logs/build-report.txt"
    
    {
        echo "=== Portfolio Website Build Report ==="
        echo "Build Date: $(date)"
        echo "Environment: $NODE_ENV"
        echo "Strapi URL: $STRAPI_URL"
        echo
        
        if [ -d "$site_dir" ]; then
            echo "Build Statistics:"
            echo "  Total Files: $(find "$site_dir" -type f | wc -l)"
            echo "  HTML Files: $(find "$site_dir" -name "*.html" | wc -l)"
            echo "  CSS Files: $(find "$site_dir" -name "*.css" | wc -l)"
            echo "  JS Files: $(find "$site_dir" -name "*.js" | wc -l)"
            echo "  Image Files: $(find "$site_dir" -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" | wc -l)"
            echo "  Total Size: $(du -sh "$site_dir" | cut -f1)"
            echo
            
            echo "Top Level Pages:"
            find "$site_dir" -maxdepth 1 -name "*.html" -exec basename {} \; | sort
        else
            echo "ERROR: Build directory not found"
        fi
        
        echo
        echo "Build Log Location: $PROJECT_ROOT/logs/"
        
    } > "$report_file"
    
    log_success "Build report generated: $report_file"
    
    # Display summary
    if [ -d "$site_dir" ]; then
        local file_count
        local total_size
        file_count=$(find "$site_dir" -type f | wc -l)
        total_size=$(du -sh "$site_dir" | cut -f1)
        
        echo
        log_success "=== Build Summary ==="
        echo "Total Files: $file_count"
        echo "Total Size: $total_size"
        echo "Location: $site_dir"
        
        if [ -n "$SITE_BUILD_PATH" ] && [ "$SITE_BUILD_PATH" != "$site_dir" ]; then
            echo "Deployed To: $SITE_BUILD_PATH"
        fi
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    stop_strapi_for_build
}

# Set up cleanup on exit
trap cleanup EXIT

# Main function
main() {
    local command="${1:-build}"
    
    log_info "=== Portfolio Website Production Build ==="
    
    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    case "$command" in
        "build"|"")
            setup_environment
            validate_prebuild || exit 1
            install_dependencies
            start_strapi_for_build || exit 1
            build_frontend || exit 1
            copy_assets
            optimize_build
            deploy_build
            generate_build_report
            ;;
        "clean")
            log_info "Cleaning build directories..."
            rm -rf "$PROJECT_ROOT/portfolio-frontend/_site"
            rm -rf "$PROJECT_ROOT/portfolio-frontend/node_modules/.cache"
            if [ -n "$SITE_BUILD_PATH" ]; then
                rm -rf "$SITE_BUILD_PATH"
            fi
            log_success "Build directories cleaned"
            ;;
        "validate")
            setup_environment
            validate_prebuild
            ;;
        *)
            echo "Usage: $0 [build|clean|validate]"
            echo "  build    - Full production build (default)"
            echo "  clean    - Clean build directories"
            echo "  validate - Validate build environment"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
