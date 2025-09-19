#!/bin/bash

# Portfolio Website Stop Script
# Stops all running development servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# PID files
STRAPI_PID_FILE="$PROJECT_ROOT/.pids/strapi.pid"
ELEVENTY_PID_FILE="$PROJECT_ROOT/.pids/eleventy.pid"

log_info "Stopping portfolio website servers..."

stopped_count=0

# Stop Strapi
if [ -f "$STRAPI_PID_FILE" ]; then
    strapi_pid=$(cat "$STRAPI_PID_FILE")
    if kill -0 "$strapi_pid" 2>/dev/null; then
        log_info "Stopping Strapi (PID: $strapi_pid)"
        kill "$strapi_pid" 2>/dev/null || true
        ((stopped_count++))
    fi
    rm -f "$STRAPI_PID_FILE"
fi

# Stop Eleventy
if [ -f "$ELEVENTY_PID_FILE" ]; then
    eleventy_pid=$(cat "$ELEVENTY_PID_FILE")
    if kill -0 "$eleventy_pid" 2>/dev/null; then
        log_info "Stopping Eleventy (PID: $eleventy_pid)"
        kill "$eleventy_pid" 2>/dev/null || true
        ((stopped_count++))
    fi
    rm -f "$ELEVENTY_PID_FILE"
fi

# Kill any remaining processes related to this project
project_name=$(basename "$PROJECT_ROOT")
if pkill -f "$project_name" 2>/dev/null; then
    ((stopped_count++))
fi

if [ $stopped_count -gt 0 ]; then
    log_success "Stopped $stopped_count server(s)"
else
    log_info "No servers were running"
fi
