#!/bin/bash

# Production Build Script for Planning Poker
# This script builds the application for production deployment

set -e  # Exit on any error

echo "🚀 Starting production build..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf client/build
rm -rf logs/*.log 2>/dev/null || true

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install --only=production

# Install frontend dependencies and build
if [ -d "client" ]; then
    echo "📦 Installing frontend dependencies..."
    cd client
    npm install
    
    echo "🏗️  Building frontend for production..."
    npm run build
    
    echo "✅ Frontend build completed"
    cd ..
else
    echo "⚠️  Warning: client directory not found, skipping frontend build"
fi

# Run production readiness check
echo "🔍 Running production readiness check..."
if [ -f "scripts/production-check.js" ]; then
    node scripts/production-check.js
else
    echo "⚠️  Warning: production-check.js not found, skipping checks"
fi

echo "🎉 Production build completed successfully!"
echo ""
echo "🚀 Ready to deploy! You can now:"
echo "   - Run 'npm run start:prod' to start in production mode"
echo "   - Use 'docker-compose up' to deploy with Docker"
echo "   - Deploy the built application to your production server" 