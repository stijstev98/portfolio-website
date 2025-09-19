#!/bin/bash
set -e

# Portfolio Website Development Script
# Starts Strapi and Eleventy in development mode with hot reload

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

log_strapi() {
    echo -e "${CYAN}[STRAPI]${NC} $1"
}

log_eleventy() {
    echo -e "${YELLOW}[ELEVENTY]${NC} $1"
}

# PID files for process management
STRAPI_PID_FILE="$PROJECT_ROOT/.pids/strapi.pid"
ELEVENTY_PID_FILE="$PROJECT_ROOT/.pids/eleventy.pid"

# Cleanup function
cleanup() {
    log_info "Shutting down development servers..."
    
    # Kill Strapi process
    if [ -f "$STRAPI_PID_FILE" ]; then
        local strapi_pid
        strapi_pid=$(cat "$STRAPI_PID_FILE")
        if kill -0 "$strapi_pid" 2>/dev/null; then
            log_strapi "Stopping Strapi (PID: $strapi_pid)"
            kill "$strapi_pid" 2>/dev/null || true
        fi
        rm -f "$STRAPI_PID_FILE"
    fi
    
    # Kill Eleventy process
    if [ -f "$ELEVENTY_PID_FILE" ]; then
        local eleventy_pid
        eleventy_pid=$(cat "$ELEVENTY_PID_FILE")
        if kill -0 "$eleventy_pid" 2>/dev/null; then
            log_eleventy "Stopping Eleventy (PID: $eleventy_pid)"
            kill "$eleventy_pid" 2>/dev/null || true
        fi
        rm -f "$ELEVENTY_PID_FILE"
    fi
    
    # Kill any remaining Node processes related to this project
    local project_name
    project_name=$(basename "$PROJECT_ROOT")
    pkill -f "$project_name" 2>/dev/null || true
    
    log_success "Development servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Setup environment
setup_environment() {
    log_info "Setting up development environment..."
    
    # Run environment setup
    source "$SCRIPT_DIR/env-setup.sh" dev
    
    # Load environment variables from .env file
    if [ -f "$PROJECT_ROOT/.env" ]; then
        log_info "Loading environment variables from .env"
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
    
    # Check dependencies
    log_info "Checking dependencies..."
    if ! "$SCRIPT_DIR/check-dependencies.sh"; then
        log_error "Dependency check failed. Please resolve issues before continuing."
        exit 1
    fi
    
    # Create PID directory
    mkdir -p "$(dirname "$STRAPI_PID_FILE")"
    
    log_success "Environment setup complete"
}

# Wait for Strapi to be ready
wait_for_strapi() {
    log_info "Waiting for Strapi to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$STRAPI_URL/api" >/dev/null 2>&1; then
            log_success "Strapi is ready at $STRAPI_URL"
            return 0
        fi
        
        ((attempt++))
        log_info "Waiting for Strapi... ($attempt/$max_attempts)"
        sleep 2
    done
    
    log_error "Strapi did not start within expected time"
    return 1
}

# Start Strapi in development mode
start_strapi() {
    log_strapi "Starting Strapi in development mode..."
    
    cd "$PROJECT_ROOT/portfolio-cms"
    
    # Check if packages are installed
    if [ ! -d "node_modules" ]; then
        log_strapi "Installing Strapi dependencies..."
        npm install
    fi
    
    # Start Strapi in background
    log_strapi "Starting Strapi server at $STRAPI_URL"
    
    # Set environment variables for Strapi
    export NODE_ENV=development
    export DATABASE_CLIENT=sqlite
    export DATABASE_FILENAME="$DATABASE_FILENAME"
    export STRAPI_TELEMETRY_DISABLED=true
    
    log_strapi "Database configuration: CLIENT=$DATABASE_CLIENT, FILENAME=$DATABASE_FILENAME"
    
    # Start Strapi and capture PID
    nohup npm run develop > "$PROJECT_ROOT/logs/strapi-dev.log" 2>&1 &
    local strapi_pid=$!
    echo $strapi_pid > "$STRAPI_PID_FILE"
    
    log_strapi "Strapi started with PID: $strapi_pid"
    log_strapi "Logs: tail -f $PROJECT_ROOT/logs/strapi-dev.log"
    
    cd "$PROJECT_ROOT"
}

# Start Eleventy in development mode
start_eleventy() {
    log_eleventy "Starting Eleventy in development mode..."
    
    cd "$PROJECT_ROOT/portfolio-frontend"
    
    # Check if packages are installed
    if [ ! -d "node_modules" ]; then
        log_eleventy "Installing Eleventy dependencies..."
        npm install
    fi
    
    # Set environment variables for Eleventy
    export ELEVENTY_ENV=development
    export STRAPI_URL="$STRAPI_URL"
    
    # Start Eleventy in watch mode
    log_eleventy "Starting Eleventy development server at $ELEVENTY_URL"
    
    nohup npm run dev > "$PROJECT_ROOT/logs/eleventy-dev.log" 2>&1 &
    local eleventy_pid=$!
    echo $eleventy_pid > "$ELEVENTY_PID_FILE"
    
    log_eleventy "Eleventy started with PID: $eleventy_pid"
    log_eleventy "Logs: tail -f $PROJECT_ROOT/logs/eleventy-dev.log"
    
    cd "$PROJECT_ROOT"
}

# Monitor processes
monitor_processes() {
    log_info "Monitoring development servers..."
    log_info "Press Ctrl+C to stop all servers"
    
    while true; do
        # Check if Strapi is still running
        if [ -f "$STRAPI_PID_FILE" ]; then
            local strapi_pid
            strapi_pid=$(cat "$STRAPI_PID_FILE")
            if ! kill -0 "$strapi_pid" 2>/dev/null; then
                log_error "Strapi process died (PID: $strapi_pid)"
                rm -f "$STRAPI_PID_FILE"
            fi
        fi
        
        # Check if Eleventy is still running
        if [ -f "$ELEVENTY_PID_FILE" ]; then
            local eleventy_pid
            eleventy_pid=$(cat "$ELEVENTY_PID_FILE")
            if ! kill -0 "$eleventy_pid" 2>/dev/null; then
                log_error "Eleventy process died (PID: $eleventy_pid)"
                rm -f "$ELEVENTY_PID_FILE"
            fi
        fi
        
        sleep 5
    done
}

# Display development info
show_dev_info() {
    echo
    log_success "=== Development Environment Ready ==="
    echo
    echo -e "${CYAN}Strapi CMS:${NC}     $STRAPI_URL"
    echo -e "${CYAN}Strapi Admin:${NC}   $STRAPI_URL/admin"
    echo -e "${YELLOW}Eleventy Site:${NC}  $ELEVENTY_URL"
    echo
    echo -e "${BLUE}Logs:${NC}"
    echo -e "  Strapi:   tail -f $PROJECT_ROOT/logs/strapi-dev.log"
    echo -e "  Eleventy: tail -f $PROJECT_ROOT/logs/eleventy-dev.log"
    echo
    echo -e "${GREEN}Commands:${NC}"
    echo -e "  View logs:    ./scripts/logs.sh"
    echo -e "  Stop servers: Ctrl+C or ./scripts/stop.sh"
    echo -e "  Restart:      ./scripts/restart-dev.sh"
    echo
}

# Main function
main() {
    log_info "=== Starting Portfolio Website Development Environment ==="
    
    # Setup environment
    setup_environment
    
    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Start services
    start_strapi
    wait_for_strapi
    start_eleventy
    
    # Wait a bit for Eleventy to initialize
    sleep 5
    
    # Show development information
    show_dev_info
    
    # Monitor processes
    monitor_processes
}

# Handle different arguments
case "${1:-}" in
    "stop")
        cleanup
        ;;
    "status")
        if [ -f "$STRAPI_PID_FILE" ] && [ -f "$ELEVENTY_PID_FILE" ]; then
            local strapi_pid eleventy_pid
            strapi_pid=$(cat "$STRAPI_PID_FILE")
            eleventy_pid=$(cat "$ELEVENTY_PID_FILE")
            
            if kill -0 "$strapi_pid" 2>/dev/null && kill -0 "$eleventy_pid" 2>/dev/null; then
                echo "Development servers are running:"
                echo "  Strapi: PID $strapi_pid"
                echo "  Eleventy: PID $eleventy_pid"
                exit 0
            fi
        fi
        echo "Development servers are not running"
        exit 1
        ;;
    "")
        main
        ;;
    *)
        echo "Usage: $0 [stop|status]"
        echo "  (no args) - Start development environment"
        echo "  stop      - Stop development servers"
        echo "  status    - Check if servers are running"
        exit 1
        ;;
esac
