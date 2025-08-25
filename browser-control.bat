@echo off
setlocal enabledelayedexpansion

REM HomeOps Browser Control for Windows
REM Manage private browsing with selective VPN routing

set "COMPOSE_FILE=docker-compose.browser.yml"
set "VPN_COMPOSE_FILE=docker-compose.yml"

if "%1"=="" goto :usage
goto :%1 2>nul || goto :usage

:start
    set mode=%2
    if "%mode%"=="" set mode=vpn
    
    if "%mode%"=="vpn" (
        echo Starting private browser with VPN...
        
        REM Check if VPN is running
        docker ps --format "table {{.Names}}" | findstr homeops-gluetun >nul 2>&1
        if errorlevel 1 (
            echo Starting VPN service first...
            docker-compose -f %VPN_COMPOSE_FILE% up -d gluetun
            timeout /t 10 /nobreak >nul
        )
        
        docker-compose -f %COMPOSE_FILE% up -d comet-browser
        echo.
        echo Private browser started with VPN
        echo Access via:
        echo   - VNC: vnc://localhost:5900 (password: homeops)
        echo   - Web: http://localhost:6080/vnc.html
        
    ) else if "%mode%"=="direct" (
        echo Starting browser with direct connection (no VPN)...
        docker-compose -f %COMPOSE_FILE% up -d browser-direct
        echo.
        echo Browser started with direct connection
        echo Access via:
        echo   - VNC: vnc://localhost:5901 (password: homeops)
        echo   - Web: http://localhost:6081/vnc.html
    ) else (
        goto :usage
    )
    goto :end

:stop
    set mode=%2
    if "%mode%"=="" set mode=all
    
    if "%mode%"=="vpn" (
        echo Stopping VPN browser...
        docker-compose -f %COMPOSE_FILE% stop comet-browser
        docker-compose -f %COMPOSE_FILE% rm -f comet-browser
    ) else if "%mode%"=="direct" (
        echo Stopping direct browser...
        docker-compose -f %COMPOSE_FILE% stop browser-direct
        docker-compose -f %COMPOSE_FILE% rm -f browser-direct
    ) else (
        echo Stopping all browsers...
        docker-compose -f %COMPOSE_FILE% down
    )
    echo Done
    goto :end

:status
    echo === HomeOps Browser Status ===
    echo.
    
    REM Check VPN status
    docker ps --format "table {{.Names}}" | findstr homeops-gluetun >nul 2>&1
    if errorlevel 1 (
        echo VPN is not running
    ) else (
        echo VPN is running
        echo VPN IP: 
        docker exec homeops-gluetun curl -s https://ipinfo.io/ip 2>nul
    )
    echo.
    
    REM Check browser containers
    echo Browser Containers:
    docker ps --format "table {{.Names}}\t{{.Status}}" | findstr /R "browser comet"
    if errorlevel 1 echo No browser containers running
    echo.
    
    REM Show IPs
    echo Your real IP:
    curl -s https://ipinfo.io/ip 2>nul
    goto :end

:vpn-on
    call :stop direct >nul 2>&1
    call :start vpn
    goto :end

:vpn-off
    call :stop vpn >nul 2>&1
    call :start direct
    goto :end

:rebuild
    echo Rebuilding browser image...
    docker-compose -f %COMPOSE_FILE% build --no-cache
    echo Browser image rebuilt
    goto :end

:access
    echo === Browser Access Information ===
    echo.
    
    docker ps --format "{{.Names}}" | findstr homeops-comet-browser >nul 2>&1
    if not errorlevel 1 (
        echo VPN Browser (Comet):
        echo   - VNC: vnc://localhost:5900
        echo   - Web: http://localhost:6080/vnc.html
        echo   - Password: homeops
        echo   - Status: Running with VPN
        echo.
    )
    
    docker ps --format "{{.Names}}" | findstr homeops-browser-direct >nul 2>&1
    if not errorlevel 1 (
        echo Direct Browser:
        echo   - VNC: vnc://localhost:5901
        echo   - Web: http://localhost:6081/vnc.html
        echo   - Password: homeops
        echo   - Status: Running without VPN
        echo.
    )
    
    docker ps --format "{{.Names}}" | findstr /R "browser comet" >nul 2>&1
    if errorlevel 1 (
        echo No browsers are currently running
        echo Start one with: %0 start [vpn^|direct]
    )
    goto :end

:logs
    set service=%2
    if "%service%"=="" set service=comet-browser
    docker-compose -f %COMPOSE_FILE% logs -f %service%
    goto :end

:usage
    echo Usage: %0 {start^|stop^|status^|vpn-on^|vpn-off^|rebuild^|access^|logs}
    echo.
    echo Commands:
    echo   start [vpn^|direct]  - Start browser (default: vpn)
    echo   stop [vpn^|direct]   - Stop browser
    echo   status              - Show browser and VPN status
    echo   vpn-on              - Enable VPN for browser
    echo   vpn-off             - Disable VPN (use direct browser)
    echo   rebuild             - Rebuild browser image
    echo   access              - Show browser access URLs
    echo   logs [service]      - Show logs
    exit /b 1

:end
endlocal