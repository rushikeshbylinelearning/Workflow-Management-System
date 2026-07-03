@echo off
REM Package Backend for Server Deployment (Windows)
REM This script creates a complete backend package ready for upload

echo.
echo 📦 Packaging Backend for Server Deployment...
echo.

REM Check if we're in the right directory
if not exist "backend" (
    echo ❌ Error: backend folder not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "backend\node_modules" (
    echo ⚠️  node_modules not found. Installing dependencies...
    cd backend
    call npm install
    cd ..
    echo ✅ Dependencies installed!
    echo.
)

REM Create timestamp for backup
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set PACKAGE_NAME=backend-deploy-%TIMESTAMP%.zip

echo 📦 Creating deployment package: %PACKAGE_NAME%
echo.

REM Check if 7-Zip is installed
where 7z >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    REM Use 7-Zip if available
    7z a -tzip "%PACKAGE_NAME%" ".\backend\*" -xr!*.log -xr!logs\*.log -xr!.git -xr!*.zip -xr!*.tar -xr!*.tar.gz
) else (
    REM Use PowerShell as fallback
    echo Using PowerShell to create ZIP...
    powershell -Command "Compress-Archive -Path 'backend\*' -DestinationPath '%PACKAGE_NAME%' -Force"
)

REM Check if ZIP was created successfully
if exist "%PACKAGE_NAME%" (
    echo.
    echo ✅ Package created successfully!
    echo.
    echo 📦 Package Details:
    echo    File: %PACKAGE_NAME%
    echo.
    echo 📤 Next Steps:
    echo    1. Upload %PACKAGE_NAME% to your server
    echo    2. Extract it in /home/legatolx/workflow.bylinelms.com/
    echo    3. Restart the Node.js application
    echo.
    echo 🔧 Upload Instructions:
    echo    - cPanel: File Manager → Upload → Extract
    echo    - FTP: Upload and extract on server
    echo.
) else (
    echo ❌ Error: Failed to create package!
    pause
    exit /b 1
)

pause
