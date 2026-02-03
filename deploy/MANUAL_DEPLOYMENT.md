# Manual AWS Deployment Instructions

## 🚨 Current Issue
The AWS server at `18.166.29.239:3000` is running the old code without WebSocket support. This is why real-time updates aren't working.

## 🔧 Manual Deployment Steps

### 1. Connect to AWS EC2 Instance
```bash
ssh -i "your-key-pair.pem" ubuntu@18.166.29.239
```

### 2. Navigate to App Directory
```bash
cd /var/www/nucash
```

### 3. Pull Latest Changes
```bash
git pull origin main
```

### 4. Install New Dependencies
```bash
cd server
npm install socket.io
cd ../mobile
npm install socket.io-client
```

### 5. Restart Server
```bash
cd server
pm2 restart nucash-server
```

### 6. Verify Deployment
```bash
# Check server logs
pm2 logs nucash-server --lines 20

# Test WebSocket endpoint
curl http://localhost:3000/api/websocket/stats
```

### 7. Test Real-Time Updates
1. Open motorpool admin: `http://18.166.29.239:3000/motorpool`
2. Update a shuttle or route
3. Check mobile app - should update instantly

## 📱 What Should Work After Deployment

### Real-Time Events
- ✅ Shuttle status changes → Instant mobile update
- ✅ Route modifications → Instant mobile update  
- ✅ Driver assignments → Instant mobile update
- ✅ Trip status changes → Instant mobile update

### WebSocket Connection
- ✅ Mobile app connects to `ws://18.166.29.239:3000`
- ✅ Motorpool dashboard connects via WebSocket
- ✅ Automatic change broadcasting

## 🔍 Verification Commands

After deployment, run these to verify:

```bash
# Check WebSocket stats
curl http://18.166.29.239:3000/api/websocket/stats

# Should return something like:
# {
#   "success": true,
#   "stats": {
#     "connectedMobileClients": 0,
#     "connectedMotorpoolClients": 0,
#     "totalConnections": 0
#   }
# }

# Force refresh test
curl -X POST http://18.166.29.239:3000/api/websocket/refresh-mobile \
  -H "Content-Type: application/json" \
  -d '{"dataType": "shuttles"}'
```

## 🚨 Troubleshooting

### If WebSocket API returns "API endpoint not found":
- Server wasn't restarted properly
- Code wasn't pulled correctly
- Dependencies not installed

### If mobile app still doesn't update:
- Check mobile app is using AWS URL: `http://18.166.29.239:3000/api`
- Verify WebSocket connection in mobile app logs
- Check network connectivity

### If server fails to start:
- Check PM2 logs: `pm2 logs nucash-server`
- Verify all dependencies installed
- Check .env file configuration

## 📞 Support

If you encounter issues, check:
1. Server logs: `pm2 logs nucash-server`
2. Git status: `git status` (should be clean)
3. Node version: `node --version` (should be >= 18)
4. PM2 status: `pm2 status`
