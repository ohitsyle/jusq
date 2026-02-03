#!/bin/bash
# Fix syntax error in admin.js

echo "🔧 Fixing syntax error in admin.js..."

# Remove any double commas
sed -i "s/},,}/},}/g" /var/www/nucash/server/routes/admin.js

# Fix the specific line
sed -i "s/{ eventType: 'admin_action', 'metadata.adminId': 'motorpool' },,/{ eventType: 'admin_action', 'metadata.adminId': 'motorpool' },/" /var/www/nucash/server/routes/admin.js

echo "✅ Syntax error fixed!"
echo "🚀 Starting server..."

cd /var/www/nucash/server
node server.js
