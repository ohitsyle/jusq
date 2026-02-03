#!/bin/bash

# Full AWS Deployment Script for NUCash (includes client build)
# Usage: ./deploy-aws-full.sh

set -e  # Exit on any error

echo "🚀 Starting full AWS deployment..."
echo "⏰ $(date)"

# Check if SSH key exists
if [ ! -f "/Users/brylle/Downloads/nucash.pem" ]; then
    echo "❌ SSH key not found at /Users/brylle/Downloads/nucash.pem"
    exit 1
fi

echo "🔑 SSH key found, connecting to AWS..."

# SSH into AWS and deploy with client build
ssh -i "/Users/brylle/Downloads/nucash.pem" -o StrictHostKeyChecking=no ubuntu@18.166.29.239 << 'EOF'
set -e

echo "📍 Current directory: $(pwd)"
echo "📦 Pulling latest changes..."

cd /var/www/nucash
git pull origin main

echo "🏗️ Building client..."
cd client
npm run build

echo "📦 Installing server dependencies..."
cd ../server
npm install

echo "🔄 Restarting server..."
pm2 restart nucash-server

echo "⏳ Waiting for server to start..."
sleep 5

echo "📊 Server status:"
pm2 status nucash-server

echo "✅ Full deployment completed successfully!"
EOF

if [ $? -eq 0 ]; then
    echo "🎉 AWS deployment completed successfully!"
    echo "🌐 Client has been rebuilt - refresh your browser"
    echo "⏰ $(date)"
else
    echo "❌ Deployment failed!"
    exit 1
fi
