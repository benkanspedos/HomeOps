// Monitoring System Types and Interfaces

export interface ContainerHealth {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting' | 'error' | 'unknown';
  state: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none';
  uptime: number; // seconds
  restartCount: number;
  created: Date;
  started?: Date;
  lastCheck: Date;
}

export interface ContainerMetrics {
  containerId: string;
  containerName: string;
  cpuPercent: number;
  memoryUsageMB: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  diskUsageMB?: number;
  timestamp: Date;
}

export interface SystemMetrics {
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

export interface Alert {
  id: string;
  name: string;
  containerId?: string;
  containerName?: string;
  metricType: AlertMetricType;
  thresholdValue: number;
  currentValue?: number;
  comparisonOperator: ComparisonOperator;
  priority: AlertPriority;
  channels: AlertChannel[];
  enabled: boolean;
  cooldownMinutes?: number;
  description?: string;
  triggeredAt?: Date;
  createdAt: Date;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  alertName: string;
  triggeredAt: Date;
  metricValue: number;
  thresholdValue: number;
  message: string;
  channels: string[];
  status: 'sent' | 'failed' | 'suppressed';
  error?: string;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'discord' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertTemplate {
  name: string;
  category?: string;
  metricType: AlertMetricType;
  thresholdValue: number;
  comparisonOperator: ComparisonOperator;
  priority: AlertPriority;
  description?: string;
  recommendedChannels?: string[];
}

export interface AlertConfig {
  name: string;
  enabled: boolean;
  containerId?: string;
  containerName?: string;
  metricType: AlertMetricType;
  thresholdValue: number;
  comparisonOperator: ComparisonOperator;
  channels: AlertChannel[];
  priority: AlertPriority;
  cooldownMinutes?: number;
  description?: string;
}

export enum AlertMetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
  CONTAINER_STATUS = 'container_status',
  HEALTH_CHECK = 'health_check',
  RESTART_COUNT = 'restart_count'
}

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ComparisonOperator {
  GREATER_THAN = '>',
  LESS_THAN = '<',
  EQUAL = '=',
  NOT_EQUAL = '!=',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN_OR_EQUAL = '<='
}

export interface MetricsRange {
  start: Date;
  end: Date;
  interval: '1m' | '5m' | '15m' | '1h' | '6h' | '24h';
}

export interface ContainerHealthSummary {
  total: number;
  running: number;
  stopped: number;
  unhealthy: number;
  containers: ContainerHealth[];
}

export interface ContainerLogs {
  containerId: string;
  lines: string[];
  timestamp: Date;
}

export interface MonitoringDashboardData {
  containers: ContainerHealth[];
  systemMetrics: SystemMetrics;
  alerts: Alert[];
  recentAlerts: AlertHistory[];
  lastUpdated: Date;
}

export interface ChartDataPoint {
  time: string;
  value: number;
  label?: string;
}

export interface MetricChartData {
  cpu: ChartDataPoint[];
  memory: ChartDataPoint[];
  network?: ChartDataPoint[];
  disk?: ChartDataPoint[];
}

export interface NotificationTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ThresholdConfig {
  cpu: number;
  memory: number;
  disk: number;
  restartCount: number;
  networkMB: number;
}

// Component Props Types
export interface ContainerCardProps {
  container: ContainerHealth;
  metrics?: ContainerMetrics;
  onRestart?: (containerId: string) => void;
  onStop?: (containerId: string) => void;
  onViewLogs?: (containerId: string) => void;
  onViewDetails?: (containerId: string) => void;
}

export interface MetricsChartProps {
  data: MetricChartData;
  timeRange: string;
  onRangeChange?: (range: string) => void;
  height?: number;
  showLegend?: boolean;
}

export interface AlertPanelProps {
  alerts: Alert[];
  onConfigureAlert?: (alert: AlertConfig) => void;
  onDeleteAlert?: (alertId: string) => void;
  onTestAlert?: (channel: string) => void;
  onToggleAlert?: (alertId: string, enabled: boolean) => void;
}

export interface SystemGaugeProps {
  metrics: SystemMetrics;
  type: 'cpu' | 'memory' | 'disk';
  thresholds?: {
    warning: number;
    critical: number;
  };
}

export interface AlertHistoryTableProps {
  history: AlertHistory[];
  onLoadMore?: () => void;
  onFilter?: (filters: any) => void;
  loading?: boolean;
}