#!/bin/bash

# Portfolio Website Stop Script
# Stops all running development and production servers

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

log_info "Stopping portfolio website servers..."

stopped_count=0

# Stop services based on PID files
if [ -d "$PROJECT_ROOT/.pids" ]; then
    for pidfile in "$PROJECT_ROOT/.pids"/*.pid; do
        if [ -f "$pidfile" ]; then
            service_name=$(basename "$pidfile" .pid)
            pid=$(cat "$pidfile")
            
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping $service_name (PID: $pid)"
                kill "$pid" 2>/dev/null || true
                ((stopped_count++))
            fi
            rm -f "$pidfile"
        fi
    done
fi

# Clean up temporary build PIDs
if [ -f "/tmp/strapi-build.pid" ]; then
    build_pid=$(cat "/tmp/strapi-build.pid")
    if kill -0 "$build_pid" 2>/dev/null; then
        log_info "Stopping temporary Strapi build process (PID: $build_pid)"
        kill "$build_pid" 2>/dev/null || true
        ((stopped_count++))
    fi
    rm -f "/tmp/strapi-build.pid"
fi

# Kill any remaining Node.js processes related to this project
project_name=$(basename "$PROJECT_ROOT")
if pgrep -f "$project_name" >/dev/null 2>&1; then
    log_info "Stopping remaining processes for $project_name"
    pkill -f "$project_name" 2>/dev/null || true
    ((stopped_count++))
fi

# Stop specific processes by name
for process_name in "strapi" "eleventy" "webpack"; do
    if pgrep -f "$process_name.*$project_name" >/dev/null 2>&1; then
        log_info "Stopping $process_name processes"
        pkill -f "$process_name.*$project_name" 2>/dev/null || true
        ((stopped_count++))
    fi
done

if [ $stopped_count -gt 0 ]; then
    log_success "Stopped $stopped_count server(s)/process(es)"
else
    log_info "No servers were running"
fi

# Clean up .pids directory if empty
if [ -d "$PROJECT_ROOT/.pids" ] && [ ! "$(ls -A "$PROJECT_ROOT/.pids")" ]; then
    rmdir "$PROJECT_ROOT/.pids"
fi

log_success "Portfolio website servers stopped"
