@echo off
echo ============================================
echo 🚀 HomeOps Docker Infrastructure Startup
echo ============================================
echo.

echo 📁 Creating required directories...
mkdir docker\data\redis 2>nul
mkdir docker\data\timescaledb 2>nul
mkdir docker\pihole\etc 2>nul
mkdir docker\pihole\dnsmasq 2>nul
mkdir docker\gluetun 2>nul

echo.
echo 🔍 Checking Docker status...
docker --version
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not installed or not running
    echo Please install Docker Desktop and make sure it's running
    pause
    exit /b 1
)

echo.
echo 📋 Checking environment configuration...
if not exist .env.local (
    echo ❌ .env.local file not found
    echo Please ensure your environment variables are configured
    pause
    exit /b 1
)

echo.
echo 🔄 Starting Docker Compose stack...
echo This will start:
echo   - Gluetun VPN (NordVPN routing)
echo   - Pi-hole DNS (network-wide ad blocking)
echo   - Redis cache
echo   - TimescaleDB (metrics storage)
echo   - Portainer (container management)
echo.

echo Starting in VPN-first mode (all services route through VPN)...
docker-compose up -d

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ HomeOps Docker infrastructure started successfully!
    echo.
    echo 🌐 Available Services:
    echo   - Pi-hole Admin:  http://localhost:8080
    echo   - Portainer:      http://localhost:9000
    echo   - Gluetun Status: http://localhost:8000
    echo   - Redis:          localhost:6379
    echo   - TimescaleDB:    localhost:5433
    echo.
    echo 🔒 VPN Status: All services are routing through NordVPN
    echo.
    echo 📊 To check service status:
    echo   docker-compose ps
    echo.
    echo 🛑 To stop all services:
    echo   docker-compose down
    echo.
) else (
    echo ❌ Failed to start Docker infrastructure
    echo Check the logs above for errors
    pause
    exit /b 1
)

echo 🕐 Waiting for services to initialize...
timeout /t 10 /nobreak > nul

echo.
echo 📈 Service Status:
docker-compose ps

echo.
echo 🎯 HomeOps Docker infrastructure is ready!
echo You can now use the HomeOps API to manage these services.
pause