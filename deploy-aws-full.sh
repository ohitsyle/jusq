#!/bin/bash

# Full AWS Deployment Script for NUCash (includes git push and client build)
# Usage: ./deploy-aws-full.sh

set -e  # Exit on any error

echo "🚀 Starting full AWS deployment..."
echo "⏰ $(date)"

# Check if SSH key exists
if [ ! -f "/Users/brylle/Downloads/nucash.pem" ]; then
    echo "❌ SSH key not found at /Users/brylle/Downloads/nucash.pem"
    exit 1
fi

# Step 1: Check for local changes
echo "� Checking for local changes..."
if [[ -n $(git status --porcelain) ]]; then
    echo "📝 Local changes detected:"
    git status --short
    
    echo "💾 Committing local changes..."
    git add .
    
    # Get current timestamp for commit message
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    git commit -m "feat: auto-deploy changes - $TIMESTAMP
    
- Auto-generated deployment commit
- Changes pushed via deploy-aws-full script"
    
    echo "📤 Pushing changes to GitHub..."
    git push origin main
    
    echo "✅ Changes committed and pushed successfully"
else
    echo "✅ No local changes to commit"
fi

echo "🔑 SSH key found, connecting to AWS..."

# Step 2: Deploy to AWS
ssh -i "/Users/brylle/Downloads/nucash.pem" -o StrictHostKeyChecking=no ubuntu@18.166.29.239 << 'EOF'
set -e

echo "📍 Current directory: $(pwd)"
echo "📦 Pulling latest changes from GitHub..."

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

echo "✅ AWS deployment completed successfully!"
EOF

if [ $? -eq 0 ]; then
    echo "🎉 Full deployment completed successfully!"
    echo "🌐 Client has been rebuilt - refresh your browser"
    echo "⏰ $(date)"
else
    echo "❌ Deployment failed!"
    exit 1
fi
