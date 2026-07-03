#!/bin/bash

# Quick Fix Script for Hosted Environment
# This script will help diagnose and fix the hosted environment issues

echo "=========================================="
echo "WORKFLOW LMS - HOSTED ENVIRONMENT FIX"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
echo "Step 1: Checking directory..."
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Error: server.js not found. Please run this script from the backend directory.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ In correct directory${NC}"
echo ""

# Step 2: Check if .env file exists
echo "Step 2: Checking .env file..."
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ .env file exists${NC}"
echo ""

# Step 3: Display current database configuration
echo "Step 3: Current database configuration:"
echo "----------------------------------------"
grep "DB_" .env | grep -v "^#"
echo ""

# Step 4: Check if Node.js is installed
echo "Step 4: Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"
echo ""

# Step 5: Check if MySQL is running
echo "Step 5: Checking MySQL service..."
if systemctl is-active --quiet mysql; then
    echo -e "${GREEN}✅ MySQL is running${NC}"
elif systemctl is-active --quiet mariadb; then
    echo -e "${GREEN}✅ MariaDB is running${NC}"
else
    echo -e "${YELLOW}⚠️  MySQL/MariaDB service status unknown${NC}"
fi
echo ""

# Step 6: Test database connection
echo "Step 6: Testing database connection..."
DB_HOST=$(grep "^DB_HOST=" .env | cut -d '=' -f2)
DB_USER=$(grep "^DB_USER=" .env | cut -d '=' -f2)
DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d '=' -f2)
DB_NAME=$(grep "^DB_NAME=" .env | cut -d '=' -f2)

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}❌ Database configuration incomplete in .env${NC}"
    exit 1
fi

# Try to connect to MySQL
if command -v mysql &> /dev/null; then
    if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -e "USE $DB_NAME; SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        
        # Count tasks
        TASK_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM tasks;" 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Tasks table accessible. Total tasks: $TASK_COUNT${NC}"
        else
            echo -e "${RED}❌ Cannot access tasks table${NC}"
        fi
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        echo "Please check your database credentials in .env"
    fi
else
    echo -e "${YELLOW}⚠️  MySQL client not found, skipping database test${NC}"
fi
echo ""

# Step 7: Check if backend server is running
echo "Step 7: Checking backend server..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo -e "${GREEN}✅ Backend server is running${NC}"
    echo "Process IDs:"
    pgrep -f "node.*server.js"
    
    # Check if multiple instances are running
    INSTANCE_COUNT=$(pgrep -f "node.*server.js" | wc -l)
    if [ $INSTANCE_COUNT -gt 1 ]; then
        echo -e "${YELLOW}⚠️  WARNING: Multiple backend instances detected ($INSTANCE_COUNT)${NC}"
        echo "This may cause issues. Consider stopping all and starting one instance."
    fi
else
    echo -e "${YELLOW}⚠️  Backend server is not running${NC}"
fi
echo ""

# Step 8: Run diagnostic script
echo "Step 8: Running diagnostic script..."
if [ -f "diagnose-hosted.js" ]; then
    echo "Running: node diagnose-hosted.js"
    echo "----------------------------------------"
    node diagnose-hosted.js
else
    echo -e "${YELLOW}⚠️  diagnose-hosted.js not found, skipping detailed diagnostics${NC}"
fi
echo ""

# Step 9: Recommendations
echo "=========================================="
echo "RECOMMENDATIONS"
echo "=========================================="
echo ""

if pgrep -f "node.*server.js" > /dev/null; then
    INSTANCE_COUNT=$(pgrep -f "node.*server.js" | wc -l)
    if [ $INSTANCE_COUNT -gt 1 ]; then
        echo -e "${YELLOW}1. Stop all backend instances and restart:${NC}"
        echo "   pkill -f 'node.*server.js'"
        echo "   node server.js"
        echo ""
    else
        echo -e "${GREEN}1. Restart the backend server:${NC}"
        echo "   pm2 restart backend"
        echo "   OR"
        echo "   systemctl restart workflow-backend"
        echo ""
    fi
else
    echo -e "${YELLOW}1. Start the backend server:${NC}"
    echo "   node server.js"
    echo "   OR"
    echo "   pm2 start server.js --name backend"
    echo ""
fi

echo "2. Monitor server logs:"
echo "   pm2 logs backend"
echo "   OR"
echo "   tail -f logs/app.log"
echo ""

echo "3. Test the API:"
echo "   curl http://localhost:3005/api/tasks"
echo ""

echo "4. Clear browser cache and test the application"
echo ""

echo "=========================================="
echo "SCRIPT COMPLETE"
echo "=========================================="
