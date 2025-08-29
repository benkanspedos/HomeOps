import { EventEmitter } from 'events';
import { 
  Task, 
  TaskStatus, 
  Agent, 
  AgentStatus,
  TaskResponse,
  DelegationConfig 
} from '../../types/delegation.js';
import { DelegationMessageBroker } from './message-broker.js';
import { AgentRegistry, EnhancedAgent } from './agent-registry.js';
import { TaskRouter, TaskAssignment } from './task-router.js';
import { logger } from '../../utils/logger.js';

export interface SystemHealthMetrics {
  timestamp: number;
  totalAgents: number;
  activeAgents: number;
  healthyAgents: number;
  busyAgents: number;
  offlineAgents: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  systemLoad: number;
  throughputPerHour: number;
  errorRate: number;
}

export interface TaskProgressUpdate {
  taskId: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  timestamp: number;
  agentId?: string;
  estimatedTimeRemaining?: number;
}

export interface AgentHealthStatus {
  agentId: string;
  status: AgentStatus;
  isHealthy: boolean;
  healthScore: number;
  currentTasks: number;
  maxTasks: number;
  lastSeen: number;
  responseTime?: number;
  errorCount: number;
  successRate: number;
}

export class StatusTracker extends EventEmitter {
  private messageBroker: DelegationMessageBroker;
  private agentRegistry: AgentRegistry;
  private taskRouter: TaskRouter;
  private config: DelegationConfig;
  
  private taskProgressHistory = new Map<string, TaskProgressUpdate[]>();
  private systemHealthHistory: SystemHealthMetrics[] = [];
  private agentHealthHistory = new Map<string, AgentHealthStatus[]>();
  
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private maxHistoryLength = 1000; // Keep last 1000 entries
  
  private taskStartTimes = new Map<string, number>();
  private taskCompletionTimes = new Map<string, number>();

  constructor(
    messageBroker: DelegationMessageBroker,
    agentRegistry: AgentRegistry,
    taskRouter: TaskRouter,
    config: DelegationConfig
  ) {
    super();
    this.messageBroker = messageBroker;
    this.agentRegistry = agentRegistry;
    this.taskRouter = taskRouter;
    this.config = config;
    
    this.setupEventHandlers();
    this.startMetricsCollection();
    this.startHealthChecking();
    
    logger.info('Status Tracker initialized');
  }

  private setupEventHandlers(): void {
    // Task Events
    this.messageBroker.on('task_request', (request: any) => {
      this.trackTaskStart(request.task.id);
    });

    this.messageBroker.on('task_response', (response: TaskResponse) => {
      this.trackTaskProgress(response);
    });

    this.taskRouter.on('task_routed', (event: any) => {
      this.trackTaskAssignment(event);
    });

    this.taskRouter.on('task_completed', (event: any) => {
      this.trackTaskCompletion(event);
    });

    this.taskRouter.on('routing_failed', (event: any) => {
      this.trackRoutingFailure(event);
    });

    // Agent Events
    this.agentRegistry.on('agent_registered', (agent: EnhancedAgent) => {
      this.trackAgentRegistration(agent);
    });

    this.agentRegistry.on('agent_heartbeat', (agent: EnhancedAgent) => {
      this.trackAgentHeartbeat(agent);
    });

    this.agentRegistry.on('agent_disconnected', (agent: EnhancedAgent) => {
      this.trackAgentDisconnection(agent);
    });
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 30000); // Collect metrics every 30 seconds
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 60000); // Health checks every minute
  }

  private trackTaskStart(taskId: string): void {
    const timestamp = Date.now();
    this.taskStartTimes.set(taskId, timestamp);
    
    const progressUpdate: TaskProgressUpdate = {
      taskId,
      status: TaskStatus.PENDING,
      progress: 0,
      timestamp,
      message: 'Task created and queued for assignment'
    };
    
    this.addTaskProgress(taskId, progressUpdate);
    
    this.emit('task_started', { taskId, timestamp });
  }

  private trackTaskProgress(response: TaskResponse): void {
    const progressUpdate: TaskProgressUpdate = {
      taskId: response.taskId,
      status: response.status,
      progress: response.progress || 0,
      timestamp: response.timestamp,
      agentId: response.agentId,
      estimatedTimeRemaining: response.estimatedTimeRemaining,
      message: response.error || 'Task progress update'
    };
    
    this.addTaskProgress(response.taskId, progressUpdate);
    
    if (response.status === TaskStatus.COMPLETED || response.status === TaskStatus.FAILED) {
      this.trackTaskCompletion({
        taskId: response.taskId,
        agentId: response.agentId,
        status: response.status,
        duration: this.calculateTaskDuration(response.taskId)
      });
    }
    
    this.emit('task_progress', progressUpdate);
  }

  private trackTaskAssignment(event: any): void {
    const progressUpdate: TaskProgressUpdate = {
      taskId: event.taskId,
      status: TaskStatus.IN_PROGRESS,
      progress: 10, // 10% progress for assignment
      timestamp: Date.now(),
      agentId: event.agentId,
      message: `Task assigned to agent ${event.agentName}`
    };
    
    this.addTaskProgress(event.taskId, progressUpdate);
    
    this.emit('task_assigned', event);
  }

  private trackTaskCompletion(event: any): void {
    const timestamp = Date.now();
    this.taskCompletionTimes.set(event.taskId, timestamp);
    
    const progressUpdate: TaskProgressUpdate = {
      taskId: event.taskId,
      status: event.status,
      progress: event.status === TaskStatus.COMPLETED ? 100 : 0,
      timestamp,
      agentId: event.agentId,
      message: event.status === TaskStatus.COMPLETED ? 'Task completed successfully' : 'Task failed'
    };
    
    this.addTaskProgress(event.taskId, progressUpdate);
    
    // Clean up timing data for completed tasks (after some time)
    setTimeout(() => {
      this.taskStartTimes.delete(event.taskId);
      this.taskCompletionTimes.delete(event.taskId);
    }, 300000); // Clean up after 5 minutes
    
    this.emit('task_completed', event);
  }

  private trackRoutingFailure(event: any): void {
    const progressUpdate: TaskProgressUpdate = {
      taskId: event.taskId,
      status: TaskStatus.FAILED,
      progress: 0,
      timestamp: Date.now(),
      message: `Routing failed: ${event.reason}`
    };
    
    this.addTaskProgress(event.taskId, progressUpdate);
    
    this.emit('routing_failed', event);
  }

  private trackAgentRegistration(agent: EnhancedAgent): void {
    const healthStatus: AgentHealthStatus = {
      agentId: agent.id,
      status: agent.status,
      isHealthy: agent.isHealthy,
      healthScore: agent.healthScore,
      currentTasks: agent.currentTasks,
      maxTasks: agent.maxConcurrentTasks,
      lastSeen: agent.lastSeen,
      errorCount: 0,
      successRate: 100
    };
    
    this.addAgentHealth(agent.id, healthStatus);
    
    this.emit('agent_registered', { agentId: agent.id, timestamp: Date.now() });
  }

  private trackAgentHeartbeat(agent: EnhancedAgent): void {
    const healthStatus: AgentHealthStatus = {
      agentId: agent.id,
      status: agent.status,
      isHealthy: agent.isHealthy,
      healthScore: agent.healthScore,
      currentTasks: agent.currentTasks,
      maxTasks: agent.maxConcurrentTasks,
      lastSeen: agent.lastSeen,
      errorCount: 0, // TODO: Track error count
      successRate: agent.metrics?.successRate || 100
    };
    
    this.addAgentHealth(agent.id, healthStatus);
    
    this.emit('agent_heartbeat', { agentId: agent.id, timestamp: Date.now() });
  }

  private trackAgentDisconnection(agent: EnhancedAgent): void {
    const healthStatus: AgentHealthStatus = {
      agentId: agent.id,
      status: AgentStatus.OFFLINE,
      isHealthy: false,
      healthScore: 0,
      currentTasks: 0,
      maxTasks: agent.maxConcurrentTasks,
      lastSeen: agent.lastSeen,
      errorCount: 0,
      successRate: agent.metrics?.successRate || 0
    };
    
    this.addAgentHealth(agent.id, healthStatus);
    
    this.emit('agent_disconnected', { agentId: agent.id, timestamp: Date.now() });
  }

  private addTaskProgress(taskId: string, update: TaskProgressUpdate): void {
    if (!this.taskProgressHistory.has(taskId)) {
      this.taskProgressHistory.set(taskId, []);
    }
    
    const history = this.taskProgressHistory.get(taskId)!;
    history.push(update);
    
    // Limit history length
    if (history.length > this.maxHistoryLength) {
      history.splice(0, history.length - this.maxHistoryLength);
    }
  }

  private addAgentHealth(agentId: string, status: AgentHealthStatus): void {
    if (!this.agentHealthHistory.has(agentId)) {
      this.agentHealthHistory.set(agentId, []);
    }
    
    const history = this.agentHealthHistory.get(agentId)!;
    history.push(status);
    
    // Limit history length
    if (history.length > this.maxHistoryLength) {
      history.splice(0, history.length - this.maxHistoryLength);
    }
  }

  private calculateTaskDuration(taskId: string): number {
    const startTime = this.taskStartTimes.get(taskId);
    const endTime = this.taskCompletionTimes.get(taskId) || Date.now();
    
    return startTime ? endTime - startTime : 0;
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      const registryStats = this.agentRegistry.getRegistryStats();
      const queueStats = await this.messageBroker.getQueueStats();
      const routingStats = this.taskRouter.getRoutingStats();
      
      // Calculate throughput (tasks completed in the last hour)
      const oneHourAgo = timestamp - (60 * 60 * 1000);
      const recentCompletions = Array.from(this.taskCompletionTimes.entries())
        .filter(([_, completionTime]) => completionTime > oneHourAgo).length;
      
      // Calculate average task duration
      const recentDurations = Array.from(this.taskProgressHistory.values())
        .flat()
        .filter(update => update.timestamp > oneHourAgo && 
               (update.status === TaskStatus.COMPLETED || update.status === TaskStatus.FAILED))
        .map(update => this.calculateTaskDuration(update.taskId))
        .filter(duration => duration > 0);
      
      const averageTaskDuration = recentDurations.length > 0 
        ? recentDurations.reduce((sum, duration) => sum + duration, 0) / recentDurations.length 
        : 0;
      
      // Calculate error rate
      const totalRecentTasks = queueStats.completed + queueStats.failed;
      const errorRate = totalRecentTasks > 0 ? (queueStats.failed / totalRecentTasks) * 100 : 0;
      
      // Calculate system load (percentage of agents that are busy)
      const systemLoad = registryStats.totalAgents > 0 
        ? (registryStats.busyAgents / registryStats.totalAgents) * 100 
        : 0;
      
      const metrics: SystemHealthMetrics = {
        timestamp,
        totalAgents: registryStats.totalAgents,
        activeAgents: registryStats.activeAgents,
        healthyAgents: registryStats.healthyAgents,
        busyAgents: registryStats.busyAgents,
        offlineAgents: registryStats.offlineAgents,
        totalTasks: queueStats.pending + queueStats.inProgress + queueStats.completed + queueStats.failed,
        pendingTasks: queueStats.pending,
        inProgressTasks: queueStats.inProgress,
        completedTasks: queueStats.completed,
        failedTasks: queueStats.failed,
        averageTaskDuration,
        systemLoad,
        throughputPerHour: recentCompletions,
        errorRate
      };
      
      this.systemHealthHistory.push(metrics);
      
      // Limit history length
      if (this.systemHealthHistory.length > this.maxHistoryLength) {
        this.systemHealthHistory.splice(0, this.systemHealthHistory.length - this.maxHistoryLength);
      }
      
      this.emit('metrics_collected', metrics);
      
      // Check for alerts
      this.checkSystemAlerts(metrics);
      
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  private async performHealthChecks(): Promise<void> {
    const agents = this.agentRegistry.getAllAgents();
    const now = Date.now();
    
    for (const agent of agents) {
      const timeSinceLastSeen = now - agent.lastSeen;
      const heartbeatThreshold = this.config.agents.heartbeatInterval * 
                                this.config.agents.maxMissedHeartbeats;
      
      if (timeSinceLastSeen > heartbeatThreshold && agent.status !== AgentStatus.OFFLINE) {
        logger.warn(`Agent ${agent.name} (${agent.id}) appears unhealthy - last seen ${timeSinceLastSeen}ms ago`);
        
        this.emit('agent_unhealthy', {
          agentId: agent.id,
          reason: 'missed_heartbeats',
          timeSinceLastSeen,
          threshold: heartbeatThreshold
        });
      }
    }
  }

  private checkSystemAlerts(metrics: SystemHealthMetrics): void {
    // High error rate alert
    if (metrics.errorRate > 10) {
      this.emit('system_alert', {
        level: 'warning',
        type: 'high_error_rate',
        message: `Error rate is ${metrics.errorRate.toFixed(1)}% (threshold: 10%)`,
        metrics
      });
    }
    
    // High system load alert
    if (metrics.systemLoad > 80) {
      this.emit('system_alert', {
        level: 'warning',
        type: 'high_system_load',
        message: `System load is ${metrics.systemLoad.toFixed(1)}% (threshold: 80%)`,
        metrics
      });
    }
    
    // No active agents alert
    if (metrics.activeAgents === 0 && metrics.totalAgents > 0) {
      this.emit('system_alert', {
        level: 'critical',
        type: 'no_active_agents',
        message: 'No active agents available for task processing',
        metrics
      });
    }
    
    // Low throughput alert
    if (metrics.throughputPerHour < 1 && metrics.pendingTasks > 5) {
      this.emit('system_alert', {
        level: 'warning',
        type: 'low_throughput',
        message: `Low throughput: ${metrics.throughputPerHour} tasks/hour with ${metrics.pendingTasks} pending`,
        metrics
      });
    }
  }

  // Public API methods
  public getTaskProgress(taskId: string): TaskProgressUpdate[] {
    return this.taskProgressHistory.get(taskId) || [];
  }

  public getLatestTaskProgress(taskId: string): TaskProgressUpdate | null {
    const history = this.taskProgressHistory.get(taskId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  public getAgentHealth(agentId: string): AgentHealthStatus[] {
    return this.agentHealthHistory.get(agentId) || [];
  }

  public getLatestAgentHealth(agentId: string): AgentHealthStatus | null {
    const history = this.agentHealthHistory.get(agentId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  public getSystemHealthHistory(limit?: number): SystemHealthMetrics[] {
    const history = [...this.systemHealthHistory];
    return limit ? history.slice(-limit) : history;
  }

  public getLatestSystemHealth(): SystemHealthMetrics | null {
    return this.systemHealthHistory.length > 0 
      ? this.systemHealthHistory[this.systemHealthHistory.length - 1] 
      : null;
  }

  public getSystemHealthSummary(): any {
    const latest = this.getLatestSystemHealth();
    
    if (!latest) {
      return {
        status: 'unknown',
        message: 'No metrics available'
      };
    }
    
    let status = 'healthy';
    const issues: string[] = [];
    
    if (latest.activeAgents === 0 && latest.totalAgents > 0) {
      status = 'critical';
      issues.push('No active agents');
    } else if (latest.errorRate > 10) {
      status = 'warning';
      issues.push(`High error rate: ${latest.errorRate.toFixed(1)}%`);
    } else if (latest.systemLoad > 80) {
      status = 'warning';
      issues.push(`High system load: ${latest.systemLoad.toFixed(1)}%`);
    }
    
    return {
      status,
      timestamp: latest.timestamp,
      issues,
      metrics: latest
    };
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Status Tracker...');
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.taskProgressHistory.clear();
    this.systemHealthHistory.length = 0;
    this.agentHealthHistory.clear();
    this.taskStartTimes.clear();
    this.taskCompletionTimes.clear();
    
    logger.info('Status Tracker cleanup complete');
  }
}