#!/bin/bash

# Quick update script for NUCash deployment
echo "🚀 Updating NUCash application..."

# Step 1: Commit and push changes
echo "📤 Pushing changes to GitHub..."
git add .
git commit -m "$1" || echo "No changes to commit"
git push origin main

# Step 2: Update EC2 server
echo "🔄 Updating EC2 server..."
ssh -i "/Users/brylle/Downloads/nucash.pem" ubuntu@54.251.11.39 << 'EOF'
cd /var/www/nucash
git pull origin main
cd server
pm2 restart nucash-server
echo "✅ Server updated and restarted"
EOF

echo "🎉 Update complete! Clear browser cache and test."
