#!/bin/bash

# Workflow Backend Startup Script
# This script starts the Node.js backend server using PM2

echo "🚀 Starting Workflow Backend Server..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Stop existing instance if running
pm2 stop workflow-backend 2>/dev/null || true
pm2 delete workflow-backend 2>/dev/null || true

# Start the server using PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Display status
pm2 status

echo "✅ Backend server started successfully!"
echo "📊 View logs: pm2 logs workflow-backend"
echo "📈 Monitor: pm2 monit"
echo "🔄 Restart: pm2 restart workflow-backend"
echo "🛑 Stop: pm2 stop workflow-backend"
