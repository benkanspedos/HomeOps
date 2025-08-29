import { AlertPriority, AlertMetricType, ComparisonOperator, AlertChannel } from '../services/alert.service';

export interface MonitoringConfig {
  docker: {
    socketPath?: string;
    host?: string;
    port?: number;
    statsInterval: number;
    healthCheckInterval: number;
    maxRetries: number;
    retryDelay: number;
  };
  timescaledb: {
    connectionString: string;
    retentionDays: number;
    aggregationIntervals: {
      fiveMinutes: boolean;
      hourly: boolean;
      daily: boolean;
    };
  };
  alerts: {
    email?: {
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      pass?: string;
      from?: string;
    };
    slack?: {
      webhookUrl?: string;
    };
    discord?: {
      webhookUrl?: string;
    };
    rateLimitMinutes: number;
    maxAlertsPerHour: number;
  };
  defaultThresholds: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    restartCount: number;
    networkMB: number;
  };
  criticalContainers: string[];
  monitoring: {
    enableMetricsCollection: boolean;
    enableHealthChecks: boolean;
    enableAlerts: boolean;
    enableLogging: boolean;
    logLevel: string;
    metricsPort?: number;
  };
}

export const monitoringConfig: MonitoringConfig = {
  docker: {
    // Windows Docker Desktop configuration
    ...(process.platform === 'win32' 
      ? { host: '127.0.0.1', port: 2375 }
      : { socketPath: '/var/run/docker.sock' }
    ),
    statsInterval: parseInt(process.env.MONITORING_INTERVAL || '30000'), // 30 seconds
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },
  
  timescaledb: {
    connectionString: process.env.TIMESCALE_URL || 'postgresql://homeops:homeops123@localhost:5433/metrics',
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
    aggregationIntervals: {
      fiveMinutes: true,
      hourly: true,
      daily: true,
    },
  },
  
  alerts: {
    email: process.env.SMTP_HOST ? {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    } : undefined,
    
    slack: process.env.SLACK_WEBHOOK_URL ? {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    } : undefined,
    
    discord: process.env.DISCORD_WEBHOOK_URL ? {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    } : undefined,
    
    rateLimitMinutes: parseInt(process.env.ALERT_RATE_LIMIT || '15'),
    maxAlertsPerHour: parseInt(process.env.MAX_ALERTS_PER_HOUR || '20'),
  },
  
  defaultThresholds: {
    cpuPercent: parseFloat(process.env.DEFAULT_CPU_THRESHOLD || '80'),
    memoryPercent: parseFloat(process.env.DEFAULT_MEMORY_THRESHOLD || '90'),
    diskPercent: parseFloat(process.env.DEFAULT_DISK_THRESHOLD || '85'),
    restartCount: parseInt(process.env.DEFAULT_RESTART_THRESHOLD || '5'),
    networkMB: parseInt(process.env.DEFAULT_NETWORK_THRESHOLD || '1000'),
  },
  
  // Containers that should always be running
  criticalContainers: [
    'homeops-gluetun',
    'homeops-pihole',
    'homeops-redis',
    'homeops-timescaledb',
    ...(process.env.CRITICAL_CONTAINERS?.split(',') || [])
  ],
  
  monitoring: {
    enableMetricsCollection: process.env.ENABLE_METRICS !== 'false',
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
    enableAlerts: process.env.ENABLE_ALERTS !== 'false',
    enableLogging: process.env.ENABLE_MONITORING_LOGS !== 'false',
    logLevel: process.env.MONITORING_LOG_LEVEL || 'info',
    metricsPort: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : undefined,
  },
};

// Default alert configurations
export const defaultAlertConfigs = [
  {
    name: 'Critical Container Down',
    metricType: AlertMetricType.CONTAINER_STATUS,
    thresholdValue: 0,
    comparisonOperator: ComparisonOperator.EQUAL,
    priority: AlertPriority.CRITICAL,
    channels: [
      { type: AlertChannel.EMAIL, config: {}, enabled: true },
      { type: AlertChannel.SLACK, config: {}, enabled: true },
    ],
    cooldownMinutes: 5,
    description: 'Alert when a critical container is not running',
    enabled: true,
  },
  {
    name: 'High CPU Usage',
    metricType: AlertMetricType.CPU,
    thresholdValue: monitoringConfig.defaultThresholds.cpuPercent,
    comparisonOperator: ComparisonOperator.GREATER_THAN,
    priority: AlertPriority.HIGH,
    channels: [
      { type: AlertChannel.SLACK, config: {}, enabled: true },
    ],
    cooldownMinutes: 15,
    description: 'Alert when container CPU usage is high',
    enabled: true,
  },
  {
    name: 'Critical Memory Usage',
    metricType: AlertMetricType.MEMORY,
    thresholdValue: 95,
    comparisonOperator: ComparisonOperator.GREATER_THAN,
    priority: AlertPriority.CRITICAL,
    channels: [
      { type: AlertChannel.EMAIL, config: {}, enabled: true },
      { type: AlertChannel.SLACK, config: {}, enabled: true },
    ],
    cooldownMinutes: 10,
    description: 'Alert when container memory usage is critically high',
    enabled: true,
  },
  {
    name: 'Excessive Container Restarts',
    metricType: AlertMetricType.RESTART_COUNT,
    thresholdValue: monitoringConfig.defaultThresholds.restartCount,
    comparisonOperator: ComparisonOperator.GREATER_THAN,
    priority: AlertPriority.HIGH,
    channels: [
      { type: AlertChannel.EMAIL, config: {}, enabled: true },
      { type: AlertChannel.SLACK, config: {}, enabled: true },
    ],
    cooldownMinutes: 30,
    description: 'Alert when container restarts excessively',
    enabled: true,
  },
  {
    name: 'Disk Usage Warning',
    metricType: AlertMetricType.DISK,
    thresholdValue: monitoringConfig.defaultThresholds.diskPercent,
    comparisonOperator: ComparisonOperator.GREATER_THAN,
    priority: AlertPriority.MEDIUM,
    channels: [
      { type: AlertChannel.EMAIL, config: {}, enabled: true },
    ],
    cooldownMinutes: 60,
    description: 'Alert when disk usage is getting high',
    enabled: true,
  },
];

// Service health check endpoints
export const serviceHealthEndpoints = {
  'homeops-gluetun': 'http://localhost:8000/health',
  'homeops-pihole': 'http://localhost:8080/admin/api.php?status',
  'homeops-portainer': 'http://localhost:9000/api/status',
  'homeops-backend': 'http://localhost:3101/api/health',
  'homeops-frontend': 'http://localhost:3000/api/health',
};

// Container resource limits
export const containerResourceLimits = {
  'homeops-gluetun': {
    cpuLimit: 0.5, // 50% of one core
    memoryLimitMB: 512,
  },
  'homeops-pihole': {
    cpuLimit: 0.5,
    memoryLimitMB: 512,
  },
  'homeops-redis': {
    cpuLimit: 0.25,
    memoryLimitMB: 256,
  },
  'homeops-timescaledb': {
    cpuLimit: 1.0,
    memoryLimitMB: 1024,
  },
  'homeops-portainer': {
    cpuLimit: 0.25,
    memoryLimitMB: 256,
  },
};

// Monitoring dashboard refresh rates
export const dashboardRefreshRates = {
  realtime: 5000, // 5 seconds
  standard: 30000, // 30 seconds
  slow: 60000, // 1 minute
};

// Export monitoring configuration validator
export function validateMonitoringConfig(config: Partial<MonitoringConfig>): boolean {
  // Basic validation
  if (config.docker) {
    if (!config.docker.socketPath && (!config.docker.host || !config.docker.port)) {
      console.error('Docker configuration requires either socketPath or host/port');
      return false;
    }
  }
  
  if (config.alerts) {
    if (config.alerts.rateLimitMinutes && config.alerts.rateLimitMinutes < 1) {
      console.error('Alert rate limit must be at least 1 minute');
      return false;
    }
  }
  
  if (config.defaultThresholds) {
    const thresholds = config.defaultThresholds;
    if (thresholds.cpuPercent && (thresholds.cpuPercent < 0 || thresholds.cpuPercent > 100)) {
      console.error('CPU threshold must be between 0 and 100');
      return false;
    }
    if (thresholds.memoryPercent && (thresholds.memoryPercent < 0 || thresholds.memoryPercent > 100)) {
      console.error('Memory threshold must be between 0 and 100');
      return false;
    }
  }
  
  return true;
}

export default monitoringConfig;