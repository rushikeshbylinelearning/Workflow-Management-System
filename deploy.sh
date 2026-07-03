#!/bin/bash

# Production Deployment Script for workflow.bylinelms.com
# This script builds the frontend and prepares files for deployment

echo "🚀 Starting deployment preparation for workflow.bylinelms.com..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/
echo "✅ Clean complete"
echo ""

# Step 2: Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend dependency installation failed"
    exit 1
fi
echo "✅ Frontend dependencies installed"
echo ""

# Step 3: Build frontend
echo "🔨 Building frontend for production..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi
echo "✅ Frontend build complete"
echo ""

# Step 4: Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --production
if [ $? -ne 0 ]; then
    echo "❌ Backend dependency installation failed"
    exit 1
fi
cd ..
echo "✅ Backend dependencies installed"
echo ""

# Step 5: Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deployment_package
cp -r dist/* deployment_package/
cp .htaccess deployment_package/
cp -r backend deployment_package/
echo "✅ Deployment package created in ./deployment_package/"
echo ""

# Step 6: Display next steps
echo "✅ Deployment preparation complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Upload contents of 'deployment_package/' to your server"
echo "2. Frontend files → /public_html/"
echo "3. Backend folder → /backend/ (or outside public_html)"
echo "4. Configure Node.js app in cPanel"
echo "5. Setup database and run migrations"
echo "6. Install SSL certificate"
echo ""
echo "📖 See PRODUCTION_DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
echo "🎉 Ready to deploy to workflow.bylinelms.com!"
