#!/bin/bash
# deploy/update-aws.sh
# Deploy latest code changes to AWS EC2 instance

EC2_IP="18.166.29.239"
KEY_FILE="nucash.pem"
REMOTE_DIR="/var/www/nucash"

echo "🚀 Deploying latest changes to AWS EC2: $EC2_IP"

# 1. Connect and pull latest changes
echo "📥 Pulling latest code from GitHub..."
ssh -i "$KEY_FILE" ubuntu@$EC2_IP << 'EOF'
cd /var/www/nucash
git pull origin main
echo "✅ Code pulled successfully"
EOF

# 2. Install new dependencies
echo "📦 Installing new dependencies..."
ssh -i "$KEY_FILE" ubuntu@$EC2_IP << 'EOF'
cd /var/www/nucash/server
npm install
echo "✅ Server dependencies installed"

cd /var/www/nucash/mobile  
npm install
echo "✅ Mobile dependencies installed"
EOF

# 3. Restart the server
echo "🔄 Restarting server with new WebSocket support..."
ssh -i "$KEY_FILE" ubuntu@$EC2_IP << 'EOF'
cd /var/www/nucash/server
pm2 restart nucash-server
echo "✅ Server restarted"
EOF

# 4. Check server status
echo "🔍 Checking server status..."
ssh -i "$KEY_FILE" ubuntu@$EC2_IP << 'EOF'
pm2 status
pm2 logs nucash-server --lines 10
EOF

# 5. Test the WebSocket endpoint
echo "🧪 Testing WebSocket API..."
curl -s http://$EC2_IP:3000/api/websocket/stats | jq . || echo "WebSocket API test failed"

echo "✅ Deployment complete!"
echo "📱 Test real-time updates by:"
echo "   1. Open motorpool admin: http://$EC2_IP:3000/motorpool"
echo "   2. Update a shuttle/route"
echo "   3. Check mobile app for instant updates"
