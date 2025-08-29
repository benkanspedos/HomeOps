# US-101: System Health Monitoring - Sequential Execution Prompts

## Story Details
- **Story ID**: US-101
- **Story Points**: 5
- **Priority**: P0 (Essential)
- **Sprint**: 1
- **Status**: READY TO START
- **Dependencies**: INFRA-001 (COMPLETE), US-201 (COMPLETE)

## Sequential Execution Mode
Per updated Stage 5 guidelines, execute these tracks sequentially in a single terminal.

## Track 1: Backend Implementation - Health Monitoring Services

```markdown
Implement the backend health monitoring system for HomeOps. Create a comprehensive monitoring service that collects health metrics from Docker containers and system resources.

## Requirements:
Implement system health monitoring with:
1. Container health checks for all Docker services
2. Service uptime tracking and history
3. Alert notification system (email, Slack, webhook)
4. Real-time monitoring dashboard
5. Resource usage metrics (CPU, memory, disk)

## Current Infrastructure:
- Docker containers: Gluetun, Redis, TimescaleDB, Pi-hole, Portainer
- Backend API: http://localhost:3101
- Database: Supabase + TimescaleDB (port 5433)
- DNS Management: Complete with Pi-hole integration

## Tasks:

### 1. Create Health Monitor Service
Create `C:\Projects\HomeOps\backend\src\services\health-monitor.service.ts`:
- Connect to Docker API for container health status
- Monitor container uptime and restart counts
- Collect resource metrics (CPU, memory, disk) using Docker stats API
- Store time-series metrics in TimescaleDB tables
- Methods: checkContainerHealth(), collectMetrics(), getUptime(), getResourceUsage()

### 2. Create Alert Service
Create `C:\Projects\HomeOps\backend\src\services\alert.service.ts`:
- Alert threshold configuration (CPU > 80%, memory > 90%, container down)
- Multi-channel notifications: email (SMTP), Slack webhook, generic webhooks
- Alert deduplication and rate limiting
- Alert history tracking in database
- Methods: checkThresholds(), sendAlert(), getAlertHistory()

### 3. Create Monitoring API Endpoints
Create `C:\Projects\HomeOps\backend\src\controllers\monitoring.controller.ts`:
- GET /api/health/containers - Return all container health status
- GET /api/health/metrics/:containerId - Get container metrics history
- GET /api/health/system - System-wide resource usage
- POST /api/alerts/configure - Configure alert thresholds and channels
- GET /api/alerts/history - Get alert history
- POST /api/alerts/test/:channel - Test alert channel

### 4. Create Database Migrations
Create migrations in `C:\Projects\HomeOps\backend\src\database\migrations\`:
```sql
-- 003_health_metrics.sql
CREATE TABLE IF NOT EXISTS health_metrics (
  time TIMESTAMPTZ NOT NULL,
  container_id VARCHAR(64) NOT NULL,
  container_name VARCHAR(255),
  cpu_percent NUMERIC(5,2),
  memory_usage_mb NUMERIC(10,2),
  memory_percent NUMERIC(5,2),
  network_rx_bytes BIGINT,
  network_tx_bytes BIGINT,
  disk_usage_mb NUMERIC(10,2),
  status VARCHAR(50),
  health_status VARCHAR(50)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('health_metrics', 'time');
CREATE INDEX ON health_metrics (container_id, time DESC);

-- 004_alerts.sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  container_id VARCHAR(64),
  metric_type VARCHAR(50),
  threshold_value NUMERIC(10,2),
  comparison_operator VARCHAR(10),
  channel_type VARCHAR(50),
  channel_config JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  metric_value NUMERIC(10,2),
  message TEXT,
  sent_to VARCHAR(255),
  status VARCHAR(50)
);
```

### 5. Create Monitoring Configuration
Create `C:\Projects\HomeOps\backend\src\config\monitoring.config.ts`:
```typescript
export const monitoringConfig = {
  docker: {
    socketPath: '/var/run/docker.sock', // Windows: '//./pipe/docker_engine'
    statsInterval: 30000, // 30 seconds
  },
  timescaledb: {
    connectionString: process.env.TIMESCALE_URL,
    retentionDays: 30,
  },
  alerts: {
    email: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    },
    rateLimitMinutes: 15, // Don't repeat same alert within 15 min
  },
  defaultThresholds: {
    cpuPercent: 80,
    memoryPercent: 90,
    diskPercent: 85,
  },
};
```

### 6. Create Monitoring Routes
Create `C:\Projects\HomeOps\backend\src\routes\monitoring.routes.ts`:
- Register all monitoring endpoints
- Apply authentication middleware
- Add rate limiting for alert endpoints
- WebSocket endpoint for real-time updates

### 7. Environment Variables
Update `C:\Projects\HomeOps\backend\.env`:
```
# TimescaleDB
TIMESCALE_URL=postgresql://homeops:homeops123@localhost:5433/metrics

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@homeops.local
SMTP_PASS=your_app_password

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Monitoring
MONITORING_INTERVAL=30000
ALERT_RATE_LIMIT=15
```

Test the implementation:
- Verify Docker API connectivity
- Test metric collection from all containers
- Confirm TimescaleDB storage
- Test alert triggering and delivery

File paths to create/modify:
- backend/src/services/health-monitor.service.ts (new)
- backend/src/services/alert.service.ts (new)
- backend/src/controllers/monitoring.controller.ts (new)
- backend/src/routes/monitoring.routes.ts (new)
- backend/src/config/monitoring.config.ts (new)
- backend/src/database/migrations/003_health_metrics.sql (new)
- backend/src/database/migrations/004_alerts.sql (new)
- backend/src/routes/index.ts (modify)
- backend/.env (modify)
```

## Track 2: Frontend Implementation - Monitoring Dashboard

```markdown
Build the frontend monitoring dashboard for HomeOps health monitoring system. Create a real-time dashboard that displays container health, metrics, and alert configuration.

## Requirements:
Build the monitoring UI with:
1. Container health status cards
2. Real-time metrics visualization
3. Alert configuration interface
4. System resource gauges
5. Alert history viewer

## Current Setup:
- Frontend: Next.js 14 on http://localhost:3000
- Backend API: http://localhost:3101/api/health/*
- UI Components: React 18 with TypeScript
- Charts: Recharts library
- State: React Query with WebSocket support

## Tasks:

### 1. Create Monitoring Dashboard
Create `C:\Projects\HomeOps\frontend\src\app\monitoring\page.tsx`:
```tsx
// Main monitoring dashboard with:
- Grid layout for container health cards
- Real-time status updates (10-second polling)
- Color-coded indicators (green/yellow/red)
- Container uptime display
- Quick actions (restart, logs, pause)
```

### 2. Create Monitoring Components
Create components in `C:\Projects\HomeOps\frontend\src\components\monitoring\`:

**ContainerHealthCard.tsx**:
- Display container name, status, uptime
- CPU/Memory usage bars
- Health status indicator
- Action buttons dropdown

**MetricsChart.tsx**:
- Multi-line chart for CPU/memory/network
- Time range selector
- Zoom and pan functionality
- Export to CSV

**AlertConfigPanel.tsx**:
- Threshold configuration form
- Channel setup (email, Slack)
- Test alert buttons
- Enable/disable toggles

**SystemResourceGauge.tsx**:
- Circular gauges for system metrics
- Animated transitions
- Warning/critical thresholds
- Percentage and absolute values

**AlertHistoryTable.tsx**:
- Paginated alert history
- Filter by severity, container
- Search functionality
- Mark as resolved

### 3. Create Metrics Detail Page
Create `C:\Projects\HomeOps\frontend\src\app\monitoring\metrics\[containerId]\page.tsx`:
- Detailed metrics for specific container
- Time range selector (1h, 6h, 24h, 7d, 30d)
- Resource usage trends
- Anomaly detection highlighting
- Performance insights

### 4. Create Alert Configuration Page
Create `C:\Projects\HomeOps\frontend\src\app\monitoring\alerts\page.tsx`:
- Global and per-container thresholds
- Notification channel management
- Alert rule builder
- Testing interface
- Alert suppression rules

### 5. Create Monitoring API Client
Create `C:\Projects\HomeOps\frontend\src\lib\api\monitoring.ts`:
```typescript
export const monitoringApi = {
  getContainerHealth: async () => fetch('/api/health/containers'),
  getMetrics: async (containerId: string, range: string) => 
    fetch(`/api/health/metrics/${containerId}?range=${range}`),
  getSystemHealth: async () => fetch('/api/health/system'),
  configureAlert: async (config: AlertConfig) => 
    fetch('/api/alerts/configure', { method: 'POST', body: JSON.stringify(config) }),
  getAlertHistory: async (page: number) => 
    fetch(`/api/alerts/history?page=${page}`),
  testAlert: async (channel: string) => 
    fetch(`/api/alerts/test/${channel}`, { method: 'POST' }),
};
```

### 6. Create Monitoring Hooks
Create hooks in `C:\Projects\HomeOps\frontend\src\hooks\`:

**useContainerHealth.ts**:
```typescript
export const useContainerHealth = () => {
  return useQuery({
    queryKey: ['containerHealth'],
    queryFn: monitoringApi.getContainerHealth,
    refetchInterval: 10000, // 10 seconds
  });
};
```

**useMetrics.ts**:
- Fetch and cache historical metrics
- Support different time ranges
- Handle real-time updates

**useAlerts.ts**:
- Manage alert configuration
- Handle alert history
- WebSocket for real-time alerts

### 7. Add to Navigation
Update `C:\Projects\HomeOps\frontend\src\components\layout\Sidebar.tsx`:
- Add "System Monitoring" menu item
- Show active alert count badge
- Health status indicator
- Route: /monitoring

### 8. Create Types
Create `C:\Projects\HomeOps\frontend\src\types\monitoring.ts`:
```typescript
interface ContainerHealth {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  health: 'healthy' | 'unhealthy' | 'none';
  uptime: number;
  cpu: number;
  memory: number;
  lastCheck: Date;
}

interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
}
```

Test the implementation:
- Navigate to http://localhost:3000/monitoring
- Verify real-time updates
- Test alert configuration
- Check responsive design
- Validate chart rendering

File paths to create/modify:
- frontend/src/app/monitoring/page.tsx (new)
- frontend/src/app/monitoring/metrics/[containerId]/page.tsx (new)
- frontend/src/app/monitoring/alerts/page.tsx (new)
- frontend/src/components/monitoring/*.tsx (new - 5 components)
- frontend/src/lib/api/monitoring.ts (new)
- frontend/src/hooks/useContainerHealth.ts (new)
- frontend/src/hooks/useMetrics.ts (new)
- frontend/src/hooks/useAlerts.ts (new)
- frontend/src/types/monitoring.ts (new)
- frontend/src/components/layout/Sidebar.tsx (modify)
```

## Track 3: Testing & Validation - Complete Test Suite

```markdown
Implement comprehensive testing for the HomeOps health monitoring system. Create unit tests, integration tests, and end-to-end tests to validate all monitoring functionality.

## Requirements:
Implement full test coverage for:
1. Backend monitoring services and Docker integration
2. Alert system with all notification channels
3. Frontend dashboard and real-time updates
4. End-to-end monitoring workflows
5. Performance under load

## Testing Infrastructure:
- Backend: Jest with Docker API mocks
- Frontend: Jest + React Testing Library
- E2E: Playwright
- Performance: k6 for load testing

## Tasks:

### 1. Backend Service Tests
Create `C:\Projects\HomeOps\backend\src\services\__tests__\health-monitor.service.test.ts`:
```typescript
describe('HealthMonitorService', () => {
  it('should fetch container health from Docker API', async () => {
    // Mock Docker API responses
    // Test health check logic
    // Verify metric collection
  });
  
  it('should store metrics in TimescaleDB', async () => {
    // Test database writes
    // Verify hypertable storage
    // Check data retention
  });
  
  it('should handle Docker API failures gracefully', async () => {
    // Test error scenarios
    // Verify fallback behavior
  });
});
```

Create `C:\Projects\HomeOps\backend\src\services\__tests__\alert.service.test.ts`:
- Test threshold checking logic
- Test alert deduplication
- Mock email/Slack/webhook delivery
- Test rate limiting

### 2. API Integration Tests
Create `C:\Projects\HomeOps\backend\src\controllers\__tests__\monitoring.controller.test.ts`:
```typescript
describe('Monitoring API', () => {
  it('GET /api/health/containers returns all container status', async () => {
    const response = await request(app).get('/api/health/containers');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('containers');
  });
  
  it('POST /api/alerts/configure creates alert rule', async () => {
    const alertConfig = {
      name: 'High CPU Alert',
      metric: 'cpu',
      threshold: 80,
      channel: 'email',
    };
    // Test alert creation
  });
  
  it('POST /api/alerts/test/:channel sends test notification', async () => {
    // Test each notification channel
  });
});
```

### 3. Frontend Component Tests
Create `C:\Projects\HomeOps\frontend\src\components\monitoring\__tests__\ContainerHealthCard.test.tsx`:
```typescript
describe('ContainerHealthCard', () => {
  it('displays container status correctly', () => {
    render(<ContainerHealthCard container={mockContainer} />);
    expect(screen.getByText('nginx')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
  
  it('shows warning for high resource usage', () => {
    const highCpuContainer = { ...mockContainer, cpu: 85 };
    render(<ContainerHealthCard container={highCpuContainer} />);
    expect(screen.getByRole('alert')).toHaveClass('warning');
  });
});
```

Create tests for other components:
- MetricsChart.test.tsx
- AlertConfigPanel.test.tsx
- SystemResourceGauge.test.tsx
- AlertHistoryTable.test.tsx

### 4. Hook Tests
Create `C:\Projects\HomeOps\frontend\src\hooks\__tests__\useContainerHealth.test.ts`:
```typescript
describe('useContainerHealth', () => {
  it('polls container health every 10 seconds', async () => {
    const { result } = renderHook(() => useContainerHealth());
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    
    // Verify polling behavior
  });
});
```

### 5. E2E Tests
Create `C:\Projects\HomeOps\e2e\tests\monitoring.spec.ts`:
```typescript
test.describe('System Monitoring', () => {
  test('displays all container health cards', async ({ page }) => {
    await page.goto('/monitoring');
    
    // Verify container cards are displayed
    const containers = await page.locator('[data-testid="container-card"]').count();
    expect(containers).toBeGreaterThan(0);
  });
  
  test('configures and triggers alert', async ({ page }) => {
    await page.goto('/monitoring/alerts');
    
    // Configure high CPU alert
    await page.fill('[name="threshold"]', '80');
    await page.selectOption('[name="channel"]', 'email');
    await page.click('[type="submit"]');
    
    // Test alert
    await page.click('[data-testid="test-alert"]');
    await expect(page.locator('.toast-success')).toBeVisible();
  });
  
  test('shows real-time metric updates', async ({ page }) => {
    await page.goto('/monitoring');
    
    // Capture initial metric value
    const initialCpu = await page.locator('[data-testid="cpu-usage"]').textContent();
    
    // Wait for update
    await page.waitForTimeout(11000);
    
    // Verify value changed
    const updatedCpu = await page.locator('[data-testid="cpu-usage"]').textContent();
    expect(updatedCpu).not.toBe(initialCpu);
  });
});
```

### 6. Performance Tests
Create `C:\Projects\HomeOps\backend\src\tests\performance\monitoring-load.test.ts`:
```typescript
describe('Monitoring Performance', () => {
  it('handles 100+ concurrent metric requests', async () => {
    const requests = Array(100).fill(null).map(() => 
      request(app).get('/api/health/containers')
    );
    
    const results = await Promise.all(requests);
    results.forEach(res => expect(res.status).toBe(200));
  });
  
  it('processes metrics for 50+ containers efficiently', async () => {
    // Test with many containers
    // Measure response times
    // Verify < 100ms response
  });
});
```

### 7. Alert Channel Tests
Create `C:\Projects\HomeOps\backend\src\tests\alerts\channel-tests.ts`:
```typescript
describe('Alert Channels', () => {
  it('sends email alerts successfully', async () => {
    // Mock SMTP transport
    // Test email delivery
    // Verify email content
  });
  
  it('sends Slack notifications', async () => {
    // Mock Slack webhook
    // Test message formatting
    // Verify delivery
  });
  
  it('handles webhook failures gracefully', async () => {
    // Test retry logic
    // Verify error handling
  });
});
```

### 8. Test Utilities
Create `C:\Projects\HomeOps\tests\utils\monitoring-helpers.ts`:
```typescript
export const generateMockMetrics = (count: number) => {
  // Generate test metric data
};

export const createTestAlert = (overrides = {}) => {
  // Create test alert configuration
};

export const simulateHighLoad = async () => {
  // Simulate high CPU/memory conditions
};
```

### 9. Validation Script
Create `C:\Projects\HomeOps\scripts\validate-monitoring.ts`:
```typescript
async function validateMonitoring() {
  console.log('🔍 Validating monitoring system...');
  
  // Check Docker connectivity
  // Verify TimescaleDB tables
  // Test each alert channel
  // Generate health report
  
  console.log('✅ Monitoring system validated');
}
```

Run complete test suite:
```bash
# Backend tests
cd backend && npm test -- --coverage

# Frontend tests
cd frontend && npm test -- --coverage

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# Validate monitoring
npm run validate:monitoring
```

Validation checklist:
- [ ] All containers monitored successfully
- [ ] Metrics stored in TimescaleDB
- [ ] Alerts trigger at correct thresholds
- [ ] All notification channels working
- [ ] Dashboard updates in real-time
- [ ] >80% test coverage achieved

File paths to create:
- backend/src/services/__tests__/*.test.ts (2 files)
- backend/src/controllers/__tests__/monitoring.controller.test.ts
- backend/src/tests/performance/monitoring-load.test.ts
- backend/src/tests/alerts/channel-tests.ts
- frontend/src/components/monitoring/__tests__/*.test.tsx (5 files)
- frontend/src/hooks/__tests__/*.test.ts (3 files)
- e2e/tests/monitoring.spec.ts
- tests/utils/monitoring-helpers.ts
- scripts/validate-monitoring.ts
```

## Execution Instructions

Execute these prompts sequentially in a single terminal session:

1. **Start with Track 1** - Complete backend monitoring infrastructure
2. **Then Track 2** - Build dashboard once monitoring API is ready
3. **Finish with Track 3** - Validate with comprehensive testing

Each track builds upon the previous one, ensuring proper integration.

## Success Criteria
- All Docker containers monitored in real-time
- Metrics stored in TimescaleDB with 30-day retention
- Alert system working with email, Slack, webhooks
- Dashboard showing live health status
- >80% test coverage across all components
- Performance benchmarks met (<100ms response)

## Next Steps
1. Copy Track 1 prompt and implement backend monitoring
2. Once backend is complete, proceed with Track 2 dashboard
3. Finish with Track 3 testing to ensure reliability
4. Update thread-archives with outcomes

---

**Generated**: 2025-08-28
**Story**: US-101
**Sprint**: 1
**Mode**: Sequential Execution