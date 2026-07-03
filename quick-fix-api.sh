#!/bin/bash

echo "=========================================="
echo "  Quick Fix: API JSON Parse Error"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if backend directory exists
if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: backend directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Step 2: Check if backend is running
echo "Step 1: Checking if backend is running..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo -e "${GREEN}✅ Backend is already running${NC}"
    BACKEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Backend is NOT running${NC}"
    BACKEND_RUNNING=false
fi

echo ""

# Step 3: Start backend if not running
if [ "$BACKEND_RUNNING" = false ]; then
    echo "Step 2: Starting backend server..."
    cd backend || exit 1
    
    # Check for PM2
    if command -v pm2 > /dev/null; then
        echo "Using PM2..."
        pm2 stop workflow-backend 2>/dev/null || true
        pm2 delete workflow-backend 2>/dev/null || true
        pm2 start server.js --name workflow-backend --env production
        pm2 save
        echo -e "${GREEN}✅ Backend started with PM2${NC}"
    else
        echo "PM2 not found. Starting with node..."
        pkill -f "node.*server.js" 2>/dev/null || true
        nohup node server.js > logs/server.log 2>&1 &
        echo -e "${GREEN}✅ Backend started (PID: $!)${NC}"
    fi
    
    cd ..
    echo "Waiting 5 seconds for server to initialize..."
    sleep 5
else
    echo "Step 2: Restarting backend to apply any config changes..."
    cd backend || exit 1
    
    if command -v pm2 > /dev/null; then
        pm2 restart workflow-backend
        echo -e "${GREEN}✅ Backend restarted${NC}"
    else
        pkill -f "node.*server.js" 2>/dev/null || true
        nohup node server.js > logs/server.log 2>&1 &
        echo -e "${GREEN}✅ Backend restarted (PID: $!)${NC}"
    fi
    
    cd ..
    sleep 3
fi

echo ""

# Step 4: Test local API
echo "Step 3: Testing local API (http://127.0.0.1:3005/api/health)..."
if command -v curl > /dev/null; then
    RESPONSE=$(curl -s -w "\n%{http_code}" http://127.0.0.1:3005/api/health)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Local API is responding${NC}"
        echo "$BODY" | head -5
    else
        echo -e "${RED}❌ Local API returned HTTP $HTTP_CODE${NC}"
        echo "$BODY"
    fi
else
    echo -e "${YELLOW}⚠️  curl not available, skipping test${NC}"
fi

echo ""

# Step 5: Test public API
echo "Step 4: Testing public API (https://workflow.bylinelms.com/api/health)..."
if command -v curl > /dev/null; then
    RESPONSE=$(curl -s -w "\n%{http_code}" https://workflow.bylinelms.com/api/health)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Public API is responding${NC}"
        echo "$BODY" | head -5
    else
        echo -e "${RED}❌ Public API returned HTTP $HTTP_CODE${NC}"
        echo "This means the Apache proxy is not working correctly"
        echo ""
        echo "Possible fixes:"
        echo "1. Check if mod_proxy is enabled: apachectl -M | grep proxy"
        echo "2. Check Apache error logs: tail -f ~/logs/error_log"
        echo "3. Verify .htaccess proxy rule is correct"
        echo ""
        echo "$BODY" | head -10
    fi
else
    echo -e "${YELLOW}⚠️  curl not available, skipping test${NC}"
fi

echo ""

# Step 6: Show status
echo "=========================================="
echo "  Status Summary"
echo "=========================================="

if command -v pm2 > /dev/null; then
    pm2 status workflow-backend 2>/dev/null || echo "PM2 status not available"
else
    if pgrep -f "node.*server.js" > /dev/null; then
        echo -e "${GREEN}✅ Backend process is running${NC}"
        pgrep -af "node.*server.js"
    else
        echo -e "${RED}❌ Backend process is NOT running${NC}"
    fi
fi

echo ""
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo ""
echo "1. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
echo "2. Try logging in again"
echo "3. If still not working, check the full guide: FIX_JSON_PARSE_ERROR.md"
echo ""
echo "To view backend logs:"
echo "  tail -f backend/logs/app.log"
echo "  tail -f backend/logs/error.log"
echo ""
echo "To view PM2 logs (if using PM2):"
echo "  pm2 logs workflow-backend"
echo ""
echo "=========================================="
