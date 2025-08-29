@echo off
echo ========================================
echo HomeOps Infrastructure Health Check
echo ========================================
echo.

echo [1/2] Running API Tests...
echo ----------------------------------------
cd /d C:\Projects\HomeOps\backend
call npm run test:api
if %errorlevel% neq 0 (
    echo API tests failed!
    exit /b 1
)

echo.
echo [2/2] Running Infrastructure Monitoring...
echo ----------------------------------------
node C:\Projects\HomeOps\scripts\monitor-infrastructure.js
if %errorlevel% neq 0 (
    echo Infrastructure monitoring detected issues!
    exit /b %errorlevel%
)

echo.
echo ========================================
echo Health Check Complete!
echo ========================================