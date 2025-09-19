#!/bin/bash
set -e

# Portfolio Website Production Setup Script
# Sets up system dependencies and configuration for production deployment

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

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        echo "Usage: sudo $0"
        exit 1
    fi
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            echo "debian"
        elif [ -f /etc/redhat-release ]; then
            echo "redhat"
        else
            echo "linux"
        fi
    else
        echo "unknown"
    fi
}

# Install system dependencies
install_system_deps() {
    local os_type
    os_type=$(detect_os)
    
    log_info "Installing system dependencies for $os_type..."
    
    case "$os_type" in
        "debian")
            apt-get update
            apt-get install -y \
                curl \
                nginx \
                sqlite3 \
                poppler-utils \
                libvips-dev \
                libcairo2-dev \
                libpango1.0-dev \
                libjpeg-dev \
                libgif-dev \
                librsvg2-dev \
                pkg-config \
                build-essential \
                certbot \
                python3-certbot-nginx
            ;;
        "redhat")
            dnf update -y
            dnf install -y \
                curl \
                nginx \
                sqlite \
                poppler-utils \
                vips-devel \
                cairo-devel \
                pango-devel \
                libjpeg-turbo-devel \
                giflib-devel \
                librsvg2-devel \
                pkgconfig \
                gcc-c++ \
                make \
                certbot \
                python3-certbot-nginx
            ;;
        "macos")
            if ! command -v brew >/dev/null 2>&1; then
                log_error "Homebrew is required for macOS setup"
                echo "Install Homebrew first: https://brew.sh/"
                exit 1
            fi
            
            brew install \
                nginx \
                sqlite \
                poppler \
                vips \
                pkg-config \
                cairo \
                pango \
                libpng \
                jpeg \
                giflib \
                librsvg
            
            # Install certbot for macOS
            brew install certbot
            ;;
        *)
            log_error "Unsupported operating system: $os_type"
            log_info "Please install the following packages manually:"
            echo "- nginx"
            echo "- sqlite3"
            echo "- poppler-utils"
            echo "- libvips-dev"
            echo "- cairo and pango development libraries"
            echo "- certbot"
            exit 1
            ;;
    esac
    
    log_success "System dependencies installed"
}

# Install Node.js if not present
install_nodejs() {
    if command -v node >/dev/null 2>&1; then
        local node_version
        node_version=$(node --version | sed 's/v//')
        local major_version
        major_version=$(echo "$node_version" | cut -d. -f1)
        
        if [ "$major_version" -ge 18 ]; then
            log_success "Node.js $node_version is already installed"
            return 0
        else
            log_warning "Node.js $node_version is too old, installing Node.js 18+"
        fi
    fi
    
    log_info "Installing Node.js..."
    
    # Install Node.js via NodeSource repository
    if [[ $(detect_os) == "debian" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [[ $(detect_os) == "redhat" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        dnf install -y nodejs
    elif [[ $(detect_os) == "macos" ]]; then
        brew install node@18
        brew link --force node@18
    else
        log_error "Unable to install Node.js automatically for this OS"
        echo "Please install Node.js 18+ manually from https://nodejs.org/"
        exit 1
    fi
    
    log_success "Node.js installed"
}

# Create service user
create_service_user() {
    local username="portfolio"
    
    if id "$username" &>/dev/null; then
        log_info "User '$username' already exists"
        return 0
    fi
    
    log_info "Creating service user '$username'..."
    
    if [[ $(detect_os) == "macos" ]]; then
        # macOS user creation is more complex, skip for now
        log_warning "Skipping user creation on macOS. Run as current user."
        return 0
    fi
    
    # Create system user for the service
    useradd --system --shell /bin/bash --home /var/lib/portfolio --create-home "$username"
    
    # Add user to necessary groups
    usermod -a -G www-data "$username" 2>/dev/null || true
    
    log_success "Service user '$username' created"
}

# Setup directories and permissions
setup_directories() {
    local username="portfolio"
    local app_dir="/var/www/portfolio"
    
    log_info "Setting up directories..."
    
    # Create application directory
    mkdir -p "$app_dir"
    mkdir -p "$app_dir/logs"
    mkdir -p "$app_dir/backups"
    mkdir -p "$app_dir/ssl"
    
    # Create nginx directories
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    
    # Set ownership
    if id "$username" &>/dev/null; then
        chown -R "$username:www-data" "$app_dir"
        chmod -R 755 "$app_dir"
    fi
    
    # Create log directory
    mkdir -p /var/log/portfolio
    if id "$username" &>/dev/null; then
        chown "$username:www-data" /var/log/portfolio
    fi
    
    log_success "Directories created"
}

# Setup nginx
setup_nginx() {
    log_info "Setting up nginx..."
    
    # Backup original nginx config if it exists
    if [ -f /etc/nginx/nginx.conf ]; then
        cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    fi
    
    # Enable nginx
    if command -v systemctl >/dev/null 2>&1; then
        systemctl enable nginx
    elif [[ $(detect_os) == "macos" ]]; then
        # macOS with Homebrew
        brew services start nginx
    fi
    
    log_success "Nginx configured"
}

# Setup SSL with Let's Encrypt (if certificates don't exist)
setup_ssl() {
    local domains=("stijnstevens.be" "admin.stijnstevens.be")
    local existing_certs=true
    
    log_info "Checking SSL certificates..."
    
    # Check if certificates already exist
    for domain in "${domains[@]}"; do
        local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
        if [ ! -f "$cert_path" ]; then
            existing_certs=false
            break
        fi
    done
    
    if [ "$existing_certs" = "true" ]; then
        log_success "SSL certificates already exist"
        
        # Copy existing certificates to project location
        local project_cert_dir="$PROJECT_ROOT/nginx/certbot/conf"
        if [ -d "$project_cert_dir" ]; then
            log_info "Copying existing certificates to project..."
            cp -r /etc/letsencrypt/* "$project_cert_dir/"
            log_success "Certificates copied to project"
        fi
        
        return 0
    fi
    
    log_warning "SSL certificates not found"
    echo "You need to obtain SSL certificates for:"
    for domain in "${domains[@]}"; do
        echo "  - $domain"
    done
    echo
    echo "Options:"
    echo "1. Use existing certificates (copy them to /etc/letsencrypt/)"
    echo "2. Obtain new certificates with certbot:"
    echo "   sudo certbot --nginx -d stijnstevens.be -d admin.stijnstevens.be"
    echo "3. Set up certificates manually"
    echo
    log_info "Continuing setup without SSL certificates..."
}

# Install Node.js dependencies
install_node_deps() {
    log_info "Installing Node.js dependencies..."
    
    # Install dependencies for each component
    local components=("portfolio-cms" "portfolio-frontend" "webhook")
    
    for component in "${components[@]}"; do
        local component_dir="$PROJECT_ROOT/$component"
        if [ -d "$component_dir" ]; then
            log_info "Installing dependencies for $component..."
            cd "$component_dir"
            npm install --production
            cd "$PROJECT_ROOT"
        fi
    done
    
    log_success "Node.js dependencies installed"
}

# Create systemd service files
create_systemd_services() {
    if ! command -v systemctl >/dev/null 2>&1; then
        log_warning "systemctl not available, skipping service creation"
        return 0
    fi
    
    log_info "Creating systemd service files..."
    
    local username="portfolio"
    local app_dir="/var/www/portfolio"
    
    # Strapi service
    cat > /etc/systemd/system/portfolio-strapi.service << EOF
[Unit]
Description=Portfolio Strapi CMS
After=network.target

[Service]
Type=simple
User=$username
WorkingDirectory=$app_dir/portfolio-cms
Environment=NODE_ENV=production
Environment=DATABASE_CLIENT=sqlite
Environment=DATABASE_FILENAME=$app_dir/strapi-data/strapi.db
Environment=STRAPI_TELEMETRY_DISABLED=true
ExecStart=/usr/bin/node node_modules/@strapi/strapi/bin/strapi.js start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Webhook service
    cat > /etc/systemd/system/portfolio-webhook.service << EOF
[Unit]
Description=Portfolio Webhook Handler
After=network.target portfolio-strapi.service

[Service]
Type=simple
User=$username
WorkingDirectory=$app_dir/webhook
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    systemctl daemon-reload
    
    # Enable services
    systemctl enable portfolio-strapi
    systemctl enable portfolio-webhook
    
    log_success "Systemd services created"
}

# Create cron jobs for maintenance
setup_cron_jobs() {
    log_info "Setting up maintenance cron jobs..."
    
    local username="portfolio"
    local app_dir="/var/www/portfolio"
    
    # Create cron job for SSL renewal
    (crontab -u root -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -u root -
    
    # Create cron job for backups (if service user exists)
    if id "$username" &>/dev/null; then
        (crontab -u "$username" -l 2>/dev/null; echo "0 2 * * * $app_dir/scripts/backup.sh") | crontab -u "$username" -
    fi
    
    log_success "Cron jobs configured"
}

# Main setup function
main() {
    log_info "=== Portfolio Website Production Setup ==="
    
    # Check prerequisites
    check_root
    
    # Install system dependencies
    install_system_deps
    install_nodejs
    
    # Setup users and directories
    create_service_user
    setup_directories
    
    # Setup web server and SSL
    setup_nginx
    setup_ssl
    
    # Install application dependencies
    install_node_deps
    
    # Setup services
    create_systemd_services
    setup_cron_jobs
    
    log_success "=== Production Setup Complete ==="
    echo
    echo "Next steps:"
    echo "1. Copy your project files to the production server"
    echo "2. Update configuration in config.prod.env"
    echo "3. Setup SSL certificates if not already done"
    echo "4. Run ./scripts/start-prod.sh to start the application"
    echo "5. Configure DNS to point to this server"
    echo
    echo "Service management:"
    echo "  Start:   sudo systemctl start portfolio-strapi portfolio-webhook"
    echo "  Stop:    sudo systemctl stop portfolio-strapi portfolio-webhook" 
    echo "  Status:  sudo systemctl status portfolio-strapi portfolio-webhook"
    echo "  Logs:    sudo journalctl -u portfolio-strapi -f"
    echo
}

# Run main function
main "$@"
