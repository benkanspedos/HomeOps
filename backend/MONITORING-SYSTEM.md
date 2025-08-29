# HomeOps Monitoring System

## Overview

The HomeOps monitoring system provides comprehensive health monitoring, metrics collection, and alerting for Docker containers and system resources. It integrates with TimescaleDB for time-series data storage and supports multiple alert channels including email, Slack, Discord, and webhooks.

## Features

### Health Monitoring
- **Container Health Checks**: Real-time monitoring of container status, uptime, and restart counts
- **Resource Metrics**: CPU, memory, disk, and network usage tracking
- **System Metrics**: Overall system resource utilization
- **Container Logs**: Access to container logs through API
- **Health Status Stream**: Server-Sent Events for real-time updates

### Alert System
- **Multi-Channel Notifications**: Email, Slack, Discord, and webhook support
- **Configurable Thresholds**: Set custom alert thresholds for any metric
- **Alert Templates**: Pre-configured templates for common scenarios
- **Rate Limiting**: Prevent alert spam with configurable cooldown periods
- **Alert History**: Track all triggered alerts and their status
- **Priority Levels**: Critical, High, Medium, Low priority classifications

### Data Storage
- **TimescaleDB Integration**: Optimized time-series data storage
- **Automatic Aggregation**: 5-minute and hourly data aggregations
- **Data Retention**: Configurable retention policies (default 30 days)
- **Compression**: Automatic data compression after 7 days

## Installation

### Prerequisites
- Docker Desktop (Windows) or Docker Engine (Linux/Mac)
- PostgreSQL with TimescaleDB extension
- Redis for caching
- Node.js 20+

### Setup Steps

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Configure Environment**
Copy `.env.example` to `.env` and update with your values:
```bash
cp .env.example .env
```

3. **Apply Database Migrations**
```powershell
.\scripts\apply-migrations.ps1
```

4. **Start the Server**
```bash
npm run dev
```

5. **Test the System**
```powershell
.\test-monitoring.ps1
```

## API Endpoints

### Health Monitoring

#### Get Container Health
```
GET /api/health/containers
```
Returns health status of all containers with summary statistics.

#### Get Container Logs
```
GET /api/health/containers/:containerId/logs?lines=100
```
Retrieves recent logs from a specific container.

#### Get Container Metrics
```
GET /api/health/metrics/:containerId?hours=24
```
Returns historical metrics for a specific container.

#### Get Current Metrics
```
GET /api/health/metrics/:containerId/current
```
Returns current real-time metrics for a container.

#### Get System Health
```
GET /api/health/system
```
Returns overall system resource usage and statistics.

#### Stream Health Updates
```
GET /api/health/stream
```
Server-Sent Events endpoint for real-time health updates.

### Alert Management

#### Configure Alert
```
POST /api/alerts/configure
```
Body:
```json
{
  "name": "High CPU Alert",
  "enabled": true,
  "containerName": "homeops-backend",
  "metricType": "cpu",
  "thresholdValue": 80,
  "comparisonOperator": ">",
  "channels": [
    {
      "type": "email",
      "config": {
        "to": "admin@homeops.local"
      },
      "enabled": true
    }
  ],
  "priority": "high",
  "cooldownMinutes": 15,
  "description": "Alert when CPU exceeds 80%"
}
```

#### Update Alert
```
PUT /api/alerts/:alertId
```
Updates an existing alert configuration.

#### Delete Alert
```
DELETE /api/alerts/:alertId
```
Removes an alert configuration.

#### Get Alert History
```
GET /api/alerts/history?hours=24&alertId=xxx
```
Returns triggered alerts within the specified timeframe.

#### Get Alert Templates
```
GET /api/alerts/templates
```
Returns pre-configured alert templates.

#### Test Alert Channel
```
POST /api/alerts/test/:channel
```
Sends a test alert to verify channel configuration.

## Configuration

### Environment Variables

#### Monitoring Settings
- `MONITORING_INTERVAL`: Metrics collection interval (ms)
- `HEALTH_CHECK_INTERVAL`: Health check interval (ms)
- `ENABLE_METRICS`: Enable/disable metrics collection
- `ENABLE_HEALTH_CHECKS`: Enable/disable health checks
- `ENABLE_ALERTS`: Enable/disable alerting

#### Default Thresholds
- `DEFAULT_CPU_THRESHOLD`: CPU usage percentage (default: 80)
- `DEFAULT_MEMORY_THRESHOLD`: Memory usage percentage (default: 90)
- `DEFAULT_DISK_THRESHOLD`: Disk usage percentage (default: 85)
- `DEFAULT_RESTART_THRESHOLD`: Container restart count (default: 5)

#### Alert Channels
- **Email**: Configure SMTP settings
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **Slack**: Set webhook URL
  - `SLACK_WEBHOOK_URL`
- **Discord**: Set webhook URL
  - `DISCORD_WEBHOOK_URL`

### Critical Containers
Define containers that should always be monitored:
```
CRITICAL_CONTAINERS=homeops-gluetun,homeops-pihole,homeops-redis
```

## Alert Types

### Metric Types
- `cpu`: CPU usage percentage
- `memory`: Memory usage percentage
- `disk`: Disk usage percentage
- `network`: Network throughput (MB)
- `container_status`: Container running state (0=stopped, 1=running)
- `health_check`: Container health check status
- `restart_count`: Number of container restarts

### Comparison Operators
- `>`: Greater than
- `<`: Less than
- `=`: Equal to
- `!=`: Not equal to
- `>=`: Greater than or equal to
- `<=`: Less than or equal to

### Priority Levels
- `critical`: Immediate attention required
- `high`: Important issue requiring prompt action
- `medium`: Notable issue to be addressed
- `low`: Informational alert

## Event System

The monitoring service emits the following events:

- `container:down`: Container has stopped
- `container:unhealthy`: Container health check failed
- `container:restart-loop`: Container restarting excessively
- `threshold:cpu-high`: CPU threshold exceeded
- `threshold:memory-high`: Memory threshold exceeded
- `alert:triggered`: Alert has been triggered

## Database Schema

### Tables
- `health_metrics`: Container metrics time-series data
- `system_metrics`: System-wide metrics
- `container_events`: Container state change events
- `alerts`: Alert configurations
- `alert_history`: Triggered alert records
- `alert_channels`: Notification channel configurations
- `alert_templates`: Pre-defined alert templates

### Views
- `health_metrics_5min`: 5-minute aggregated metrics
- `health_metrics_hourly`: Hourly aggregated metrics
- `active_alerts_view`: Currently active alerts
- `alert_statistics`: Alert trigger statistics

## Troubleshooting

### Common Issues

#### Docker Connection Failed
- **Windows**: Ensure Docker Desktop is running and expose daemon on tcp://localhost:2375
- **Linux/Mac**: Check Docker socket permissions at /var/run/docker.sock

#### TimescaleDB Connection Failed
- Verify PostgreSQL is running on port 5433
- Check database credentials in .env file
- Ensure TimescaleDB extension is installed

#### Alerts Not Sending
- Verify channel configuration (SMTP, webhook URLs)
- Check rate limiting settings
- Review alert history for error messages

#### High Memory Usage
- Adjust retention policies to reduce data storage
- Enable compression for older data
- Reduce monitoring interval if needed

## Development

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
npm run start:prod
```

## Security Considerations

- All API endpoints can be protected with authentication middleware
- Sensitive configuration stored in environment variables
- Alert channels support secure protocols (TLS/SSL)
- Rate limiting prevents abuse
- Input validation on all endpoints

## Performance Optimization

- TimescaleDB hypertables for efficient time-series queries
- Continuous aggregates for fast dashboard queries
- Redis caching for frequently accessed data
- Configurable monitoring intervals
- Automatic data compression and retention

## Future Enhancements

- [ ] WebSocket support for real-time metrics
- [ ] Grafana integration for visualization
- [ ] Prometheus metrics export
- [ ] Custom alert scripting
- [ ] Machine learning anomaly detection
- [ ] Predictive alerts based on trends
- [ ] Mobile app notifications
- [ ] Backup and restore functionality

## Support

For issues or questions about the monitoring system:
1. Check the logs in `logs/health-monitor.log`
2. Review alert history for patterns
3. Test individual components with the test script
4. Verify all services are running (Docker, Redis, PostgreSQL)