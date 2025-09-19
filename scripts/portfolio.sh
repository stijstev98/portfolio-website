#!/bin/bash
set -e

# Portfolio Website Main Management Script
# Central entry point for all portfolio website operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Logo/Banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Portfolio Website                         ║"
    echo "║                 Management Dashboard                         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show main menu
show_main_menu() {
    echo -e "${BLUE}=== Main Menu ===${NC}"
    echo
    echo -e "${GREEN}Development:${NC}"
    echo "  dev       - Start development environment"
    echo "  stop      - Stop development servers"
    echo "  build-dev - Build for local testing"
    echo "  logs      - View development logs"
    echo
    echo -e "${YELLOW}Production:${NC}"
    echo "  setup     - Setup production environment"
    echo "  start     - Start production services"
    echo "  manage    - Production management"
    echo "  deploy    - Deploy to production"
    echo
    echo -e "${MAGENTA}Maintenance:${NC}"
    echo "  backup    - Backup data and configuration"
    echo "  monitor   - Monitor system health"
    echo "  update    - Update SSL certificates"
    echo
    echo -e "${CYAN}Utilities:${NC}"
    echo "  deps      - Check dependencies"
    echo "  nginx     - Configure nginx"
    echo "  status    - Show overall status"
    echo "  help      - Show detailed help"
    echo
}

# Show detailed help
show_detailed_help() {
    echo -e "${BLUE}=== Portfolio Website Management Help ===${NC}"
    echo
    echo "This script provides a unified interface for managing your portfolio website."
    echo "The website consists of:"
    echo "  - Strapi CMS (backend content management)"
    echo "  - Eleventy (static site generator)"
    echo "  - Nginx (web server and reverse proxy)"
    echo "  - Webhook server (automatic rebuilds)"
    echo
    echo -e "${GREEN}Development Commands:${NC}"
    echo "  ./scripts/portfolio.sh dev              - Start development servers"
    echo "  ./scripts/portfolio.sh stop             - Stop all development servers"
    echo "  ./scripts/portfolio.sh build-dev        - Build site for local testing"
    echo "  ./scripts/portfolio.sh logs [service]   - View logs (strapi|eleventy|all)"
    echo
    echo -e "${YELLOW}Production Commands:${NC}"
    echo "  sudo ./scripts/portfolio.sh setup       - Initial production setup"
    echo "  ./scripts/portfolio.sh start            - Start production services"
    echo "  ./scripts/portfolio.sh manage [cmd]     - Production management"
    echo "  ./scripts/portfolio.sh deploy           - Full production deployment"
    echo
    echo -e "${MAGENTA}Maintenance Commands:${NC}"
    echo "  ./scripts/portfolio.sh backup [type]    - Create backups"
    echo "  ./scripts/portfolio.sh monitor [check]  - System monitoring"
    echo "  ./scripts/portfolio.sh update           - Update SSL certificates"
    echo
    echo -e "${CYAN}Utility Commands:${NC}"
    echo "  ./scripts/portfolio.sh deps             - Check system dependencies"
    echo "  sudo ./scripts/portfolio.sh nginx       - Configure nginx"
    echo "  ./scripts/portfolio.sh status           - Show system status"
    echo
    echo -e "${BLUE}Environment Detection:${NC}"
    echo "The script automatically detects whether you're in development or production"
    echo "based on various system indicators. You can override this with:"
    echo "  PORTFOLIO_ENV=dev ./scripts/portfolio.sh <command>"
    echo "  PORTFOLIO_ENV=prod ./scripts/portfolio.sh <command>"
    echo
    echo -e "${BLUE}Configuration:${NC}"
    echo "Configuration is managed through environment files:"
    echo "  config.dev.env  - Development settings"
    echo "  config.prod.env - Production settings"
    echo "  .env           - Active configuration (symlink)"
    echo
    echo -e "${BLUE}Logs and Monitoring:${NC}"
    echo "Logs are stored in:"
    echo "  ./logs/         - Application logs"
    echo "  /var/log/nginx/ - Nginx logs (production)"
    echo
    echo "For more specific help, run:"
    echo "  ./scripts/portfolio.sh <command> --help"
    echo
}

# Show status overview
show_status() {
    echo -e "${BLUE}=== Portfolio Website Status ===${NC}"
    echo
    
    # Detect environment
    local env_type
    if [ -f "$PROJECT_ROOT/.env" ]; then
        env_type=$(grep "NODE_ENV" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
    else
        env_type="unknown"
    fi
    
    echo "Environment: $env_type"
    echo "Project Root: $PROJECT_ROOT"
    
    # Quick service check
    if [ "$env_type" = "development" ]; then
        echo
        echo -e "${GREEN}Development Services:${NC}"
        
        # Check if dev servers are running
        if [ -f "$PROJECT_ROOT/.pids/strapi.pid" ] && [ -f "$PROJECT_ROOT/.pids/eleventy.pid" ]; then
            local strapi_pid eleventy_pid
            strapi_pid=$(cat "$PROJECT_ROOT/.pids/strapi.pid")
            eleventy_pid=$(cat "$PROJECT_ROOT/.pids/eleventy.pid")
            
            if kill -0 "$strapi_pid" 2>/dev/null && kill -0 "$eleventy_pid" 2>/dev/null; then
                echo "  Strapi:   ✓ Running (PID: $strapi_pid)"
                echo "  Eleventy: ✓ Running (PID: $eleventy_pid)"
            else
                echo "  Development servers: ✗ Not running"
            fi
        else
            echo "  Development servers: ✗ Not running"
        fi
        
    elif [ "$env_type" = "production" ]; then
        echo
        echo -e "${YELLOW}Production Services:${NC}"
        
        # Use manage script for production status
        "$SCRIPT_DIR/manage.sh" status | head -10
    fi
    
    echo
    echo -e "${CYAN}Quick Actions:${NC}"
    if [ "$env_type" = "development" ]; then
        echo "  Start dev:  ./scripts/portfolio.sh dev"
        echo "  View logs:  ./scripts/portfolio.sh logs"
        echo "  Build:      ./scripts/portfolio.sh build-dev"
    else
        echo "  Setup prod: sudo ./scripts/portfolio.sh setup"
        echo "  Start prod: ./scripts/portfolio.sh start"
        echo "  Monitor:    ./scripts/portfolio.sh monitor"
    fi
    
    echo
}

# Interactive mode
interactive_mode() {
    show_banner
    
    while true; do
        echo
        show_main_menu
        echo -n "Select an option (or 'quit' to exit): "
        read -r choice
        
        case "$choice" in
            "dev")
                "$SCRIPT_DIR/dev.sh"
                ;;
            "stop")
                "$SCRIPT_DIR/stop.sh"
                ;;
            "build-dev")
                "$SCRIPT_DIR/build-dev.sh"
                ;;
            "logs")
                echo -n "Which logs? (strapi/eleventy/all): "
                read -r log_type
                "$SCRIPT_DIR/logs.sh" "${log_type:-all}"
                ;;
            "setup")
                echo "This requires root privileges..."
                sudo "$SCRIPT_DIR/setup-prod.sh"
                ;;
            "start")
                "$SCRIPT_DIR/start-prod.sh"
                ;;
            "manage")
                echo -n "Management command (status/logs/restart): "
                read -r mgmt_cmd
                "$SCRIPT_DIR/manage.sh" "${mgmt_cmd:-status}"
                ;;
            "deploy")
                "$SCRIPT_DIR/build-prod.sh"
                ;;
            "backup")
                echo -n "Backup type (full/database/config): "
                read -r backup_type
                "$SCRIPT_DIR/backup.sh" backup "${backup_type:-full}"
                ;;
            "monitor")
                echo -n "Monitor command (check/system/continuous): "
                read -r monitor_cmd
                "$SCRIPT_DIR/monitor.sh" "${monitor_cmd:-check}"
                ;;
            "update")
                "$SCRIPT_DIR/manage.sh" ssl-update
                ;;
            "deps")
                "$SCRIPT_DIR/check-dependencies.sh"
                ;;
            "nginx")
                echo "This requires root privileges..."
                sudo "$SCRIPT_DIR/nginx-config.sh" setup-prod
                ;;
            "status")
                show_status
                ;;
            "help")
                show_detailed_help
                ;;
            "quit"|"exit"|"q")
                echo "Goodbye!"
                break
                ;;
            "")
                # Just pressed enter, show status
                show_status
                ;;
            *)
                echo "Unknown option: $choice"
                ;;
        esac
        
        echo
        echo "Press Enter to continue..."
        read -r
    done
}

# Main command dispatcher
main() {
    local command="${1:-interactive}"
    
    case "$command" in
        "dev")
            "$SCRIPT_DIR/dev.sh" "${@:2}"
            ;;
        "stop")
            "$SCRIPT_DIR/stop.sh" "${@:2}"
            ;;
        "build-dev")
            "$SCRIPT_DIR/build-dev.sh" "${@:2}"
            ;;
        "logs")
            "$SCRIPT_DIR/logs.sh" "${@:2}"
            ;;
        "setup")
            if [ "$EUID" -eq 0 ]; then
                "$SCRIPT_DIR/setup-prod.sh" "${@:2}"
            else
                echo "Production setup requires root privileges. Use: sudo $0 setup"
                exit 1
            fi
            ;;
        "start")
            "$SCRIPT_DIR/start-prod.sh" "${@:2}"
            ;;
        "manage")
            "$SCRIPT_DIR/manage.sh" "${@:2}"
            ;;
        "deploy")
            "$SCRIPT_DIR/build-prod.sh" "${@:2}"
            ;;
        "backup")
            "$SCRIPT_DIR/backup.sh" "${@:2}"
            ;;
        "monitor")
            "$SCRIPT_DIR/monitor.sh" "${@:2}"
            ;;
        "update")
            "$SCRIPT_DIR/manage.sh" ssl-update "${@:2}"
            ;;
        "deps")
            "$SCRIPT_DIR/check-dependencies.sh" "${@:2}"
            ;;
        "nginx")
            if [ "$EUID" -eq 0 ]; then
                "$SCRIPT_DIR/nginx-config.sh" "${@:2}"
            else
                echo "Nginx configuration requires root privileges. Use: sudo $0 nginx"
                exit 1
            fi
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_detailed_help
            ;;
        "interactive"|"")
            interactive_mode
            ;;
        *)
            echo "Unknown command: $command"
            echo "Use '$0 help' for available commands or '$0' for interactive mode."
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
