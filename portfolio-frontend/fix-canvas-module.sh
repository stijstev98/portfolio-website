#!/bin/bash

# Navigate to project directory - helpful if running this script from elsewhere
cd "$(dirname "$0")"

echo "Fixing canvas module for Apple Silicon..."

# Uninstall current canvas module
npm uninstall canvas

# Clean npm cache
npm cache clean --force

# Ensure node-pre-gyp is installed (needed for native module compilation)
npm install -g node-pre-gyp

# Reinstall canvas with correct architecture
npm install canvas --target_arch=arm64

echo "Canvas module fixed. Please restart your development server."
