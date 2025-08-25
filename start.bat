@echo off
echo Starting HomeOps Services...
echo.

echo [1/2] Starting Backend API on http://localhost:3001
start cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend on http://localhost:3000
npm run dev

echo.
echo HomeOps services are running!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:3001/api
echo Health Check: http://localhost:3001/health