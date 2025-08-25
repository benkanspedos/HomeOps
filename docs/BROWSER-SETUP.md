# HomeOps Private Browser Setup

## Overview
This setup provides a containerized browser environment with selective VPN routing. You can run browsers either through the VPN for privacy or directly for regular browsing.

## Features
- **Comet Browser (VPN-routed)**: All traffic goes through VPN for maximum privacy
- **Direct Browser**: Regular browsing without VPN overhead
- **Web-based Access**: Access browsers through your web browser via noVNC
- **VNC Access**: Connect with any VNC client
- **Isolated Environment**: Browsers run in Docker containers
- **Selective Routing**: Choose which apps use VPN and which don't

## Quick Start

### 1. Build the Browser Image
```bash
# Windows
browser-control.bat rebuild

# Linux/Mac
./scripts/browser-control.sh rebuild
```

### 2. Start Private Browser (with VPN)
```bash
# Windows
browser-control.bat start vpn

# Linux/Mac
./scripts/browser-control.sh start vpn
```

### 3. Access the Browser
Open your web browser and navigate to:
- **VPN Browser**: http://localhost:6080/vnc.html
- **Direct Browser**: http://localhost:6081/vnc.html

Password: `homeops` (change in production)

## Usage Commands

### Windows (browser-control.bat)
```bash
# Start browser with VPN
browser-control.bat start vpn

# Start browser without VPN
browser-control.bat start direct

# Stop browsers
browser-control.bat stop

# Check status
browser-control.bat status

# Switch VPN on
browser-control.bat vpn-on

# Switch VPN off
browser-control.bat vpn-off

# Show access URLs
browser-control.bat access

# View logs
browser-control.bat logs
```

### Linux/Mac (browser-control.sh)
```bash
# Same commands, just use the shell script
./scripts/browser-control.sh [command]
```

## Architecture

### Container Structure
```
homeops-gluetun (VPN Gateway)
    └── homeops-comet-browser (VPN-routed browser)
        ├── Xvfb (Virtual display)
        ├── Fluxbox (Window manager)
        ├── x11vnc (VNC server)
        ├── noVNC (Web VNC client)
        └── Chromium Browser

homeops-browser-direct (Direct connection)
    ├── Same stack as above
    └── No VPN routing
```

### Network Flow
1. **VPN Browser**: Browser → Gluetun → VPN Server → Internet
2. **Direct Browser**: Browser → Your ISP → Internet

## Security Considerations

### Default Settings (CHANGE IN PRODUCTION)
- VNC Password: `homeops`
- Browser runs as non-root user
- Isolated container environment
- No persistent cookies/history by default

### Recommended Changes for Production
1. Change VNC password in:
   - `docker-compose.browser.yml`
   - `docker/browser/Dockerfile`
   
2. Use environment variables for sensitive data:
   ```bash
   export VNC_PASSWORD=your-secure-password
   ```

3. Restrict port access with firewall rules

4. Use HTTPS for noVNC access in production

## Customization

### Browser Arguments
Edit `BROWSER_ARGS` in `docker-compose.browser.yml`:
```yaml
environment:
  - BROWSER_ARGS=--no-sandbox --disable-dev-shm-usage --incognito
```

### Screen Resolution
Modify in `docker-compose.browser.yml`:
```yaml
environment:
  - DISPLAY_WIDTH=1920
  - DISPLAY_HEIGHT=1080
```

### Persistent Storage
Uncomment volume mount for downloads:
```yaml
volumes:
  - ./downloads:/home/browser/Downloads
```

## VPN Configuration

### Check VPN Status
```bash
browser-control.bat status
```

### VPN IP vs Real IP
The status command shows both your real IP and VPN IP when connected.

### Selective App Routing
- Apps in `network_mode: "service:gluetun"` use VPN
- Apps in `networks: - homeops-network` use direct connection
- Mix and match as needed

## Troubleshooting

### Browser Won't Start
1. Check VPN is running: `docker ps | grep gluetun`
2. Check logs: `browser-control.bat logs`
3. Rebuild image: `browser-control.bat rebuild`

### Can't Connect to VNC
1. Check ports are free: `netstat -an | findstr :6080`
2. Check container is running: `docker ps`
3. Try VNC client instead of web: `vnc://localhost:5900`

### Slow Performance
1. Increase resources in Docker Desktop settings
2. Use direct browser for non-sensitive browsing
3. Check VPN server location (closer = faster)

### VPN Not Working
1. Check credentials in `.env` file
2. Verify VPN service is configured correctly
3. Check Gluetun logs: `docker logs homeops-gluetun`

## Advanced Usage

### Multiple Browsers
You can run both VPN and direct browsers simultaneously:
```bash
browser-control.bat start vpn
browser-control.bat start direct
```

### Custom Browser Installation
To install a specific browser (like actual Comet):
1. Edit `docker/browser/Dockerfile`
2. Add installation commands for your browser
3. Rebuild: `browser-control.bat rebuild`

### Integration with Other Services
Browsers can access other HomeOps services:
- Pi-hole DNS filtering
- Local development servers
- Database management tools

## Performance Tips
1. **Use Direct Browser** for general browsing
2. **Use VPN Browser** only for sensitive activities
3. **Close unused tabs** to save resources
4. **Restart containers** periodically to free memory

## Next Steps
1. Install actual Comet browser or other privacy-focused browsers
2. Set up browser profiles and extensions
3. Configure automatic VPN server switching
4. Add more browser containers for different use cases
5. Implement browser automation for testing