#!/bin/bash
set -e

# Portfolio Website Development Build Script
# Builds the Eleventy site for local testing

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
    log_info "Setting up development build environment..."
    
    # Load environment configuration
    source "$SCRIPT_DIR/env-setup.sh" dev
    
    log_success "Environment setup complete"
}

# Check if Strapi is running
check_strapi_availability() {
    log_info "Checking Strapi availability..."
    
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi is accessible at $STRAPI_URL"
            return 0
        fi
        
        ((attempt++))
        if [ $attempt -lt $max_attempts ]; then
            log_info "Waiting for Strapi... ($attempt/$max_attempts)"
            sleep 3
        fi
    done
    
    log_warning "Strapi is not accessible. Starting Strapi first..."
    return 1
}

# Start Strapi if needed
start_strapi_if_needed() {
    if ! check_strapi_availability; then
        log_info "Starting Strapi for build process..."
        
        cd "$PROJECT_ROOT/portfolio-cms"
        
        # Check if packages are installed
        if [ ! -d "node_modules" ]; then
            log_info "Installing Strapi dependencies..."
            npm install
        fi
        
        # Set environment variables
        export NODE_ENV=development
        export DATABASE_CLIENT=sqlite
        export DATABASE_FILENAME="$DATABASE_FILENAME"
        export STRAPI_TELEMETRY_DISABLED=true
        
        # Start Strapi in background
        log_info "Starting temporary Strapi instance..."
        npm run develop &
        local strapi_pid=$!
        
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
        
        if [ $waited -ge $max_wait ]; then
            log_error "Strapi failed to start within $max_wait seconds"
            kill $strapi_pid 2>/dev/null || true
            exit 1
        fi
        
        # Store PID for cleanup
        echo $strapi_pid > "/tmp/strapi-build.pid"
        
        cd "$PROJECT_ROOT"
    fi
}

# Build Eleventy site
build_eleventy() {
    log_info "Building Eleventy site..."
    
    cd "$PROJECT_ROOT/portfolio-frontend"
    
    # Check if packages are installed
    if [ ! -d "node_modules" ]; then
        log_info "Installing Eleventy dependencies..."
        npm install
    fi
    
    # Clean previous build
    log_info "Cleaning previous build..."
    npm run clean
    
    # Set environment variables
    export ELEVENTY_ENV=development
    export STRAPI_URL="$STRAPI_URL"
    export NODE_OPTIONS="--openssl-legacy-provider"
    
    # Build webpack assets
    log_info "Building webpack assets..."
    npm run build-dev:webpack
    
    # Build Eleventy site
    log_info "Building Eleventy site..."
    npm run build:eleventy
    
    log_success "Eleventy build complete"
    
    cd "$PROJECT_ROOT"
}

# Copy uploads and assets
copy_assets() {
    log_info "Copying uploads and assets..."
    
    local uploads_src="$PROJECT_ROOT/portfolio-cms/public/uploads"
    local uploads_dest="$PROJECT_ROOT/portfolio-frontend/_site/uploads"
    
    if [ -d "$uploads_src" ]; then
        log_info "Copying uploads from Strapi..."
        cp -r "$uploads_src" "$uploads_dest"
        log_success "Uploads copied"
    else
        log_warning "No uploads directory found at $uploads_src"
    fi
}

# Serve site locally
serve_site() {
    local serve="${1:-false}"
    
    if [ "$serve" = "true" ] || [ "$serve" = "serve" ]; then
        log_info "Starting local server..."
        
        cd "$PROJECT_ROOT/portfolio-frontend"
        
        log_success "Site available at: http://localhost:3000"
        log_info "Press Ctrl+C to stop the server"
        
        npx serve _site -p 3000
    else
        log_info "Built site is available at: $PROJECT_ROOT/portfolio-frontend/_site"
        log_info "To serve locally, run: $0 serve"
    fi
}

# Cleanup function
cleanup() {
    # Kill temporary Strapi if we started it
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

# Set up cleanup on exit
trap cleanup EXIT

# Display build info
show_build_info() {
    local build_size
    local build_files
    
    if [ -d "$PROJECT_ROOT/portfolio-frontend/_site" ]; then
        build_size=$(du -sh "$PROJECT_ROOT/portfolio-frontend/_site" | cut -f1)
        build_files=$(find "$PROJECT_ROOT/portfolio-frontend/_site" -type f | wc -l | tr -d ' ')
        
        echo
        log_success "=== Build Complete ==="
        echo "Build size: $build_size"
        echo "Total files: $build_files"
        echo "Location: $PROJECT_ROOT/portfolio-frontend/_site"
        echo
        echo "Commands:"
        echo "  Serve locally: $0 serve"
        echo "  View files:    ls -la $PROJECT_ROOT/portfolio-frontend/_site"
        echo
    fi
}

# Main function
main() {
    local command="${1:-build}"
    
    log_info "=== Portfolio Website Development Build ==="
    
    # Setup environment
    setup_environment
    
    case "$command" in
        "build"|"")
            start_strapi_if_needed
            build_eleventy
            copy_assets
            show_build_info
            ;;
        "serve")
            if [ ! -d "$PROJECT_ROOT/portfolio-frontend/_site" ]; then
                log_info "No built site found. Building first..."
                start_strapi_if_needed
                build_eleventy
                copy_assets
            fi
            serve_site true
            ;;
        "clean")
            log_info "Cleaning build directory..."
            rm -rf "$PROJECT_ROOT/portfolio-frontend/_site"
            log_success "Build directory cleaned"
            ;;
        *)
            echo "Usage: $0 [build|serve|clean]"
            echo "  build - Build the site (default)"
            echo "  serve - Build and serve the site locally"
            echo "  clean - Clean the build directory"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
