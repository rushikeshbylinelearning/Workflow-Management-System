#!/bin/bash

# Package Backend for Server Deployment
# This script creates a complete backend package ready for upload

echo "📦 Packaging Backend for Server Deployment..."
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend folder not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    cd backend
    npm install
    cd ..
    echo "✅ Dependencies installed!"
    echo ""
fi

# Create timestamp for backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="backend-deploy-${TIMESTAMP}.zip"

echo "📦 Creating deployment package: ${PACKAGE_NAME}"
echo ""

# Create the ZIP file
cd backend
zip -r "../${PACKAGE_NAME}" . \
    -x "*.log" \
    -x "logs/*.log" \
    -x ".git/*" \
    -x "*.zip" \
    -x "*.tar" \
    -x "*.tar.gz"

cd ..

# Check if ZIP was created successfully
if [ -f "${PACKAGE_NAME}" ]; then
    FILE_SIZE=$(du -h "${PACKAGE_NAME}" | cut -f1)
    echo ""
    echo "✅ Package created successfully!"
    echo ""
    echo "📦 Package Details:"
    echo "   File: ${PACKAGE_NAME}"
    echo "   Size: ${FILE_SIZE}"
    echo ""
    echo "📤 Next Steps:"
    echo "   1. Upload ${PACKAGE_NAME} to your server"
    echo "   2. Extract it in /home/legatolx/workflow.bylinelms.com/"
    echo "   3. Restart the Node.js application"
    echo ""
    echo "🔧 Upload Instructions:"
    echo "   - cPanel: File Manager → Upload → Extract"
    echo "   - FTP: Upload and extract on server"
    echo "   - SSH: scp ${PACKAGE_NAME} user@server:/path/"
    echo ""
else
    echo "❌ Error: Failed to create package!"
    exit 1
fi
