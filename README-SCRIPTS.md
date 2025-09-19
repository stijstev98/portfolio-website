# Portfolio Website - Script-Based Management

This portfolio website has been refactored from Docker containers to custom scripts for both development and production environments. This provides greater flexibility, better performance, and easier maintenance.

## 🚀 Quick Start

### Development Mode
```bash
# Check dependencies
./scripts/check-dependencies.sh

# Start development environment
./scripts/portfolio.sh dev

# Or use individual scripts
./scripts/dev.sh          # Start Strapi + Eleventy
./scripts/build-dev.sh    # Build for local testing
./scripts/logs.sh         # View logs
./scripts/stop.sh         # Stop servers
```

### Production Mode
```bash
# Initial setup (run once)
sudo ./scripts/setup-prod.sh

# Start production services
./scripts/start-prod.sh

# Or use the management interface
./scripts/portfolio.sh manage
```

## 📋 Architecture Overview

### Components
- **Strapi CMS** (v5.13.0) - Backend content management
- **Eleventy** - Static site generator
- **Nginx** - Web server and reverse proxy
- **Webhook Server** - Automatic rebuilds on content changes
- **SSL/TLS** - Let's Encrypt certificates for HTTPS

### Data Flow
1. Content is managed in Strapi CMS
2. Eleventy pulls data from Strapi API to build static site
3. Nginx serves static files and proxies admin requests
4. Webhook triggers rebuilds when content changes
5. SSL certificates are automatically renewed

## 🛠 Script Reference

### Core Scripts

#### `./scripts/portfolio.sh`
Main entry point with interactive menu and command dispatcher.

```bash
./scripts/portfolio.sh              # Interactive mode
./scripts/portfolio.sh dev          # Start development
./scripts/portfolio.sh status       # Show status
./scripts/portfolio.sh help         # Show help
```

#### Environment Setup

**`./scripts/env-setup.sh`**
Environment detection and configuration setup.

```bash
./scripts/env-setup.sh dev          # Setup for development
./scripts/env-setup.sh prod         # Setup for production
```

**`./scripts/check-dependencies.sh`**
Validates all system and Node.js dependencies.

```bash
./scripts/check-dependencies.sh     # Check all dependencies
```

### Development Scripts

**`./scripts/dev.sh`**
Starts Strapi and Eleventy in development mode with hot reload.

```bash
./scripts/dev.sh                    # Start development servers
./scripts/dev.sh stop               # Stop development servers
./scripts/dev.sh status             # Check server status
```

**`./scripts/build-dev.sh`**
Builds the site for local testing and preview.

```bash
./scripts/build-dev.sh              # Build site
./scripts/build-dev.sh serve        # Build and serve locally
./scripts/build-dev.sh clean        # Clean build directory
```

**`./scripts/logs.sh`**
View development logs with filtering options.

```bash
./scripts/logs.sh                   # Show all logs
./scripts/logs.sh strapi            # Show only Strapi logs
./scripts/logs.sh eleventy follow   # Follow Eleventy logs
```

**`./scripts/stop.sh`**
Stops all development servers.

```bash
./scripts/stop.sh                   # Stop all servers
```

### Production Scripts

**`./scripts/setup-prod.sh`**
Initial production environment setup (run once as root).

```bash
sudo ./scripts/setup-prod.sh        # Full production setup
```

**`./scripts/start-prod.sh`**
Starts all production services.

```bash
./scripts/start-prod.sh             # Start production services
```

**`./scripts/manage.sh`**
Production service management and monitoring.

```bash
./scripts/manage.sh status          # Show service status
./scripts/manage.sh start           # Start services
./scripts/manage.sh stop            # Stop services
./scripts/manage.sh restart         # Restart services
./scripts/manage.sh logs            # Show logs
./scripts/manage.sh backup          # Create backup
./scripts/manage.sh health          # Health check
```

### Build and Deployment

**`./scripts/build-prod.sh`**
Comprehensive production build pipeline.

```bash
./scripts/build-prod.sh             # Full production build
./scripts/build-prod.sh clean       # Clean build directories
./scripts/build-prod.sh validate    # Validate build environment
```

**`./scripts/webhook-prod.sh`**
Webhook handling and automated rebuilds.

```bash
./scripts/webhook-prod.sh webhook   # Handle webhook (called automatically)
./scripts/webhook-prod.sh rebuild   # Manual rebuild
./scripts/webhook-prod.sh test      # Test webhook functionality
./scripts/webhook-prod.sh status    # Show webhook status
```

### Configuration Management

**`./scripts/nginx-config.sh`**
Nginx configuration management.

```bash
sudo ./scripts/nginx-config.sh setup-prod    # Setup production nginx
sudo ./scripts/nginx-config.sh setup-dev     # Setup development nginx
./scripts/nginx-config.sh test               # Test configuration
./scripts/nginx-config.sh status             # Show nginx status
```

### Maintenance and Monitoring

**`./scripts/backup.sh`**
Comprehensive backup management.

```bash
./scripts/backup.sh                 # Create full backup
./scripts/backup.sh backup database # Backup only database
./scripts/backup.sh list            # List available backups
./scripts/backup.sh restore <file>  # Restore from backup
./scripts/backup.sh cleanup         # Clean old backups
```

**`./scripts/monitor.sh`**
System monitoring and health checks.

```bash
./scripts/monitor.sh check          # Run all health checks
./scripts/monitor.sh system         # Check system resources
./scripts/monitor.sh services       # Check service health
./scripts/monitor.sh ssl            # Check SSL certificates
./scripts/monitor.sh continuous     # Continuous monitoring
./scripts/monitor.sh report         # Generate detailed report
```

## ⚙️ Configuration

### Environment Files

**`config.dev.env`** - Development configuration
```bash
NODE_ENV=development
STRAPI_HOST=127.0.0.1
STRAPI_PORT=1337
ELEVENTY_HOST=127.0.0.1
ELEVENTY_PORT=8080
```

**`config.prod.env`** - Production configuration
```bash
NODE_ENV=production
PRIMARY_DOMAIN=stijnstevens.be
ADMIN_DOMAIN=admin.stijnstevens.be
SSL_ENABLED=true
```

**`.env`** - Active configuration (symlink created automatically)

### Directory Structure
```
portfolio-website/
├── scripts/                 # All management scripts
├── config.dev.env          # Development configuration
├── config.prod.env         # Production configuration
├── .env                    # Active configuration (symlink)
├── nginx-prod/             # Production nginx configs
├── logs/                   # Application logs
├── backups/               # Backup storage
├── .pids/                 # Process ID files
├── portfolio-cms/         # Strapi CMS
├── portfolio-frontend/    # Eleventy frontend
└── webhook/               # Webhook server
```

## 🔧 Development Workflow

### Daily Development
1. Start development environment:
   ```bash
   ./scripts/portfolio.sh dev
   ```

2. Access your sites:
   - Strapi API: http://127.0.0.1:1337/api
   - Strapi Admin: http://127.0.0.1:1337/admin
   - Eleventy Site: http://127.0.0.1:8080

3. View logs:
   ```bash
   ./scripts/logs.sh
   ```

4. Stop when done:
   ```bash
   ./scripts/stop.sh
   ```

### Testing Builds
```bash
# Build for testing
./scripts/build-dev.sh

# Build and serve locally
./scripts/build-dev.sh serve

# Clean build files
./scripts/build-dev.sh clean
```

## 🚀 Production Deployment

### Initial Setup
1. **System Setup** (run once):
   ```bash
   sudo ./scripts/setup-prod.sh
   ```

2. **Configure Environment**:
   ```bash
   # Edit production configuration
   nano config.prod.env
   
   # Set up environment
   ./scripts/env-setup.sh prod
   ```

3. **Setup SSL Certificates**:
   ```bash
   # If you have existing certificates, they'll be detected
   # Otherwise, obtain new certificates:
   sudo certbot --nginx -d yourdomain.com -d admin.yourdomain.com
   ```

### Deployment
```bash
# Start production services
./scripts/start-prod.sh

# Check status
./scripts/manage.sh status

# View logs
./scripts/manage.sh logs
```

### Ongoing Management
```bash
# Monitor system health
./scripts/monitor.sh check

# Create backups
./scripts/backup.sh

# Update SSL certificates
./scripts/manage.sh ssl-update
```

## 🔍 Monitoring and Maintenance

### Health Monitoring
The monitoring system checks:
- System resources (CPU, memory, disk)
- Service health (Strapi, webhook, nginx)
- Database integrity
- SSL certificate validity
- Website accessibility
- Log file analysis
- Performance metrics

### Automatic Tasks
- **SSL Renewal**: Certificates are renewed automatically
- **Log Rotation**: Logs are rotated to prevent disk overflow
- **Backup Cleanup**: Old backups are removed automatically
- **Health Checks**: Continuous monitoring available

### Backup Strategy
- **Full Backups**: Database, uploads, configuration, SSL certificates
- **Incremental**: Database and configuration only
- **Retention**: 30 days (configurable)
- **Compression**: Automatic with tar.gz
- **Restoration**: One-command restore process

## 🆘 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check dependencies
./scripts/check-dependencies.sh

# Check logs
./scripts/logs.sh

# Check system resources
./scripts/monitor.sh system
```

**Build failures:**
```bash
# Validate environment
./scripts/build-prod.sh validate

# Check Strapi connectivity
curl http://127.0.0.1:1337/api

# Clean and rebuild
./scripts/build-dev.sh clean
./scripts/build-dev.sh
```

**SSL issues:**
```bash
# Check certificate status
./scripts/monitor.sh ssl

# Renew certificates
sudo ./scripts/manage.sh ssl-update

# Test nginx configuration
sudo ./scripts/nginx-config.sh test
```

### Log Locations
- **Development**: `./logs/`
- **Production**: `./logs/` and `/var/log/nginx/`
- **System**: `/var/log/` (systemd journals)

### Getting Help
```bash
# Interactive help menu
./scripts/portfolio.sh

# Detailed help
./scripts/portfolio.sh help

# Script-specific help
./scripts/<script-name>.sh --help
```

## 🔄 Migration from Docker

If migrating from the Docker setup:

1. **Stop Docker containers**:
   ```bash
   docker-compose down
   ```

2. **Backup existing data**:
   ```bash
   cp -r strapi-data ./backups/
   cp -r nginx/certbot ./backups/
   ```

3. **Run dependency check**:
   ```bash
   ./scripts/check-dependencies.sh
   ```

4. **Start with development**:
   ```bash
   ./scripts/portfolio.sh dev
   ```

5. **For production, run setup**:
   ```bash
   sudo ./scripts/setup-prod.sh
   ```

The scripts will automatically detect and use existing data files and SSL certificates.
