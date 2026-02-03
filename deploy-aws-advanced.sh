#!/bin/bash

# Advanced AWS Deployment Script for NUCash
# Usage: ./deploy-aws-advanced.sh

set -e  # Exit on any error

echo "🚀 Starting AWS deployment..."
echo "⏰ $(date)"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if SSH key exists
if [ ! -f "/Users/brylle/Downloads/nucash.pem" ]; then
    echo "❌ SSH key not found at /Users/brylle/Downloads/nucash.pem"
    exit 1
fi

echo "🔑 SSH key found, connecting to AWS..."

# SSH into AWS and deploy with error handling
ssh -i "/Users/brylle/Downloads/nucash.pem" -o StrictHostKeyChecking=no ubuntu@18.166.29.239 << 'EOF'
set -e

echo "📍 Current directory: $(pwd)"
echo "📦 Pulling latest changes..."

cd /var/www/nucash
git pull origin main

echo "📦 Installing dependencies..."
cd server
npm install

echo "🔄 Restarting server..."
pm2 restart nucash-server

echo "⏳ Waiting for server to start..."
sleep 3

echo "📊 Server status:"
pm2 status nucash-server

echo "📋 Recent logs:"
pm2 logs nucash-server --lines 5

echo "✅ Deployment completed successfully!"
EOF

if [ $? -eq 0 ]; then
    echo "🎉 AWS deployment completed successfully!"
    echo "⏰ $(date)"
else
    echo "❌ Deployment failed!"
    exit 1
fi
