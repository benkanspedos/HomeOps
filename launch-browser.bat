@echo off
REM One-click launcher for regular browser (no VPN)
title HomeOps Browser Launcher

echo ============================================
echo    HomeOps Browser (Direct Connection)
echo ============================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start the browser container
echo [1/3] Starting browser container...
docker-compose -f docker-compose.browser.yml up -d browser-direct

REM Wait for container to be ready
echo [2/3] Waiting for browser to initialize...
:wait_loop
timeout /t 2 /nobreak >nul
docker ps -q -f name=homeops-browser-direct -f status=running >nul 2>&1
if errorlevel 1 goto wait_loop

REM Additional wait for VNC to be ready
timeout /t 3 /nobreak >nul

REM Open browser
echo [3/3] Opening browser interface...
echo.
echo ============================================
echo    Browser is ready!
echo    URL: http://localhost:6081/vnc.html
echo    Password: homeops
echo    
echo    Direct connection (no VPN)
echo ============================================
echo.

REM Open in default browser
start http://localhost:6081/vnc.html

echo Browser launched successfully!
echo You can close this window.
timeout /t 5 /nobreak >nul