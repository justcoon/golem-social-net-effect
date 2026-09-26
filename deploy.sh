#!/bin/bash

# Golem Social Net Deployment Script
# This script loads environment variables from .env and deploys Golem application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    echo "Please create .env file from .env.example:"
    echo "  cp .env.example .env"
    echo "Then edit .env with your configuration"
    exit 1
fi

print_status "Loading and exporting environment variables from .env..."

# Create a temporary file with substituted variables
temp_env=$(mktemp)
if [ -f ".env" ]; then
    # Substitute variables and export them
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ $line =~ ^[[:space:]]*# ]] && continue
        [[ -z "$line" ]] && continue
        
        # Substitute variables in the line
        substituted_line=$(eval echo "\"$line\"")
        
        # Export the substituted variable
        export "$substituted_line"
        echo "$substituted_line" >> "$temp_env"
    done < .env
    
    print_success "Environment variables loaded and substituted"
else
    print_error "Failed to load .env file"
    exit 1
fi

# Show deployment configuration
print_status "Deployment configuration:"
echo "  OTLP Endpoint: ${OTLP_ENDPOINT:-http://localhost:4318}"

# Check if Golem server is running
print_status "Checking Golem server status..."

if command -v golem &> /dev/null; then
    if curl -sf http://localhost:9881/healthcheck &> /dev/null || golem component list &> /dev/null; then
        print_success "Golem server is running"
    else
        print_warning "Golem server may not be running"
        echo "Start it with: golem server run"
        echo ""
        read -p "Continue with deployment anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
else
    print_error "Golem CLI not found!"
    echo "Please install Golem CLI from: https://github.com/golemcloud/golem/releases"
    exit 1
fi

# Deploy the application
print_status "Starting deployment..."

# Pass any additional arguments to golem deploy
# Environment variables are now exported and available
if golem deploy "$@"; then
    print_success "Deployment completed successfully!"
    echo ""
    echo "Your Social Net API is now available at:"
    echo "  http://localhost:9006"
    echo ""
    echo "Observability dashboards:"
    echo "  Jaeger:     http://localhost:${JAEGER_PORT:-16686}"
    echo "  Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
    echo "  Grafana:    http://localhost:${GRAFANA_PORT:-3000}"
else
    print_error "Deployment failed!"
    echo ""
    echo "Check the following:"
    echo "  1. All environment variables are correctly set in .env"
    echo "  2. Golem server is running: golem server run"
    echo "  3. Components are built: golem build"
    echo "  4. No syntax errors in golem.yaml"
    exit 1
fi
