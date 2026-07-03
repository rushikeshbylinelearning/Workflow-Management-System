@echo off
echo ==========================================
echo   Quick Fix: API JSON Parse Error
echo ==========================================
echo.

echo This script is for Windows development only.
echo For production server, use: quick-fix-api.sh
echo.

echo Checking if backend is running locally...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Node.js is running
) else (
    echo [WARNING] Node.js is not running
)

echo.
echo Starting backend server...
cd backend
start /B node server.js
echo Backend started in background
cd ..

echo.
echo Waiting 5 seconds for server to start...
timeout /t 5 /nobreak >nul

echo.
echo Testing local API...
curl -s http://127.0.0.1:3005/api/health 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Local API is responding
) else (
    echo [ERROR] Local API is not responding
    echo Make sure backend is running: cd backend ^&^& node server.js
)

echo.
echo ==========================================
echo   Next Steps
echo ==========================================
echo.
echo 1. Clear browser cache (Ctrl+Shift+R)
echo 2. Try logging in again
echo 3. Check full guide: FIX_JSON_PARSE_ERROR.md
echo.
echo To view backend logs:
echo   type backend\logs\app.log
echo   type backend\logs\error.log
echo.
echo ==========================================
pause
