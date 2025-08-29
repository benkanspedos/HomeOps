import Docker from 'dockerode';
import { Pool } from 'pg';
import * as schedule from 'node-schedule';
import { EventEmitter } from 'events';
import winston from 'winston';

interface ContainerHealth {
  containerId: string;
  containerName: string;
  image: string;
  status: string;
  state: string;
  healthStatus?: string;
  uptime: number;
  restartCount: number;
  created: Date;
  started?: Date;
}

interface ContainerMetrics {
  containerId: string;
  containerName: string;
  cpuPercent: number;
  memoryUsageMB: number;
  memoryPercent: number;
  networkRxBytes: bigint;
  networkTxBytes: bigint;
  blockRead: bigint;
  blockWrite: bigint;
  timestamp: Date;
}

interface SystemMetrics {
  totalCPU: number;
  totalMemoryMB: number;
  usedMemoryMB: number;
  memoryPercent: number;
  diskUsageMB: number;
  diskPercent: number;
  containerCount: number;
  runningContainers: number;
  timestamp: Date;
}

export class HealthMonitorService extends EventEmitter {
  private docker: Docker;
  private pgPool: Pool;
  private logger: winston.Logger;
  private monitoringInterval: number;
  private metricsJob?: schedule.Job;
  private containerHealthCache: Map<string, ContainerHealth>;
  private isWindows: boolean;

  constructor(pgConnectionString?: string) {
    super();
    
    // Detect if running on Windows
    this.isWindows = process.platform === 'win32';
    
    // Initialize Docker client
    if (this.isWindows) {
      // Windows Docker Desktop uses named pipe
      this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
    } else {
      // Linux/Mac uses socket
      this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    }
    
    // Initialize PostgreSQL connection pool
    const connectionString = pgConnectionString || process.env.TIMESCALE_URL || 
      'postgresql://homeops:homeops123@localhost:5433/metrics';
    
    this.pgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
        new winston.transports.File({ 
          filename: 'logs/health-monitor.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
    });
    
    this.monitoringInterval = parseInt(process.env.MONITORING_INTERVAL || '30000');
    this.containerHealthCache = new Map();
  }

  async initialize(): Promise<void> {
    try {
      // Test Docker connection
      await this.docker.ping();
      this.logger.info('Docker connection established');
      
      // Test PostgreSQL connection
      await this.pgPool.query('SELECT NOW()');
      this.logger.info('TimescaleDB connection established');
      
      // Start monitoring
      this.startMonitoring();
      
    } catch (error) {
      this.logger.error('Failed to initialize health monitor', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    // Schedule metrics collection every interval
    const rule = new schedule.RecurrenceRule();
    rule.second = Array.from({ length: 60 }, (_, i) => 
      i % Math.floor(this.monitoringInterval / 1000) === 0 ? i : null
    ).filter(x => x !== null);
    
    this.metricsJob = schedule.scheduleJob(rule, async () => {
      await this.collectAllMetrics();
    });
    
    this.logger.info(`Health monitoring started with ${this.monitoringInterval}ms interval`);
    
    // Initial collection
    this.collectAllMetrics();
  }

  async stopMonitoring(): Promise<void> {
    if (this.metricsJob) {
      this.metricsJob.cancel();
      this.metricsJob = undefined;
    }
    await this.pgPool.end();
    this.logger.info('Health monitoring stopped');
  }

  async checkContainerHealth(containerId?: string): Promise<ContainerHealth[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const healthStatuses: ContainerHealth[] = [];
      
      for (const containerInfo of containers) {
        // Skip if specific container requested and this isn't it
        if (containerId && !containerInfo.Id.startsWith(containerId)) {
          continue;
        }
        
        const container = this.docker.getContainer(containerInfo.Id);
        
        try {
          const inspect = await container.inspect();
          
          const health: ContainerHealth = {
            containerId: inspect.Id,
            containerName: inspect.Name.replace(/^\//, ''),
            image: inspect.Config.Image,
            status: containerInfo.Status,
            state: inspect.State.Status,
            healthStatus: inspect.State.Health?.Status,
            uptime: this.calculateUptime(inspect.State.StartedAt),
            restartCount: inspect.RestartCount || 0,
            created: new Date(inspect.Created),
            started: inspect.State.StartedAt ? new Date(inspect.State.StartedAt) : undefined,
          };
          
          healthStatuses.push(health);
          this.containerHealthCache.set(inspect.Id, health);
          
          // Check for issues
          if (health.state !== 'running' && inspect.Config.Labels?.['homeops.priority'] === 'critical') {
            this.emit('container:down', health);
          }
          
          if (health.restartCount > 5) {
            this.emit('container:restart-loop', health);
          }
          
          if (health.healthStatus === 'unhealthy') {
            this.emit('container:unhealthy', health);
          }
          
        } catch (error) {
          this.logger.error(`Failed to inspect container ${containerInfo.Id}`, error);
        }
      }
      
      return healthStatuses;
    } catch (error) {
      this.logger.error('Failed to check container health', error);
      throw error;
    }
  }

  async collectMetrics(containerId?: string): Promise<ContainerMetrics[]> {
    try {
      const containers = await this.docker.listContainers({ all: false }); // Only running
      const metrics: ContainerMetrics[] = [];
      
      for (const containerInfo of containers) {
        // Skip if specific container requested and this isn't it
        if (containerId && !containerInfo.Id.startsWith(containerId)) {
          continue;
        }
        
        const container = this.docker.getContainer(containerInfo.Id);
        
        try {
          const stats = await container.stats({ stream: false });
          
          // Calculate CPU percentage
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                          (stats.precpu_stats.cpu_usage?.total_usage || 0);
          const systemDelta = stats.cpu_stats.system_cpu_usage - 
                             (stats.precpu_stats.system_cpu_usage || 0);
          const cpuPercent = systemDelta > 0 ? 
            (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
          
          // Calculate memory usage
          const memoryUsage = stats.memory_stats?.usage || 0;
          const memoryLimit = stats.memory_stats.limit || 1;
          const memoryPercent = (memoryUsage / memoryLimit) * 100;
          
          const metric: ContainerMetrics = {
            containerId: containerInfo.Id,
            containerName: containerInfo.Names[0].replace(/^\//, ''),
            cpuPercent: Math.round(cpuPercent * 100) / 100,
            memoryUsageMB: Math.round((memoryUsage / 1024 / 1024) * 100) / 100,
            memoryPercent: Math.round(memoryPercent * 100) / 100,
            networkRxBytes: BigInt(stats.networks?.eth0?.rx_bytes || 0),
            networkTxBytes: BigInt(stats.networks?.eth0?.tx_bytes || 0),
            blockRead: BigInt(stats.blkio_stats?.io_service_bytes_recursive?.find(
              (s: any) => s.op === 'Read')?.value || 0),
            blockWrite: BigInt(stats.blkio_stats?.io_service_bytes_recursive?.find(
              (s: any) => s.op === 'Write')?.value || 0),
            timestamp: new Date(),
          };
          
          metrics.push(metric);
          
          // Store in TimescaleDB
          await this.storeMetrics(metric);
          
          // Check thresholds
          if (cpuPercent > 80) {
            this.emit('threshold:cpu-high', { container: metric, threshold: 80 });
          }
          
          if (memoryPercent > 90) {
            this.emit('threshold:memory-high', { container: metric, threshold: 90 });
          }
          
        } catch (error) {
          this.logger.error(`Failed to collect metrics for container ${containerInfo.Id}`, error);
        }
      }
      
      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect metrics', error);
      throw error;
    }
  }

  async getUptime(containerId: string): Promise<number> {
    try {
      const container = this.docker.getContainer(containerId);
      const inspect = await container.inspect();
      
      if (inspect.State.StartedAt) {
        return this.calculateUptime(inspect.State.StartedAt);
      }
      
      return 0;
    } catch (error) {
      this.logger.error(`Failed to get uptime for container ${containerId}`, error);
      return 0;
    }
  }

  async getResourceUsage(): Promise<SystemMetrics> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const runningContainers = containers.filter(c => c.State === 'running');
      
      let totalCPU = 0;
      let totalMemoryMB = 0;
      let usedMemoryMB = 0;
      
      // Collect metrics from all running containers
      for (const containerInfo of runningContainers) {
        const container = this.docker.getContainer(containerInfo.Id);
        
        try {
          const stats = await container.stats({ stream: false });
          
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                          (stats.precpu_stats.cpu_usage?.total_usage || 0);
          const systemDelta = stats.cpu_stats.system_cpu_usage - 
                             (stats.precpu_stats.system_cpu_usage || 0);
          const cpuPercent = systemDelta > 0 ? 
            (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
          
          totalCPU += cpuPercent;
          usedMemoryMB += (stats.memory_stats.usage || 0) / 1024 / 1024;
          totalMemoryMB += (stats.memory_stats.limit || 0) / 1024 / 1024;
          
        } catch (error) {
          this.logger.error(`Failed to get stats for container ${containerInfo.Id}`, error);
        }
      }
      
      // Get Docker system info
      const info = await this.docker.info();
      const systemDF = await this.docker.df();
      
      const diskUsageMB = systemDF.Images?.reduce((acc: number, img: any) => 
        acc + (img.Size || 0), 0) / 1024 / 1024 || 0;
      
      const systemMetrics: SystemMetrics = {
        totalCPU: Math.round(totalCPU * 100) / 100,
        totalMemoryMB: Math.round(totalMemoryMB * 100) / 100,
        usedMemoryMB: Math.round(usedMemoryMB * 100) / 100,
        memoryPercent: totalMemoryMB > 0 ? 
          Math.round((usedMemoryMB / totalMemoryMB) * 10000) / 100 : 0,
        diskUsageMB: Math.round(diskUsageMB * 100) / 100,
        diskPercent: 0, // Would need to get total disk size from host
        containerCount: containers.length,
        runningContainers: runningContainers.length,
        timestamp: new Date(),
      };
      
      // Store system metrics
      await this.storeSystemMetrics(systemMetrics);
      
      return systemMetrics;
    } catch (error) {
      this.logger.error('Failed to get resource usage', error);
      throw error;
    }
  }

  async getMetricsHistory(
    containerId: string, 
    hours: number = 24
  ): Promise<ContainerMetrics[]> {
    try {
      const query = `
        SELECT 
          container_id as "containerId",
          container_name as "containerName",
          cpu_percent as "cpuPercent",
          memory_usage_mb as "memoryUsageMB",
          memory_percent as "memoryPercent",
          network_rx_bytes as "networkRxBytes",
          network_tx_bytes as "networkTxBytes",
          time as timestamp
        FROM health_metrics
        WHERE container_id = $1
          AND time > NOW() - INTERVAL '${hours} hours'
        ORDER BY time DESC
      `;
      
      const result = await this.pgPool.query(query, [containerId]);
      
      return result.rows.map(row => ({
        ...row,
        networkRxBytes: BigInt(row.networkRxBytes || 0),
        networkTxBytes: BigInt(row.networkTxBytes || 0),
        blockRead: BigInt(0),
        blockWrite: BigInt(0),
      }));
    } catch (error) {
      this.logger.error('Failed to get metrics history', error);
      throw error;
    }
  }

  private async storeMetrics(metrics: ContainerMetrics): Promise<void> {
    try {
      const query = `
        INSERT INTO health_metrics (
          time,
          container_id,
          container_name,
          cpu_percent,
          memory_usage_mb,
          memory_percent,
          network_rx_bytes,
          network_tx_bytes,
          status,
          health_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      const health = this.containerHealthCache.get(metrics.containerId);
      
      await this.pgPool.query(query, [
        metrics.timestamp,
        metrics.containerId,
        metrics.containerName,
        metrics.cpuPercent,
        metrics.memoryUsageMB,
        metrics.memoryPercent,
        metrics.networkRxBytes.toString(),
        metrics.networkTxBytes.toString(),
        health?.state || 'unknown',
        health?.healthStatus || 'none'
      ]);
      
    } catch (error) {
      this.logger.error('Failed to store metrics', error);
    }
  }

  private async storeSystemMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      const query = `
        INSERT INTO system_metrics (
          time,
          total_cpu_percent,
          total_memory_mb,
          used_memory_mb,
          memory_percent,
          disk_usage_mb,
          disk_percent,
          container_count,
          running_containers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await this.pgPool.query(query, [
        metrics.timestamp,
        metrics.totalCPU,
        metrics.totalMemoryMB,
        metrics.usedMemoryMB,
        metrics.memoryPercent,
        metrics.diskUsageMB,
        metrics.diskPercent,
        metrics.containerCount,
        metrics.runningContainers
      ]);
      
    } catch (error) {
      this.logger.error('Failed to store system metrics', error);
    }
  }

  private async collectAllMetrics(): Promise<void> {
    try {
      this.logger.debug('Collecting all metrics...');
      
      // Collect container health
      await this.checkContainerHealth();
      
      // Collect container metrics
      await this.collectMetrics();
      
      // Collect system metrics
      await this.getResourceUsage();
      
      this.logger.debug('Metrics collection completed');
      
    } catch (error) {
      this.logger.error('Failed to collect all metrics', error);
    }
  }

  private calculateUptime(startedAt: string | Date): number {
    if (!startedAt) return 0;
    
    const started = new Date(startedAt);
    const now = new Date();
    const uptimeMs = now.getTime() - started.getTime();
    
    return Math.floor(uptimeMs / 1000); // Return seconds
  }

  async getContainerLogs(
    containerId: string, 
    lines: number = 100
  ): Promise<string[]> {
    try {
      const container = this.docker.getContainer(containerId);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail: lines,
        timestamps: true
      });
      
      const logs = stream.toString('utf-8').split('\n').filter(line => line);
      return logs;
      
    } catch (error) {
      this.logger.error(`Failed to get logs for container ${containerId}`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitorService();
export default healthMonitor;