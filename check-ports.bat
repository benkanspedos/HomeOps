@echo off
echo ================================
echo 📊 HomeOps Port Status Check
echo ================================
echo.

echo 🔍 Checking port 3000 (Frontend)...
netstat -an | findstr ":3000 " >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Port 3000: ACTIVE
) else (
    echo ⚪ Port 3000: FREE
)

echo.
echo 🔍 Checking port 3101 (Backend API)...
netstat -an | findstr ":3101 " >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Port 3101: ACTIVE
) else (
    echo ⚪ Port 3101: FREE
)

echo.
echo 🔍 Checking conflicting port 3001...
netstat -an | findstr ":3001 " >nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠️ Port 3001: OCCUPIED (This was the conflicting port!)
) else (
    echo ⚪ Port 3001: FREE
)

echo.
echo 📋 All HomeOps ports checked!