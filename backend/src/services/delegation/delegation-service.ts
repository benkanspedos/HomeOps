import { EventEmitter } from 'events';
import { DelegationProtocolManager } from './protocol-manager.js';
import { AgentRegistry } from './agent-registry.js';
import { TaskRouter } from './task-router.js';
import { StatusTracker } from './status-tracker.js';
import { DelegationErrorHandler } from './error-handler.js';
import { DelegationMessageBroker } from './message-broker.js';
import { DelegationWebSocketServer } from './websocket-server.js';
import { getDelegationConfig } from '../../config/delegation.config.js';
import { 
  Task, 
  Agent,
  TaskRequest,
  DelegationConfig,
  SystemHealthMetrics
} from '../../types/delegation.js';
import { logger } from '../../utils/logger.js';

export class DelegationService extends EventEmitter {
  private config: DelegationConfig;
  private messageBroker: DelegationMessageBroker;
  private agentRegistry: AgentRegistry;
  private taskRouter: TaskRouter;
  private statusTracker: StatusTracker;
  private errorHandler: DelegationErrorHandler;
  private protocolManager: DelegationProtocolManager;
  private isStarted = false;

  constructor(redisOptions?: any) {
    super();
    
    this.config = getDelegationConfig();
    
    // Initialize core components in dependency order
    this.messageBroker = new DelegationMessageBroker(this.config, redisOptions);
    this.agentRegistry = new AgentRegistry(this.messageBroker, this.config);
    this.taskRouter = new TaskRouter(this.agentRegistry, this.messageBroker, this.config);
    this.statusTracker = new StatusTracker(
      this.messageBroker,
      this.agentRegistry,
      this.taskRouter,
      this.config
    );
    this.errorHandler = new DelegationErrorHandler(
      this.messageBroker,
      this.agentRegistry,
      this.taskRouter,
      this.config
    );
    this.protocolManager = new DelegationProtocolManager(this.config, redisOptions);
    
    this.setupEventHandlers();
    
    logger.info('Delegation Service initialized with all components');
  }

  private setupEventHandlers(): void {
    // Forward important events to consumers
    this.agentRegistry.on('agent_registered', (agent) => {
      this.emit('agent_registered', agent);
      logger.info(`Agent registered: ${agent.name} (${agent.id})`);
    });

    this.agentRegistry.on('agent_disconnected', (agent) => {
      this.emit('agent_disconnected', agent);
      logger.warn(`Agent disconnected: ${agent.name} (${agent.id})`);
    });

    this.taskRouter.on('task_routed', (event) => {
      this.emit('task_routed', event);
      logger.info(`Task routed: ${event.taskId} → ${event.agentName}`);
    });

    this.taskRouter.on('task_completed', (event) => {
      this.emit('task_completed', event);
      logger.info(`Task completed: ${event.taskId} by ${event.agentId} (${event.duration}ms)`);
    });

    this.statusTracker.on('system_alert', (alert) => {
      this.emit('system_alert', alert);
      logger.warn(`System alert: ${alert.type} - ${alert.message}`);
    });

    this.statusTracker.on('metrics_collected', (metrics) => {
      this.emit('metrics_collected', metrics);
    });

    this.errorHandler.on('error_handled', (context) => {
      this.emit('error_handled', context);
      logger.error(`Error handled: ${context.type} - ${context.message}`);
    });

    this.errorHandler.on('critical_error', (context) => {
      this.emit('critical_error', context);
      logger.error(`CRITICAL ERROR: ${context.message}`, context);
    });

    this.errorHandler.on('circuit_breaker_opened', (event) => {
      this.emit('circuit_breaker_opened', event);
      logger.warn(`Circuit breaker opened for agent: ${event.agentId}`);
    });

    this.protocolManager.on('started', () => {
      logger.info('Protocol Manager started');
    });

    this.protocolManager.on('stopped', () => {
      logger.info('Protocol Manager stopped');
    });

    // Cross-component event routing
    this.messageBroker.on('task_request', (request) => {
      this.taskRouter.routeTask(request.task);
    });

    this.statusTracker.on('agent_unhealthy', (event) => {
      this.errorHandler.handleError({
        agentId: event.agentId,
        type: 'system_error',
        severity: 'medium',
        message: `Agent unhealthy: ${event.reason}`,
        details: event
      });
    });
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Delegation Service is already started');
    }

    try {
      logger.info('Starting Delegation Service...');
      
      // Start protocol manager (includes WebSocket server)
      await this.protocolManager.start();
      
      this.isStarted = true;
      
      logger.info('Delegation Service started successfully');
      this.emit('started');
      
      // Log startup status
      const status = this.getStatus();
      logger.info('Delegation Service Status:', status);
      
    } catch (error) {
      logger.error('Failed to start Delegation Service:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Delegation Service is not running');
      return;
    }

    try {
      logger.info('Stopping Delegation Service...');
      
      // Stop components in reverse order
      await this.protocolManager.stop();
      await this.errorHandler.cleanup();
      await this.statusTracker.cleanup();
      await this.taskRouter.cleanup();
      await this.agentRegistry.cleanup();
      await this.messageBroker.cleanup();
      
      this.isStarted = false;
      
      logger.info('Delegation Service stopped successfully');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Failed to stop Delegation Service:', error);
      throw error;
    }
  }

  // Public API Methods
  public async submitTask(taskData: {
    name: string;
    description?: string;
    priority?: number;
    parameters?: Record<string, any>;
    requiredCapabilities?: string[];
    timeout?: number;
    retries?: number;
  }): Promise<string> {
    if (!this.isStarted) {
      throw new Error('Delegation Service is not started');
    }

    const taskId = await this.protocolManager.submitTask(taskData);
    
    logger.info(`Task submitted: ${taskData.name} (${taskId})`);
    this.emit('task_submitted', { taskId, taskData });
    
    return taskId;
  }

  public async getTask(taskId: string): Promise<Task | null> {
    return await this.protocolManager.getTask(taskId);
  }

  public getTaskProgress(taskId: string) {
    return this.statusTracker.getTaskProgress(taskId);
  }

  public getLatestTaskProgress(taskId: string) {
    return this.statusTracker.getLatestTaskProgress(taskId);
  }

  public async getConnectedAgents(): Promise<Agent[]> {
    return await this.protocolManager.getConnectedAgents();
  }

  public async getAllAgents(): Promise<Agent[]> {
    return await this.protocolManager.getAllAgents();
  }

  public getAgent(agentId: string) {
    return this.agentRegistry.getAgent(agentId);
  }

  public getAgentsByCapability(capability: string) {
    return this.agentRegistry.getAgentsByCapability(capability);
  }

  public findBestAgent(capabilities: string[], options?: any) {
    return this.agentRegistry.findBestAgent(capabilities, options);
  }

  public getAvailableCapabilities(): string[] {
    return this.agentRegistry.getAvailableCapabilities();
  }

  // System Status and Monitoring
  public getSystemHealth(): SystemHealthMetrics | null {
    return this.statusTracker.getLatestSystemHealth();
  }

  public getSystemHealthHistory(limit?: number) {
    return this.statusTracker.getSystemHealthHistory(limit);
  }

  public getSystemHealthSummary() {
    return this.statusTracker.getSystemHealthSummary();
  }

  public async getStats(): Promise<any> {
    const queueStats = await this.protocolManager.getQueueStats();
    const registryStats = this.agentRegistry.getRegistryStats();
    const routingStats = this.taskRouter.getRoutingStats();
    const errorStats = this.errorHandler.getErrorStats();
    
    return {
      timestamp: Date.now(),
      isRunning: this.isStarted,
      queue: queueStats,
      registry: registryStats,
      routing: routingStats,
      errors: errorStats,
      systemHealth: this.getSystemHealthSummary()
    };
  }

  public getStatus(): any {
    return {
      isStarted: this.isStarted,
      protocolManager: this.protocolManager.getStatus(),
      config: {
        websocketPort: this.config.websocket.port,
        maxConnections: this.config.websocket.maxConnections,
        heartbeatInterval: this.config.agents.heartbeatInterval,
        taskTimeout: this.config.tasks.defaultTimeout
      }
    };
  }

  // Configuration Management
  public getConfig(): DelegationConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<DelegationConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Delegation Service configuration updated');
    this.emit('config_updated', this.config);
  }

  // Task Router Management
  public addRoutingRule(rule: any): void {
    this.taskRouter.addRoutingRule(rule);
  }

  public removeRoutingRule(ruleId: string): boolean {
    return this.taskRouter.removeRoutingRule(ruleId);
  }

  public enableRoutingRule(ruleId: string): boolean {
    return this.taskRouter.enableRoutingRule(ruleId);
  }

  public disableRoutingRule(ruleId: string): boolean {
    return this.taskRouter.disableRoutingRule(ruleId);
  }

  public getRoutingRules() {
    return this.taskRouter.getRoutingRules();
  }

  // Error Handler Management
  public addRecoveryAction(action: any): void {
    this.errorHandler.addRecoveryAction(action);
  }

  public removeRecoveryAction(actionId: string): boolean {
    return this.errorHandler.removeRecoveryAction(actionId);
  }

  public getUnresolvedErrors() {
    return this.errorHandler.getUnresolvedErrors();
  }

  public getErrorsByTask(taskId: string) {
    return this.errorHandler.getErrorsByTask(taskId);
  }

  public getErrorsByAgent(agentId: string) {
    return this.errorHandler.getErrorsByAgent(agentId);
  }

  // Health Checks
  public async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
    timestamp: number;
  }> {
    const timestamp = Date.now();
    const checks: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check if service is running
      checks.serviceRunning = {
        status: this.isStarted ? 'pass' : 'fail',
        message: this.isStarted ? 'Service is running' : 'Service is not started'
      };

      // Check system health metrics
      const systemHealth = this.getSystemHealth();
      checks.systemMetrics = {
        status: systemHealth ? 'pass' : 'warn',
        message: systemHealth ? 'System metrics available' : 'No system metrics available',
        data: systemHealth
      };

      // Check agent availability
      const activeAgents = await this.getConnectedAgents();
      checks.agentAvailability = {
        status: activeAgents.length > 0 ? 'pass' : 'warn',
        message: `${activeAgents.length} agents available`,
        count: activeAgents.length
      };

      // Check error rate
      const errorStats = this.errorHandler.getErrorStats();
      const errorRate = errorStats.recentErrors / Math.max(1, errorStats.totalErrors) * 100;
      checks.errorRate = {
        status: errorRate < 5 ? 'pass' : errorRate < 15 ? 'warn' : 'fail',
        message: `Error rate: ${errorRate.toFixed(1)}%`,
        rate: errorRate
      };

      // Determine overall status
      const hasFailures = Object.values(checks).some((check: any) => check.status === 'fail');
      const hasWarnings = Object.values(checks).some((check: any) => check.status === 'warn');

      if (hasFailures) {
        overallStatus = 'unhealthy';
      } else if (hasWarnings) {
        overallStatus = 'degraded';
      }

    } catch (error) {
      overallStatus = 'unhealthy';
      checks.healthCheckError = {
        status: 'fail',
        message: `Health check failed: ${error.message}`,
        error: error.message
      };
    }

    const result = {
      status: overallStatus,
      checks,
      timestamp
    };

    this.emit('health_check_completed', result);
    return result;
  }

  // Utility Methods
  public isRunning(): boolean {
    return this.isStarted;
  }

  public getUptime(): number {
    return process.uptime();
  }

  public getVersion(): string {
    // TODO: Get from package.json or environment
    return '1.0.0';
  }
}

export default DelegationService;