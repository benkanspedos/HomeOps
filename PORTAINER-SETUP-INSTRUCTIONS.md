# HomeOps Stack Setup in Portainer

## Steps to Create the Stack in Portainer:

### 1. Open Portainer
Go to http://localhost:9000 and login with:
- Username: ben
- Password: G8w$zR1qM!feL7pX

### 2. Navigate to Stacks
- Click on **"Stacks"** in the left sidebar
- Click the **"+ Add stack"** button

### 3. Create the HomeOps Stack
- **Name**: Enter `homeops` as the stack name
- **Build method**: Select **"Web editor"**

### 4. Copy the Docker Compose Content
- Open `C:\Projects\HomeOps\docker-compose.yml` in a text editor
- Copy ALL the content (it starts with `services:`)
- Paste it into the **"Web editor"** field in Portainer

### 5. Add Environment Variables
Scroll down to the **"Environment variables"** section and click **"Advanced mode"**

Copy and paste these environment variables:
```
NORDVPN_USERNAME=NZmrSternJ14YemN2vS8Wwp7
NORDVPN_PASSWORD=yHzRajaiucHxjTTaRt5QChRY
NORDVPN_COUNTRY=United States
PIHOLE_ADMIN_PASSWORD=homeops4real!
REDIS_PASSWORD=homeops123
TIMESCALE_USER=homeops
TIMESCALE_PASSWORD=localdev123
TIMESCALE_DB=homeops_metrics
```

### 6. Deploy the Stack
- Click the **"Deploy the stack"** button at the bottom
- Wait for all containers to start (this may take 1-2 minutes)

### 7. Verify Success
Once deployed, you should see:
- 5 containers in the HomeOps stack
- All containers showing as "running"
- Full control options (start, stop, restart, logs, console)

## Services After Deployment:

- **Pi-hole Admin**: http://localhost:8081 (Password: homeops4real!)
- **Portainer**: http://localhost:9000 (already logged in)
- **Gluetun VPN Status**: http://localhost:8000/v1/publicip/ip
- **Redis**: localhost:6380
- **TimescaleDB**: localhost:5433

## Benefits of Portainer Management:

✅ **Full Control**: Start/stop/restart containers individually or as a group
✅ **Logs**: View container logs directly in the browser
✅ **Console**: Access container shell from the browser
✅ **Updates**: Easy container image updates
✅ **Environment**: Edit environment variables without redeploying
✅ **Monitoring**: See resource usage (CPU, memory, network)

## Troubleshooting:

If any container fails to start:
1. Click on the container name in Portainer
2. Click on "Logs" to see what went wrong
3. Common issues:
   - Port conflicts: Change the port mapping
   - Environment variables: Check they're all set correctly
   - VPN credentials: Verify NordVPN credentials are correct

## Note:
The stack is now fully managed by Portainer. To make changes:
- Edit the stack in Portainer (not docker-compose.yml)
- Or update docker-compose.yml and re-deploy through Portainer