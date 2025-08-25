@echo off
echo ========================================
echo 🛑 HomeOps Safe Shutdown & Port Cleanup
echo ========================================
echo.

echo 🔄 Stopping HomeOps processes...
REM Kill processes using the specific ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    echo Stopping process using port 3000 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3101 "') do (
    echo Stopping process using port 3101 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak > nul

echo.
echo 🗑️ Freeing reserved ports...
powershell -ExecutionPolicy Bypass -File "C:\Projects\scripts\port-manager.ps1" free 3000
powershell -ExecutionPolicy Bypass -File "C:\Projects\scripts\port-manager.ps1" free 3101

echo.
echo 📊 Current port status:
powershell -ExecutionPolicy Bypass -File "C:\Projects\scripts\port-manager.ps1" check

echo.
echo ✅ HomeOps shutdown complete!
pause