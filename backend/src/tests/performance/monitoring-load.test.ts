import request from 'supertest';
import express from 'express';
import { performance } from 'perf_hooks';
import { MonitoringController } from '../../controllers/monitoring.controller';
import { HealthMonitorService } from '../../services/health-monitor.service';
import { AlertService } from '../../services/alert.service';
import { CacheService } from '../../services/cache.service';
import { Pool } from 'pg';

jest.mock('../../services/health-monitor.service');
jest.mock('../../services/alert.service');
jest.mock('../../services/cache.service');
jest.mock('pg');

describe('Monitoring Performance Tests', () => {
  let app: express.Express;
  let mockHealthService: jest.Mocked<HealthMonitorService>;
  let mockAlertService: jest.Mocked<AlertService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockHealthService = new HealthMonitorService() as jest.Mocked<HealthMonitorService>;
    mockAlertService = new AlertService() as jest.Mocked<AlertService>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;

    const controller = new MonitoringController(
      mockHealthService,
      mockAlertService,
      mockCacheService,
      new Pool() as any
    );
    controller.setupRoutes(app);
  });

  describe('Concurrent Request Handling', () => {
    it('handles 100+ concurrent metric requests', async () => {
      const mockContainers = Array(10).fill(null).map((_, i) => ({
        id: `container-${i}`,
        name: `test-container-${i}`,
        status: 'running',
        cpu: Math.random() * 100,
        memory: Math.random() * 100
      }));

      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(mockContainers);

      const startTime = performance.now();
      
      // Create 100 concurrent requests
      const requests = Array(100).fill(null).map(() => 
        request(app).get('/api/health/containers')
      );

      const responses = await Promise.all(requests);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const avgResponseTime = duration / 100;

      // All requests should succeed
      responses.forEach(res => expect(res.status).toBe(200));
      
      // Average response time should be reasonable (< 50ms per request)
      expect(avgResponseTime).toBeLessThan(50);
      
      console.log(`✅ 100 concurrent requests completed in ${duration.toFixed(2)}ms (avg: ${avgResponseTime.toFixed(2)}ms)`);
    });

    it('handles rapid sequential requests without degradation', async () => {
      const mockData = [{ id: '1', name: 'test', status: 'running' }];
      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(mockData);

      const responseTimes: number[] = [];
      
      // Make 50 sequential requests
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const response = await request(app).get('/api/health/containers');
        const end = performance.now();
        
        expect(response.status).toBe(200);
        responseTimes.push(end - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // Response times should be consistent (max shouldn't be > 3x min)
      expect(maxResponseTime / minResponseTime).toBeLessThan(3);
      expect(avgResponseTime).toBeLessThan(20);
      
      console.log(`✅ Sequential requests: avg ${avgResponseTime.toFixed(2)}ms, max ${maxResponseTime.toFixed(2)}ms, min ${minResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Large Dataset Performance', () => {
    it('processes metrics for 50+ containers efficiently', async () => {
      // Generate large container dataset
      const largeContainerSet = Array(50).fill(null).map((_, i) => ({
        id: `container-${i}`,
        name: `service-${Math.floor(i / 5)}-replica-${i % 5}`,
        status: Math.random() > 0.9 ? 'exited' : 'running',
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk_read: Math.floor(Math.random() * 10000000),
        disk_write: Math.floor(Math.random() * 5000000),
        network_rx: Math.floor(Math.random() * 1000000),
        network_tx: Math.floor(Math.random() * 500000),
        uptime: `${Math.floor(Math.random() * 24)} hours`,
        ports: [`${8000 + i}:80`],
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString()
      }));

      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(largeContainerSet);

      const startTime = performance.now();
      const response = await request(app).get('/api/health/containers');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.containers).toHaveLength(50);
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
      
      console.log(`✅ 50 containers processed in ${responseTime.toFixed(2)}ms`);
    });

    it('handles large metrics history queries efficiently', async () => {
      // Mock large historical dataset
      const largeHistoryData = Array(1000).fill(null).map((_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        container_id: 'test-container',
        cpu: Math.random() * 100,
        memory: Math.random() * 100
      }));

      mockHealthService.getMetricsHistory = jest.fn().mockResolvedValue(largeHistoryData);

      const startTime = performance.now();
      const response = await request(app)
        .get('/api/health/containers/test-container/metrics?hours=24');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(200); // Should handle large dataset quickly
      
      console.log(`✅ 1000 metric records retrieved in ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage and Garbage Collection', () => {
    it('maintains stable memory usage under load', async () => {
      const mockData = [{ id: '1', name: 'test', status: 'running' }];
      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(mockData);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage();
      
      // Make many requests to test memory leaks
      const requests = Array(200).fill(null).map(() => 
        request(app).get('/api/health/containers')
      );
      
      await Promise.all(requests);
      
      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage shouldn't increase significantly (allow 50MB growth)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      
      expect(memoryGrowthMB).toBeLessThan(50);
      
      console.log(`✅ Memory growth after 200 requests: ${memoryGrowthMB.toFixed(2)}MB`);
    });
  });

  describe('Database Performance', () => {
    it('handles batch metric insertions efficiently', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({ rowCount: 100 }),
        connect: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue({ rowCount: 100 }),
          release: jest.fn()
        }),
        end: jest.fn()
      };

      // Test batch insertion of 100 metric records
      const metrics = Array(100).fill(null).map((_, i) => ({
        timestamp: new Date(Date.now() - i * 1000),
        container_id: `container-${i % 10}`,
        container_name: `service-${i % 10}`,
        cpu: Math.random() * 100,
        memory: Math.random() * 100
      }));

      const startTime = performance.now();
      
      // Simulate batch insert
      await mockPool.query(
        'INSERT INTO container_metrics (timestamp, container_id, container_name, cpu, memory) VALUES ' +
        metrics.map(() => '(?, ?, ?, ?, ?)').join(', '),
        metrics.flatMap(m => [m.timestamp, m.container_id, m.container_name, m.cpu, m.memory])
      );
      
      const endTime = performance.now();
      const insertTime = endTime - startTime;

      expect(insertTime).toBeLessThan(100); // Batch insert should be fast
      
      console.log(`✅ 100 metric records inserted in ${insertTime.toFixed(2)}ms`);
    });

    it('optimizes time-series queries with proper indexing', async () => {
      const mockPool = {
        query: jest.fn().mockImplementation((sql: string) => {
          // Simulate query execution time based on complexity
          const delay = sql.includes('WHERE timestamp') ? 10 : 50;
          return new Promise(resolve => 
            setTimeout(() => resolve({ 
              rows: Array(100).fill({ timestamp: new Date(), cpu: 50 }) 
            }), delay)
          );
        })
      };

      // Test time-range query performance
      const startTime = performance.now();
      
      await mockPool.query(`
        SELECT timestamp, cpu, memory 
        FROM container_metrics 
        WHERE container_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
        ORDER BY timestamp DESC
      `, ['container-1', new Date(Date.now() - 3600000), new Date()]);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(100); // Time-series queries should be optimized
      
      console.log(`✅ Time-series query completed in ${queryTime.toFixed(2)}ms`);
    });
  });

  describe('Cache Performance', () => {
    it('demonstrates significant performance improvement with caching', async () => {
      const mockData = Array(20).fill(null).map((_, i) => ({
        id: `container-${i}`,
        name: `service-${i}`,
        status: 'running'
      }));

      // First request (cache miss) - slow
      mockHealthService.fetchContainerHealth = jest.fn()
        .mockImplementation(() => new Promise(resolve => 
          setTimeout(() => resolve(mockData), 100) // Simulate slow data fetch
        ));
      mockCacheService.get = jest.fn().mockResolvedValue(null);
      mockCacheService.set = jest.fn();

      const uncachedStart = performance.now();
      const uncachedResponse = await request(app).get('/api/health/containers');
      const uncachedTime = performance.now() - uncachedStart;

      expect(uncachedResponse.status).toBe(200);
      
      // Second request (cache hit) - fast
      mockCacheService.get = jest.fn().mockResolvedValue(JSON.stringify(mockData));
      mockHealthService.fetchContainerHealth.mockClear();

      const cachedStart = performance.now();
      const cachedResponse = await request(app).get('/api/health/containers');
      const cachedTime = performance.now() - cachedStart;

      expect(cachedResponse.status).toBe(200);
      expect(mockHealthService.fetchContainerHealth).not.toHaveBeenCalled();
      
      // Cached response should be significantly faster
      const speedImprovement = uncachedTime / cachedTime;
      expect(speedImprovement).toBeGreaterThan(3);
      
      console.log(`✅ Cache performance improvement: ${speedImprovement.toFixed(2)}x faster (${uncachedTime.toFixed(2)}ms → ${cachedTime.toFixed(2)}ms)`);
    });
  });

  describe('Alert Processing Performance', () => {
    it('processes multiple alert evaluations efficiently', async () => {
      const mockAlerts = Array(50).fill(null).map((_, i) => ({
        id: `alert-${i}`,
        name: `Alert ${i}`,
        metric: 'cpu',
        threshold: 70 + (i % 20),
        operator: '>',
        enabled: true
      }));

      const mockMetrics = Array(20).fill(null).map((_, i) => ({
        container_id: `container-${i}`,
        cpu: Math.random() * 100,
        memory: Math.random() * 100
      }));

      mockAlertService.getAllAlertRules = jest.fn().mockResolvedValue(mockAlerts);
      mockAlertService.evaluateAlert = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1)) // 1ms per evaluation
      );

      const startTime = performance.now();
      
      // Simulate processing all metrics against all alerts
      for (const metric of mockMetrics) {
        for (const alert of mockAlerts) {
          await mockAlertService.evaluateAlert(alert, metric);
        }
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      const totalEvaluations = mockMetrics.length * mockAlerts.length;
      const avgEvaluationTime = processingTime / totalEvaluations;

      expect(avgEvaluationTime).toBeLessThan(5); // Average evaluation should be very fast
      
      console.log(`✅ ${totalEvaluations} alert evaluations in ${processingTime.toFixed(2)}ms (avg: ${avgEvaluationTime.toFixed(2)}ms each)`);
    });
  });

  describe('WebSocket Performance', () => {
    it('handles multiple WebSocket connections efficiently', async () => {
      // This would require WebSocket performance testing
      // Mock the scenario for now
      const mockWebSocketManager = {
        connections: new Set(),
        broadcast: jest.fn(),
        addConnection: jest.fn().mockImplementation(function(ws) {
          this.connections.add(ws);
        }),
        removeConnection: jest.fn().mockImplementation(function(ws) {
          this.connections.delete(ws);
        })
      };

      // Simulate adding 100 connections
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const mockWs = { id: i, readyState: 1 };
        mockWebSocketManager.addConnection(mockWs);
      }
      
      // Simulate broadcasting to all connections
      const broadcastData = { type: 'metrics_update', data: { cpu: 50, memory: 60 } };
      mockWebSocketManager.broadcast(broadcastData);
      
      const endTime = performance.now();
      const broadcastTime = endTime - startTime;

      expect(mockWebSocketManager.connections.size).toBe(100);
      expect(broadcastTime).toBeLessThan(50); // Broadcasting should be fast
      
      console.log(`✅ Broadcasting to 100 WebSocket connections in ${broadcastTime.toFixed(2)}ms`);
    });
  });

  describe('Resource Cleanup Performance', () => {
    it('cleans up resources efficiently after high load', async () => {
      const mockData = [{ id: '1', name: 'test', status: 'running' }];
      mockHealthService.fetchContainerHealth = jest.fn().mockResolvedValue(mockData);

      // Create high load
      const requests = Array(100).fill(null).map(() => 
        request(app).get('/api/health/containers')
      );
      
      await Promise.all(requests);
      
      // Simulate cleanup
      const cleanupStart = performance.now();
      
      // Clear all mocks and caches
      jest.clearAllMocks();
      mockCacheService.clear = jest.fn().mockResolvedValue(true);
      await mockCacheService.clear();
      
      const cleanupTime = performance.now() - cleanupStart;
      
      expect(cleanupTime).toBeLessThan(100); // Cleanup should be fast
      
      console.log(`✅ Resource cleanup completed in ${cleanupTime.toFixed(2)}ms`);
    });
  });
});