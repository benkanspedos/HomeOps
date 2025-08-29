import { HealthMonitorService } from '../health-monitor.service';
import Docker from 'dockerode';
import { Pool } from 'pg';
import { CacheService } from '../cache.service';
import { AlertService } from '../alert.service';

jest.mock('dockerode');
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }))
}));
jest.mock('../cache.service');
jest.mock('../alert.service');

describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let mockDocker: jest.Mocked<Docker>;
  let mockPool: jest.Mocked<Pool>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockAlertService: jest.Mocked<AlertService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDocker = new Docker() as jest.Mocked<Docker>;
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    mockAlertService = new AlertService() as jest.Mocked<AlertService>;
    
    service = new HealthMonitorService(mockDocker, mockPool, mockCacheService, mockAlertService);
  });

  describe('fetchContainerHealth', () => {
    it('should fetch container health from Docker API', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Names: ['/nginx'],
          State: 'running',
          Status: 'Up 2 hours',
          Stats: {
            cpu_stats: {
              cpu_usage: {
                total_usage: 1000000000,
                percpu_usage: [500000000, 500000000]
              },
              system_cpu_usage: 10000000000,
              online_cpus: 2
            },
            memory_stats: {
              usage: 104857600,
              limit: 2147483648
            },
            blkio_stats: {
              io_service_bytes_recursive: [
                { op: 'read', value: 1048576 },
                { op: 'write', value: 2097152 }
              ]
            },
            networks: {
              eth0: {
                rx_bytes: 524288,
                tx_bytes: 262144
              }
            }
          }
        }
      ];

      mockDocker.listContainers = jest.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = jest.fn().mockReturnValue({
        stats: jest.fn().mockResolvedValue(mockContainers[0].Stats)
      } as any);

      const result = await service.fetchContainerHealth();

      expect(mockDocker.listContainers).toHaveBeenCalledWith({ all: false });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'container1');
      expect(result[0]).toHaveProperty('name', 'nginx');
      expect(result[0]).toHaveProperty('status', 'running');
      expect(result[0]).toHaveProperty('cpu');
      expect(result[0]).toHaveProperty('memory');
    });

    it('should handle Docker API failures gracefully', async () => {
      mockDocker.listContainers = jest.fn().mockRejectedValue(new Error('Docker API error'));
      mockCacheService.get = jest.fn().mockResolvedValue(JSON.stringify([
        { id: 'cached1', name: 'nginx', status: 'running' }
      ]));

      const result = await service.fetchContainerHealth();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'cached1');
      expect(mockAlertService.sendAlert).toHaveBeenCalledWith(
        'error',
        'Docker API Connection Failed',
        expect.any(String)
      );
    });

    it('should calculate CPU usage percentage correctly', async () => {
      const mockStats = {
        cpu_stats: {
          cpu_usage: { total_usage: 2000000000 },
          system_cpu_usage: 20000000000,
          online_cpus: 4
        },
        precpu_stats: {
          cpu_usage: { total_usage: 1000000000 },
          system_cpu_usage: 10000000000
        }
      };

      const cpuPercentage = service['calculateCPUPercentage'](mockStats);
      expect(cpuPercentage).toBeCloseTo(10.0, 1);
    });

    it('should calculate memory usage percentage correctly', async () => {
      const mockStats = {
        memory_stats: {
          usage: 536870912, // 512MB
          limit: 2147483648  // 2GB
        }
      };

      const memoryPercentage = service['calculateMemoryPercentage'](mockStats);
      expect(memoryPercentage).toBeCloseTo(25.0, 1);
    });
  });

  describe('storeMetrics', () => {
    it('should store metrics in TimescaleDB', async () => {
      const metrics = [
        {
          id: 'container1',
          name: 'nginx',
          cpu: 15.5,
          memory: 45.2,
          disk_read: 1048576,
          disk_write: 2097152,
          network_rx: 524288,
          network_tx: 262144
        }
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      await service.storeMetrics(metrics);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO container_metrics'),
        expect.arrayContaining(['container1', 'nginx', 15.5, 45.2])
      );
    });

    it('should handle database write failures', async () => {
      const metrics = [{ id: 'container1', name: 'nginx', cpu: 15.5 }];
      mockPool.query = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.storeMetrics(metrics)).rejects.toThrow('Database error');
      expect(mockAlertService.sendAlert).toHaveBeenCalledWith(
        'critical',
        'Database Write Failed',
        expect.any(String)
      );
    });

    it('should verify hypertable storage and data retention', async () => {
      const hypertableQuery = `
        SELECT * FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'container_metrics'
      `;
      
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ hypertable_name: 'container_metrics' }] })
        .mockResolvedValueOnce({ rowCount: 100 });

      const isHypertable = await service.verifyHypertable();
      expect(isHypertable).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('hypertable'));
    });

    it('should implement data retention policy', async () => {
      const retentionQuery = `
        SELECT drop_chunks('container_metrics', INTERVAL '30 days')
      `;

      mockPool.query = jest.fn().mockResolvedValue({ rows: [{ dropped_chunks: 5 }] });

      const droppedChunks = await service.applyRetentionPolicy(30);
      expect(droppedChunks).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('drop_chunks'));
    });
  });

  describe('checkThresholds', () => {
    it('should trigger alerts when thresholds are exceeded', async () => {
      const metrics = {
        id: 'container1',
        name: 'nginx',
        cpu: 85,
        memory: 45,
        status: 'running'
      };

      const thresholds = {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 80, critical: 95 }
      };

      await service.checkThresholds(metrics, thresholds);

      expect(mockAlertService.sendAlert).toHaveBeenCalledWith(
        'warning',
        'High CPU Usage',
        expect.stringContaining('nginx')
      );
    });

    it('should not trigger alerts when metrics are within thresholds', async () => {
      const metrics = {
        id: 'container1',
        name: 'nginx',
        cpu: 30,
        memory: 45,
        status: 'running'
      };

      const thresholds = {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 80, critical: 95 }
      };

      await service.checkThresholds(metrics, thresholds);

      expect(mockAlertService.sendAlert).not.toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should cache container health data', async () => {
      const healthData = [
        { id: 'container1', name: 'nginx', status: 'running' }
      ];

      await service.cacheHealthData(healthData);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'container:health:all',
        JSON.stringify(healthData),
        300
      );
    });

    it('should use cached data when Docker API is unavailable', async () => {
      mockDocker.listContainers = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockCacheService.get = jest.fn().mockResolvedValue(JSON.stringify([
        { id: 'cached1', name: 'nginx', status: 'running' }
      ]));

      const result = await service.fetchContainerHealth();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cached1');
      expect(mockCacheService.get).toHaveBeenCalledWith('container:health:all');
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start monitoring with correct interval', async () => {
      jest.useFakeTimers();
      const fetchSpy = jest.spyOn(service, 'fetchContainerHealth').mockResolvedValue([]);
      
      service.startMonitoring(10000); // 10 second interval
      
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Initial call
      
      jest.advanceTimersByTime(10000);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      
      jest.advanceTimersByTime(10000);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      
      service.stopMonitoring();
      jest.useRealTimers();
    });

    it('should stop monitoring when requested', async () => {
      jest.useFakeTimers();
      const fetchSpy = jest.spyOn(service, 'fetchContainerHealth').mockResolvedValue([]);
      
      service.startMonitoring(5000);
      jest.advanceTimersByTime(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      
      service.stopMonitoring();
      jest.advanceTimersByTime(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // No additional calls
      
      jest.useRealTimers();
    });
  });
});