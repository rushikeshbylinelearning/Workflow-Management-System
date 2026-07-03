@echo off
REM Production Deployment Script for workflow.bylinelms.com (Windows)
REM This script builds the frontend and prepares files for deployment

echo.
echo 🚀 Starting deployment preparation for workflow.bylinelms.com...
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root.
    exit /b 1
)

REM Step 1: Clean previous build
echo 🧹 Cleaning previous build...
if exist "dist" rmdir /s /q dist
echo ✅ Clean complete
echo.

REM Step 2: Install frontend dependencies
echo 📦 Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Frontend dependency installation failed
    exit /b 1
)
echo ✅ Frontend dependencies installed
echo.

REM Step 3: Build frontend
echo 🔨 Building frontend for production...
call npm run build
if errorlevel 1 (
    echo ❌ Frontend build failed
    exit /b 1
)
echo ✅ Frontend build complete
echo.

REM Step 4: Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install --production
if errorlevel 1 (
    echo ❌ Backend dependency installation failed
    exit /b 1
)
cd ..
echo ✅ Backend dependencies installed
echo.

REM Step 5: Create deployment package
echo 📦 Creating deployment package...
if exist "deployment_package" rmdir /s /q deployment_package
mkdir deployment_package
xcopy /E /I /Y dist deployment_package
copy /Y .htaccess deployment_package\
xcopy /E /I /Y backend deployment_package\backend
echo ✅ Deployment package created in .\deployment_package\
echo.

REM Step 6: Display next steps
echo ✅ Deployment preparation complete!
echo.
echo 📋 Next Steps:
echo 1. Upload contents of 'deployment_package\' to your server
echo 2. Frontend files → /public_html/
echo 3. Backend folder → /backend/ (or outside public_html)
echo 4. Configure Node.js app in cPanel
echo 5. Setup database and run migrations
echo 6. Install SSL certificate
echo.
echo 📖 See PRODUCTION_DEPLOYMENT_GUIDE.md for detailed instructions
echo.
echo 🎉 Ready to deploy to workflow.bylinelms.com!
echo.
pause
