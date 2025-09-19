#!/bin/bash

# Portfolio Website Logs Script
# Display logs from development or production servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_usage() {
    echo "Usage: $0 [strapi|eleventy|all] [follow]"
    echo
    echo "Commands:"
    echo "  strapi   - Show Strapi logs"
    echo "  eleventy - Show Eleventy logs"
    echo "  all      - Show all logs (default)"
    echo
    echo "Options:"
    echo "  follow   - Follow logs in real-time (tail -f)"
    echo
    echo "Examples:"
    echo "  $0 strapi         - Show Strapi logs"
    echo "  $0 eleventy follow - Follow Eleventy logs"
    echo "  $0 all follow     - Follow all logs"
}

show_logs() {
    local log_type="$1"
    local follow="${2:-false}"
    local logs_dir="$PROJECT_ROOT/logs"
    
    if [ ! -d "$logs_dir" ]; then
        echo "No logs directory found. Run development servers first."
        exit 1
    fi
    
    case "$log_type" in
        "strapi")
            local strapi_log="$logs_dir/strapi-dev.log"
            if [ -f "$strapi_log" ]; then
                echo -e "${CYAN}=== Strapi Logs ===${NC}"
                if [ "$follow" = "follow" ]; then
                    tail -f "$strapi_log"
                else
                    tail -n 50 "$strapi_log"
                fi
            else
                echo "Strapi log file not found: $strapi_log"
            fi
            ;;
            
        "eleventy")
            local eleventy_log="$logs_dir/eleventy-dev.log"
            if [ -f "$eleventy_log" ]; then
                echo -e "${YELLOW}=== Eleventy Logs ===${NC}"
                if [ "$follow" = "follow" ]; then
                    tail -f "$eleventy_log"
                else
                    tail -n 50 "$eleventy_log"
                fi
            else
                echo "Eleventy log file not found: $eleventy_log"
            fi
            ;;
            
        "all"|*)
            echo -e "${BLUE}=== Portfolio Website Logs ===${NC}"
            echo
            
            local strapi_log="$logs_dir/strapi-dev.log"
            local eleventy_log="$logs_dir/eleventy-dev.log"
            
            if [ "$follow" = "follow" ]; then
                # Use multitail if available, otherwise alternate between logs
                if command -v multitail >/dev/null 2>&1; then
                    multitail -ci cyan -l "tail -f $strapi_log" -ci yellow -l "tail -f $eleventy_log"
                else
                    echo "Following logs (install multitail for better experience):"
                    echo -e "${CYAN}Strapi: $strapi_log${NC}"
                    echo -e "${YELLOW}Eleventy: $eleventy_log${NC}"
                    echo
                    tail -f "$strapi_log" "$eleventy_log" 2>/dev/null
                fi
            else
                if [ -f "$strapi_log" ]; then
                    echo -e "${CYAN}=== Strapi Logs (last 25 lines) ===${NC}"
                    tail -n 25 "$strapi_log"
                    echo
                fi
                
                if [ -f "$eleventy_log" ]; then
                    echo -e "${YELLOW}=== Eleventy Logs (last 25 lines) ===${NC}"
                    tail -n 25 "$eleventy_log"
                    echo
                fi
            fi
            ;;
    esac
}

# Parse arguments
log_type="${1:-all}"
follow_option="$2"

case "$log_type" in
    "help"|"-h"|"--help")
        show_usage
        exit 0
        ;;
    *)
        show_logs "$log_type" "$follow_option"
        ;;
esac
