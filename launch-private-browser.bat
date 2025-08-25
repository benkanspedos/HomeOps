@echo off
REM One-click launcher for private browser (with VPN)
title HomeOps Private Browser Launcher

echo ============================================
echo    HomeOps Private Browser (VPN Protected)
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

REM Check if VPN container exists and start if needed
echo [1/4] Checking VPN status...
docker ps -q -f name=homeops-gluetun >nul 2>&1
if errorlevel 1 (
    echo Starting VPN service...
    docker-compose -f docker-compose.yml up -d gluetun
    echo Waiting for VPN to connect...
    timeout /t 10 /nobreak >nul
)

REM Start the browser container
echo [2/4] Starting private browser container...
docker-compose -f docker-compose.browser.yml up -d comet-browser

REM Wait for container to be ready
echo [3/4] Waiting for browser to initialize...
:wait_loop
timeout /t 2 /nobreak >nul
docker ps -q -f name=homeops-comet-browser -f status=running >nul 2>&1
if errorlevel 1 goto wait_loop

REM Additional wait for VNC to be ready
timeout /t 3 /nobreak >nul

REM Open browser
echo [4/4] Opening browser interface...
echo.
echo ============================================
echo    Browser is ready!
echo    URL: http://localhost:6080/vnc.html
echo    Password: homeops
echo    
echo    Your traffic is routed through VPN
echo ============================================
echo.

REM Open in default browser
start http://localhost:6080/vnc.html

echo Browser launched successfully!
echo You can close this window.
timeout /t 5 /nobreak >nul