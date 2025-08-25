@echo off
echo ============================================
echo 🚀 HomeOps Smart Startup with Port Checking
echo ============================================
echo.

REM Check and reserve ports using the port manager
echo 🔍 Checking port availability...
powershell -ExecutionPolicy Bypass -File "C:\Projects\scripts\port-manager.ps1" check

echo.
echo 📋 Reserving ports for HomeOps...
powershell -ExecutionPolicy Bypass -File "C:\Projects\scripts\port-manager.ps1" reserve 3000 HomeOps frontend
powershell -ExecutionPolicy Bypass -File "C:\Projects\scripts\port-manager.ps1" reserve 3101 HomeOps backend-api

echo.
echo 🎯 Starting HomeOps services with reserved ports...
echo.

echo [1/2] Starting Backend API on http://localhost:3101
start cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend on http://localhost:3000
npm run dev

echo.
echo ✅ HomeOps services are running!
echo Frontend:    http://localhost:3000
echo Backend API: http://localhost:3101/api
echo Health:      http://localhost:3101/health
echo.
echo To stop and free ports, run: stop-safe.bat