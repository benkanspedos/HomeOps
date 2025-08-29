export enum MessageType {
  TASK_REQUEST = 'task_request',
  TASK_RESPONSE = 'task_response',
  TASK_STATUS = 'task_status',
  AGENT_REGISTER = 'agent_register',
  AGENT_HEARTBEAT = 'agent_heartbeat',
  SYSTEM_EVENT = 'system_event',
  ERROR = 'error'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
  ERROR = 'error'
}

export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  agentId: string;
}

export interface TaskRequest extends BaseMessage {
  type: MessageType.TASK_REQUEST;
  task: {
    id: string;
    name: string;
    description: string;
    priority: number;
    parameters: Record<string, any>;
    requiredCapabilities: string[];
    timeout?: number;
    retries?: number;
  };
}

export interface TaskResponse extends BaseMessage {
  type: MessageType.TASK_RESPONSE;
  taskId: string;
  status: TaskStatus;
  result?: any;
  error?: string;
  progress?: number;
  estimatedTimeRemaining?: number;
}

export interface TaskStatusUpdate extends BaseMessage {
  type: MessageType.TASK_STATUS;
  taskId: string;
  status: TaskStatus;
  progress?: number;
  message?: string;
  metadata?: Record<string, any>;
}

export interface AgentRegistration extends BaseMessage {
  type: MessageType.AGENT_REGISTER;
  agent: {
    name: string;
    version: string;
    capabilities: string[];
    maxConcurrentTasks: number;
    description?: string;
    tags?: string[];
  };
}

export interface AgentHeartbeat extends BaseMessage {
  type: MessageType.AGENT_HEARTBEAT;
  status: AgentStatus;
  currentTasks: number;
  maxTasks: number;
  uptime: number;
  lastActivity: number;
  systemMetrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    activeConnections?: number;
  };
}

export interface SystemEvent extends BaseMessage {
  type: MessageType.SYSTEM_EVENT;
  event: {
    name: string;
    level: 'info' | 'warn' | 'error' | 'critical';
    description: string;
    data?: Record<string, any>;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
  };
}

export type DelegationMessage = 
  | TaskRequest 
  | TaskResponse 
  | TaskStatusUpdate 
  | AgentRegistration 
  | AgentHeartbeat 
  | SystemEvent 
  | ErrorMessage;

export interface Agent {
  id: string;
  name: string;
  version: string;
  status: AgentStatus;
  capabilities: string[];
  maxConcurrentTasks: number;
  currentTasks: number;
  lastSeen: number;
  registeredAt: number;
  description?: string;
  tags?: string[];
  connectionId?: string;
  endpoint?: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assignedAgentId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  priority: number;
  parameters: Record<string, any>;
  requiredCapabilities: string[];
  result?: any;
  error?: string;
  progress: number;
  retries: number;
  maxRetries: number;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface DelegationConfig {
  websocket: {
    port: number;
    path: string;
    pingInterval: number;
    pongTimeout: number;
    maxConnections: number;
  };
  tasks: {
    defaultTimeout: number;
    defaultRetries: number;
    maxQueueSize: number;
    priorityLevels: number;
  };
  agents: {
    heartbeatInterval: number;
    maxMissedHeartbeats: number;
    registrationTimeout: number;
  };
  redis: {
    keyPrefix: string;
    taskTtl: number;
    agentTtl: number;
  };
}