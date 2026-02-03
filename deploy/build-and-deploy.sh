#!/bin/bash

# Build and Deploy Script for NUCash Frontends
echo "🏗️ Building and deploying NUCash frontends..."

# Build client applications
echo "📦 Building React apps..."
cd client
npm run build

echo "✅ Build complete!"
echo "📤 Now manually upload build/ folder to S3 buckets"
echo ""
echo "S3 Buckets to create:"
echo "- nucash-admin (for admin dashboard)"
echo "- nucash-merchant (for merchant dashboard)" 
echo "- nucash-motorpool (for motorpool dashboard)"
echo ""
echo "After uploading to S3, create CloudFront distributions."
