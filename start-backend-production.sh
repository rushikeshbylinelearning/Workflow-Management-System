#!/bin/bash

echo "=== Starting Backend Server in Production Mode ==="

# Navigate to backend directory
cd backend || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
fi

# Check if PM2 is available
if command -v pm2 > /dev/null; then
    echo "✅ Using PM2 to start server..."
    pm2 stop workflow-backend 2>/dev/null || true
    pm2 delete workflow-backend 2>/dev/null || true
    pm2 start server.js --name workflow-backend --env production
    pm2 save
    echo "✅ Backend started with PM2"
    pm2 status
else
    echo "⚠️  PM2 not found. Starting with node..."
    echo "⚠️  Consider installing PM2 for production: npm install -g pm2"
    
    # Kill any existing process on port 3005
    pkill -f "node.*server.js" || true
    
    # Start server in background
    nohup node server.js > logs/server.log 2>&1 &
    echo "✅ Backend started in background (PID: $!)"
    echo "📝 Logs: backend/logs/server.log"
fi

echo ""
echo "Waiting 3 seconds for server to start..."
sleep 3

echo ""
echo "Testing backend health..."
curl -s http://127.0.0.1:3005/api/health || echo "❌ Backend health check failed"

echo ""
echo "=== Backend Startup Complete ==="
