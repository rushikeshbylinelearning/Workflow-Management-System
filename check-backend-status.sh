#!/bin/bash

echo "=== Backend Status Check ==="
echo ""

# Check if Node.js process is running
echo "1. Checking if Node.js backend is running..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Backend process is running"
    pgrep -af "node.*server.js"
else
    echo "❌ Backend process is NOT running"
fi

echo ""
echo "2. Checking port 3005..."
if netstat -tuln 2>/dev/null | grep -q ":3005 "; then
    echo "✅ Port 3005 is listening"
    netstat -tuln | grep ":3005 "
elif ss -tuln 2>/dev/null | grep -q ":3005 "; then
    echo "✅ Port 3005 is listening"
    ss -tuln | grep ":3005 "
else
    echo "❌ Port 3005 is NOT listening"
fi

echo ""
echo "3. Testing API health endpoint..."
if command -v curl > /dev/null; then
    echo "Testing: http://127.0.0.1:3005/api/health"
    curl -s http://127.0.0.1:3005/api/health | head -20
else
    echo "⚠️  curl not available"
fi

echo ""
echo "4. Testing public API endpoint..."
if command -v curl > /dev/null; then
    echo "Testing: https://workflow.bylinelms.com/api/health"
    curl -s https://workflow.bylinelms.com/api/health | head -20
else
    echo "⚠️  curl not available"
fi

echo ""
echo "=== End of Status Check ==="
