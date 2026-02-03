#!/bin/bash

# AWS Deployment Script for NUCash
# Usage: ./deploy-aws.sh

echo "🚀 Starting AWS deployment..."

# SSH into AWS and deploy
ssh -i "/Users/brylle/Downloads/nucash.pem" ubuntu@18.166.29.239 << 'EOF'
echo "📦 Pulling latest changes..."
cd /var/www/nucash
git pull origin main

echo "📦 Installing dependencies..."
cd server
npm install

echo "🔄 Restarting server..."
pm2 restart nucash-server

echo "✅ Deployment completed!"
echo "📊 Server status:"
pm2 status nucash-server
EOF

echo "🎉 AWS deployment completed!"
