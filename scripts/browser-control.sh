#!/bin/bash

# HomeOps Browser Control Script
# Manage private browsing with selective VPN routing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.browser.yml"
VPN_COMPOSE_FILE="docker-compose.yml"

print_usage() {
    echo "Usage: $0 {start|stop|status|vpn-on|vpn-off|switch|logs|rebuild}"
    echo ""
    echo "Commands:"
    echo "  start [vpn|direct]  - Start browser (default: vpn)"
    echo "  stop [vpn|direct]   - Stop browser"
    echo "  status              - Show browser and VPN status"
    echo "  vpn-on              - Enable VPN for browser"
    echo "  vpn-off             - Disable VPN (use direct browser)"
    echo "  switch              - Switch between VPN and direct browser"
    echo "  logs [service]      - Show logs"
    echo "  rebuild             - Rebuild browser image"
    echo "  access              - Show browser access URLs"
    exit 1
}

check_vpn_status() {
    if docker ps --format "table {{.Names}}" | grep -q "homeops-gluetun"; then
        vpn_health=$(docker inspect homeops-gluetun --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
        if [ "$vpn_health" = "healthy" ]; then
            echo -e "${GREEN}VPN is running and healthy${NC}"
            # Get VPN IP
            docker exec homeops-gluetun curl -s https://ipinfo.io/ip 2>/dev/null || echo "Unable to get VPN IP"
            return 0
        else
            echo -e "${YELLOW}VPN is running but not healthy (status: $vpn_health)${NC}"
            return 1
        fi
    else
        echo -e "${RED}VPN is not running${NC}"
        return 1
    fi
}

start_browser() {
    local mode=${1:-vpn}
    
    if [ "$mode" = "vpn" ]; then
        echo -e "${GREEN}Starting private browser with VPN...${NC}"
        
        # Ensure VPN is running first
        if ! check_vpn_status; then
            echo -e "${YELLOW}Starting VPN service first...${NC}"
            docker-compose -f $VPN_COMPOSE_FILE up -d gluetun
            echo "Waiting for VPN to be healthy..."
            sleep 10
        fi
        
        # Start VPN-routed browser
        docker-compose -f $COMPOSE_FILE up -d comet-browser
        echo -e "${GREEN}Private browser started with VPN${NC}"
        echo "Access via:"
        echo "  - VNC: vnc://localhost:5900 (password: homeops)"
        echo "  - Web: http://localhost:6080/vnc.html"
        
    elif [ "$mode" = "direct" ]; then
        echo -e "${YELLOW}Starting browser with direct connection (no VPN)...${NC}"
        docker-compose -f $COMPOSE_FILE up -d browser-direct
        echo -e "${GREEN}Browser started with direct connection${NC}"
        echo "Access via:"
        echo "  - VNC: vnc://localhost:5901 (password: homeops)"
        echo "  - Web: http://localhost:6081/vnc.html"
    else
        print_usage
    fi
}

stop_browser() {
    local mode=${1:-all}
    
    if [ "$mode" = "vpn" ]; then
        echo -e "${YELLOW}Stopping VPN browser...${NC}"
        docker-compose -f $COMPOSE_FILE stop comet-browser
        docker-compose -f $COMPOSE_FILE rm -f comet-browser
    elif [ "$mode" = "direct" ]; then
        echo -e "${YELLOW}Stopping direct browser...${NC}"
        docker-compose -f $COMPOSE_FILE stop browser-direct
        docker-compose -f $COMPOSE_FILE rm -f browser-direct
    else
        echo -e "${YELLOW}Stopping all browsers...${NC}"
        docker-compose -f $COMPOSE_FILE down
    fi
    echo -e "${GREEN}Done${NC}"
}

show_status() {
    echo -e "${GREEN}=== HomeOps Browser Status ===${NC}"
    echo ""
    
    # Check VPN status
    check_vpn_status
    echo ""
    
    # Check browser containers
    echo "Browser Containers:"
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "browser|comet"; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "browser|comet"
    else
        echo -e "${YELLOW}No browser containers running${NC}"
    fi
    echo ""
    
    # Show IP addresses
    echo "IP Information:"
    echo -n "Your real IP: "
    curl -s https://ipinfo.io/ip 2>/dev/null || echo "Unable to determine"
    
    if docker ps --format "{{.Names}}" | grep -q "homeops-gluetun"; then
        echo -n "VPN IP: "
        docker exec homeops-gluetun curl -s https://ipinfo.io/ip 2>/dev/null || echo "Unable to determine"
    fi
}

switch_browser() {
    echo -e "${YELLOW}Switching browser mode...${NC}"
    
    # Check which is running
    if docker ps --format "{{.Names}}" | grep -q "homeops-comet-browser"; then
        echo "Currently using VPN browser, switching to direct..."
        stop_browser vpn
        start_browser direct
    elif docker ps --format "{{.Names}}" | grep -q "homeops-browser-direct"; then
        echo "Currently using direct browser, switching to VPN..."
        stop_browser direct
        start_browser vpn
    else
        echo "No browser running, starting VPN browser..."
        start_browser vpn
    fi
}

show_logs() {
    local service=${1:-comet-browser}
    docker-compose -f $COMPOSE_FILE logs -f $service
}

rebuild_browser() {
    echo -e "${YELLOW}Rebuilding browser image...${NC}"
    docker-compose -f $COMPOSE_FILE build --no-cache
    echo -e "${GREEN}Browser image rebuilt${NC}"
}

show_access() {
    echo -e "${GREEN}=== Browser Access Information ===${NC}"
    echo ""
    
    if docker ps --format "{{.Names}}" | grep -q "homeops-comet-browser"; then
        echo "VPN Browser (Comet):"
        echo "  - VNC: vnc://localhost:5900"
        echo "  - Web: http://localhost:6080/vnc.html"
        echo "  - Password: homeops"
        echo "  - Status: Running with VPN"
        echo ""
    fi
    
    if docker ps --format "{{.Names}}" | grep -q "homeops-browser-direct"; then
        echo "Direct Browser:"
        echo "  - VNC: vnc://localhost:5901"
        echo "  - Web: http://localhost:6081/vnc.html"
        echo "  - Password: homeops"
        echo "  - Status: Running without VPN"
        echo ""
    fi
    
    if ! docker ps --format "{{.Names}}" | grep -qE "browser|comet"; then
        echo -e "${YELLOW}No browsers are currently running${NC}"
        echo "Start one with: $0 start [vpn|direct]"
    fi
}

# Main script logic
case "$1" in
    start)
        start_browser $2
        ;;
    stop)
        stop_browser $2
        ;;
    status)
        show_status
        ;;
    vpn-on)
        stop_browser direct
        start_browser vpn
        ;;
    vpn-off)
        stop_browser vpn
        start_browser direct
        ;;
    switch)
        switch_browser
        ;;
    logs)
        show_logs $2
        ;;
    rebuild)
        rebuild_browser
        ;;
    access)
        show_access
        ;;
    *)
        print_usage
        ;;
esac