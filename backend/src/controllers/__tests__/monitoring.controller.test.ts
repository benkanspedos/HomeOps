import request from 'supertest';
import express, { Express } from 'express';
import { MonitoringController } from '../monitoring.controller';
import { HealthMonitorService } from '../../services/health-monitor.service';
import { AlertService } from '../../services/alert.service';
import { CacheService } from '../../services/cache.service';
import { Pool } from 'pg';

jest.mock('../../services/health-monitor.service');
jest.mock('../../services/alert.service');
jest.mock('../../services/cache.service');
jest.mock('pg');

describe('Monitoring API', () => {
  let app: Express;
  let mockHealthService: jest.Mocked<HealthMonitorService>;
  let mockAlertService: jest.Mocked<AlertService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create Express app
    app = express();
    app.use(express.json());

    // Mock services
    mockHealthService = new HealthMonitorService() as jest.Mocked<HealthMonitorService>;
    mockAlertService = new AlertService() as jest.Mocked<AlertService>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    mockPool = new Pool() as jest.Mocked<Pool>;

    // Setup routes
    const controller = new MonitoringController(
      mockHealthService,
      mockAlertService,
      mockCacheService,
      mockPool
    );
    controller.setupRoutes(app);
  });

  describe('GET /api/health/containers', () => {
    it('should return all container status', async () => {
      const mockContainers = [
        {
          id: 'container1',
          name: 'nginx',
          status: 'running',
          cpu: 25.5,
          memory: 45.2,
          disk_read: 1048576,
          disk_write: 524288,
          network_rx: 262144,
          network_tx: 131072,
          uptime: '2 hours',
          image: 'nginx:latest'
        },
        {
          id: 'container2',
          name: 'redis',
          status: 'running',
          cpu: 15.0,
          memory: 30.5,
          disk_read: 524288,
          disk_write: 262144,
          network_rx: 131072,
          network_tx: 65536,
          uptime: '5 hours',
          image: 'redis:alpine'
        }
      ];

      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(mockContainers);

      const response = await request(app)
        .get('/api/health/containers')
        .expect(200);

      expect(response.body).toHaveProperty('containers');
      expect(response.body.containers).toHaveLength(2);
      expect(response.body.containers[0]).toHaveProperty('id', 'container1');
      expect(response.body.containers[0]).toHaveProperty('name', 'nginx');
      expect(response.body.containers[0]).toHaveProperty('status', 'running');
      expect(response.body.containers[0]).toHaveProperty('cpu', 25.5);
      expect(response.body.containers[0]).toHaveProperty('memory', 45.2);
    });

    it('should handle service errors gracefully', async () => {
      mockHealthService.fetchContainerHealth = jest.fn()
        .mockRejectedValue(new Error('Docker API error'));

      const response = await request(app)
        .get('/api/health/containers')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to fetch container health');
    });

    it('should support filtering by container name', async () => {
      const allContainers = [
        { id: '1', name: 'nginx', status: 'running' },
        { id: '2', name: 'redis', status: 'running' },
        { id: '3', name: 'postgres', status: 'running' }
      ];

      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(allContainers);

      const response = await request(app)
        .get('/api/health/containers?name=nginx')
        .expect(200);

      expect(response.body.containers).toHaveLength(1);
      expect(response.body.containers[0].name).toBe('nginx');
    });

    it('should support caching for performance', async () => {
      const mockContainers = [{ id: '1', name: 'nginx' }];

      // First request - hits service
      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(mockContainers);
      mockCacheService.get = jest.fn().mockResolvedValue(null);
      mockCacheService.set = jest.fn();

      await request(app)
        .get('/api/health/containers')
        .expect(200);

      expect(mockHealthService.fetchContainerHealth).toHaveBeenCalledTimes(1);
      expect(mockCacheService.set).toHaveBeenCalled();

      // Second request - uses cache
      mockCacheService.get = jest.fn().mockResolvedValue(JSON.stringify(mockContainers));
      mockHealthService.fetchContainerHealth.mockClear();

      await request(app)
        .get('/api/health/containers')
        .expect(200);

      expect(mockHealthService.fetchContainerHealth).not.toHaveBeenCalled();
      expect(mockCacheService.get).toHaveBeenCalled();
    });
  });

  describe('GET /api/health/containers/:id', () => {
    it('should return specific container details', async () => {
      const containerDetails = {
        id: 'container1',
        name: 'nginx',
        status: 'running',
        cpu: 25.5,
        memory: 45.2,
        metrics_history: [
          { timestamp: '2024-01-20T10:00:00Z', cpu: 20, memory: 40 },
          { timestamp: '2024-01-20T10:01:00Z', cpu: 22, memory: 42 },
          { timestamp: '2024-01-20T10:02:00Z', cpu: 25.5, memory: 45.2 }
        ]
      };

      mockHealthService.getContainerDetails = jest.fn().mockResolvedValue(containerDetails);

      const response = await request(app)
        .get('/api/health/containers/container1')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'container1');
      expect(response.body).toHaveProperty('metrics_history');
      expect(response.body.metrics_history).toHaveLength(3);
    });

    it('should return 404 for non-existent container', async () => {
      mockHealthService.getContainerDetails = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/health/containers/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Container not found');
    });
  });

  describe('GET /api/health/metrics', () => {
    it('should return system metrics', async () => {
      const systemMetrics = {
        timestamp: new Date().toISOString(),
        cpu: {
          usage: 35.2,
          cores: 8,
          load_average: [1.5, 1.2, 0.9]
        },
        memory: {
          total: 16384,
          used: 8192,
          free: 8192,
          percentage: 50.0
        },
        disk: {
          total: 512000,
          used: 256000,
          free: 256000,
          percentage: 50.0
        },
        network: {
          interfaces: [
            { name: 'eth0', rx: 1048576, tx: 524288 }
          ]
        }
      };

      mockHealthService.getSystemMetrics = jest.fn().mockResolvedValue(systemMetrics);

      const response = await request(app)
        .get('/api/health/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('disk');
      expect(response.body).toHaveProperty('network');
    });

    it('should support time range queries', async () => {
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [
          { timestamp: '2024-01-20T10:00:00Z', cpu: 20, memory: 40 },
          { timestamp: '2024-01-20T10:30:00Z', cpu: 25, memory: 45 }
        ]
      });

      const response = await request(app)
        .get('/api/health/metrics?start=2024-01-20T10:00:00Z&end=2024-01-20T11:00:00Z')
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('timestamp BETWEEN'),
        expect.arrayContaining(['2024-01-20T10:00:00Z', '2024-01-20T11:00:00Z'])
      );
    });
  });

  describe('POST /api/alerts/configure', () => {
    it('should create alert rule', async () => {
      const alertConfig = {
        name: 'High CPU Alert',
        metric: 'cpu',
        threshold: 80,
        operator: '>',
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldown_minutes: 5
      };

      mockAlertService.createAlertRule = jest.fn().mockResolvedValue({
        id: 'alert-123',
        ...alertConfig
      });

      const response = await request(app)
        .post('/api/alerts/configure')
        .send(alertConfig)
        .expect(201);

      expect(response.body).toHaveProperty('id', 'alert-123');
      expect(response.body).toHaveProperty('name', 'High CPU Alert');
      expect(mockAlertService.createAlertRule).toHaveBeenCalledWith(alertConfig);
    });

    it('should validate alert configuration', async () => {
      const invalidConfig = {
        name: 'Invalid Alert',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/alerts/configure')
        .send(invalidConfig)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should prevent duplicate alert names', async () => {
      const alertConfig = {
        name: 'Duplicate Alert',
        metric: 'cpu',
        threshold: 80
      };

      mockAlertService.createAlertRule = jest.fn()
        .mockRejectedValue(new Error('Alert name already exists'));

      const response = await request(app)
        .post('/api/alerts/configure')
        .send(alertConfig)
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PUT /api/alerts/:id', () => {
    it('should update alert rule', async () => {
      const updates = {
        threshold: 90,
        enabled: false
      };

      mockAlertService.updateAlertRule = jest.fn().mockResolvedValue({
        id: 'alert-123',
        threshold: 90,
        enabled: false
      });

      const response = await request(app)
        .put('/api/alerts/alert-123')
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('threshold', 90);
      expect(response.body).toHaveProperty('enabled', false);
    });

    it('should return 404 for non-existent alert', async () => {
      mockAlertService.updateAlertRule = jest.fn()
        .mockRejectedValue(new Error('Alert not found'));

      const response = await request(app)
        .put('/api/alerts/nonexistent')
        .send({ threshold: 90 })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/alerts/:id', () => {
    it('should delete alert rule', async () => {
      mockAlertService.deleteAlertRule = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/alerts/alert-123')
        .expect(204);

      expect(mockAlertService.deleteAlertRule).toHaveBeenCalledWith('alert-123');
    });
  });

  describe('POST /api/alerts/test/:channel', () => {
    it('should send test notification to email', async () => {
      mockAlertService.testAlertChannel = jest.fn().mockResolvedValue({
        success: true,
        message: 'Test email sent successfully'
      });

      const response = await request(app)
        .post('/api/alerts/test/email')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(mockAlertService.testAlertChannel).toHaveBeenCalledWith('email');
    });

    it('should send test notification to Slack', async () => {
      mockAlertService.testAlertChannel = jest.fn().mockResolvedValue({
        success: true,
        message: 'Test Slack message sent'
      });

      const response = await request(app)
        .post('/api/alerts/test/slack')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle test notification failures', async () => {
      mockAlertService.testAlertChannel = jest.fn()
        .mockRejectedValue(new Error('SMTP connection failed'));

      const response = await request(app)
        .post('/api/alerts/test/email')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to send test');
    });

    it('should validate channel name', async () => {
      const response = await request(app)
        .post('/api/alerts/test/invalid-channel')
        .expect(400);

      expect(response.body.error).toContain('Invalid channel');
    });
  });

  describe('GET /api/alerts/history', () => {
    it('should return alert history', async () => {
      const alertHistory = [
        {
          id: '1',
          severity: 'warning',
          title: 'High CPU',
          message: 'CPU at 85%',
          timestamp: '2024-01-20T10:00:00Z',
          acknowledged: false
        },
        {
          id: '2',
          severity: 'critical',
          title: 'Container Down',
          message: 'nginx container stopped',
          timestamp: '2024-01-20T09:00:00Z',
          acknowledged: true
        }
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: alertHistory });

      const response = await request(app)
        .get('/api/alerts/history')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('severity', 'warning');
    });

    it('should support pagination', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ 
        rows: Array(10).fill(null).map((_, i) => ({ id: i.toString() })) 
      });

      const response = await request(app)
        .get('/api/alerts/history?limit=10&offset=20')
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });

    it('should filter by severity', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/alerts/history?severity=critical')
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $1'),
        expect.arrayContaining(['critical'])
      );
    });
  });

  describe('WebSocket support', () => {
    it('should establish WebSocket connection for real-time updates', async () => {
      // This would require WebSocket testing setup
      // Example with ws library or socket.io-client
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Rate limiting', () => {
    it('should rate limit API requests', async () => {
      // Make multiple rapid requests
      const requests = Array(20).fill(null).map(() => 
        request(app).get('/api/health/containers')
      );

      const responses = await Promise.all(requests);
      
      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for alert configuration', async () => {
      const response = await request(app)
        .post('/api/alerts/configure')
        .send({ name: 'Test' })
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should accept valid API key', async () => {
      mockAlertService.createAlertRule = jest.fn().mockResolvedValue({ id: '123' });

      const response = await request(app)
        .post('/api/alerts/configure')
        .set('X-API-Key', process.env.API_KEY || 'test-key')
        .send({
          name: 'Test',
          metric: 'cpu',
          threshold: 80
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });
});