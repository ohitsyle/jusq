#!/bin/bash

# AWS EC2 Setup Script for NUCash
# Run this after SSH into your EC2 instance

echo "🚀 Setting up NUCash on AWS EC2..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Create app directory
sudo mkdir -p /var/www/nucash
sudo chown ubuntu:ubuntu /var/www/nucash
cd /var/www/nucash

# Clone repository (replace with your repo URL)
git clone https://github.com/ohitsyle/jusq.git .

# Install server dependencies
cd server
npm install

# Create .env file (you'll need to edit this)
cat > .env << EOF
MONGODB_URI=your_mongodb_atlas_connection_string_here
PORT=3000
JWT_SECRET=your_jwt_secret_here
NODE_ENV=production
AWS_REGION=ap-east-1
EOF

echo "✅ Setup complete!"
echo "📝 Edit /var/www/nucash/server/.env with your MongoDB connection"
echo "🚀 Start server with: pm2 start server.js --name nucash-server"
