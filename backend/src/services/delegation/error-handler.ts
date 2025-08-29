import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  Task, 
  TaskStatus, 
  TaskResponse, 
  MessageType,
  DelegationConfig 
} from '../../types/delegation.js';
import { DelegationMessageBroker } from './message-broker.js';
import { AgentRegistry } from './agent-registry.js';
import { TaskRouter } from './task-router.js';
import { logger } from '../../utils/logger.js';

export enum ErrorType {
  COMMUNICATION_ERROR = 'communication_error',
  AGENT_TIMEOUT = 'agent_timeout',
  TASK_FAILURE = 'task_failure',
  ROUTING_ERROR = 'routing_error',
  VALIDATION_ERROR = 'validation_error',
  SYSTEM_ERROR = 'system_error',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  DEPENDENCY_FAILURE = 'dependency_failure'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  REASSIGN = 'reassign',
  FALLBACK = 'fallback',
  ESCALATE = 'escalate',
  ABORT = 'abort',
  CIRCUIT_BREAKER = 'circuit_breaker'
}

export interface ErrorContext {
  id: string;
  taskId?: string;
  agentId?: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  recoveryStrategy: RecoveryStrategy;
  resolved: boolean;
  resolvedAt?: number;
  stack?: string;
}

export interface RecoveryAction {
  id: string;
  errorId: string;
  strategy: RecoveryStrategy;
  action: (context: ErrorContext) => Promise<boolean>;
  description: string;
  priority: number;
}

export interface CircuitBreakerState {
  agentId: string;
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half_open';
  nextAttemptTime: number;
}

export class DelegationErrorHandler extends EventEmitter {
  private messageBroker: DelegationMessageBroker;
  private agentRegistry: AgentRegistry;
  private taskRouter: TaskRouter;
  private config: DelegationConfig;
  
  private errors = new Map<string, ErrorContext>();
  private recoveryActions: RecoveryAction[] = [];
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  
  private errorCheckInterval: NodeJS.Timeout | null = null;
  private maxErrorHistorySize = 1000;
  
  // Configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly DEFAULT_RETRY_DELAYS = [1000, 2000, 5000, 10000]; // exponential backoff

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
    
    this.setupDefaultRecoveryActions();
    this.setupEventHandlers();
    this.startErrorMonitoring();
    
    logger.info('Delegation Error Handler initialized');
  }

  private setupDefaultRecoveryActions(): void {
    // Retry with exponential backoff
    this.addRecoveryAction({
      id: 'retry-exponential',
      errorId: '',
      strategy: RecoveryStrategy.RETRY,
      action: async (context: ErrorContext) => {
        if (context.retryCount >= context.maxRetries) {
          return false;
        }

        const delay = this.DEFAULT_RETRY_DELAYS[Math.min(context.retryCount, this.DEFAULT_RETRY_DELAYS.length - 1)];
        
        logger.info(`Retrying task ${context.taskId} in ${delay}ms (attempt ${context.retryCount + 1}/${context.maxRetries})`);
        
        setTimeout(async () => {
          await this.retryTask(context);
        }, delay);
        
        return true;
      },
      description: 'Retry task with exponential backoff',
      priority: 5
    });

    // Reassign to different agent
    this.addRecoveryAction({
      id: 'reassign-agent',
      errorId: '',
      strategy: RecoveryStrategy.REASSIGN,
      action: async (context: ErrorContext) => {
        if (!context.taskId) return false;
        
        const task = await this.messageBroker.getTask(context.taskId);
        if (!task) return false;
        
        // Find alternative agent (excluding the failed one)
        const availableAgents = this.agentRegistry.getActiveAgents()
          .filter(agent => agent.id !== context.agentId);
        
        if (availableAgents.length === 0) {
          logger.warn(`No alternative agents available for task ${context.taskId}`);
          return false;
        }
        
        logger.info(`Reassigning task ${context.taskId} to different agent`);
        
        // Reset task status and let router handle reassignment
        await this.resetTaskForReassignment(task);
        return true;
      },
      description: 'Reassign task to different agent',
      priority: 7
    });

    // Circuit breaker for failed agents
    this.addRecoveryAction({
      id: 'circuit-breaker',
      errorId: '',
      strategy: RecoveryStrategy.CIRCUIT_BREAKER,
      action: async (context: ErrorContext) => {
        if (!context.agentId) return false;
        
        await this.updateCircuitBreaker(context.agentId, true);
        logger.warn(`Circuit breaker opened for agent ${context.agentId}`);
        
        return true;
      },
      description: 'Open circuit breaker for failing agent',
      priority: 8
    });

    // Escalate critical errors
    this.addRecoveryAction({
      id: 'escalate-critical',
      errorId: '',
      strategy: RecoveryStrategy.ESCALATE,
      action: async (context: ErrorContext) => {
        logger.error(`Critical error escalated:`, context);
        
        this.emit('critical_error', context);
        
        // Send system alert
        await this.messageBroker.publishSystemEvent({
          id: uuidv4(),
          type: MessageType.SYSTEM_EVENT,
          timestamp: Date.now(),
          agentId: 'system',
          event: {
            name: 'critical_error_escalated',
            level: 'critical',
            description: `Critical error requires attention: ${context.message}`,
            data: context
          }
        });
        
        return true;
      },
      description: 'Escalate critical errors to system administrators',
      priority: 10
    });

    // Abort unrecoverable tasks
    this.addRecoveryAction({
      id: 'abort-task',
      errorId: '',
      strategy: RecoveryStrategy.ABORT,
      action: async (context: ErrorContext) => {
        if (!context.taskId) return false;
        
        logger.error(`Aborting unrecoverable task ${context.taskId}: ${context.message}`);
        
        const taskResponse: TaskResponse = {
          id: uuidv4(),
          type: MessageType.TASK_RESPONSE,
          timestamp: Date.now(),
          agentId: 'system',
          taskId: context.taskId,
          status: TaskStatus.FAILED,
          error: `Task aborted due to unrecoverable error: ${context.message}`
        };
        
        await this.messageBroker.publishTaskResponse(taskResponse);
        
        return true;
      },
      description: 'Abort tasks that cannot be recovered',
      priority: 1
    });

    logger.info(`Initialized ${this.recoveryActions.length} default recovery actions`);
  }

  private setupEventHandlers(): void {
    // Task timeout handling
    this.messageBroker.on('task_timeout', (data: any) => {
      this.handleError({
        taskId: data.taskId,
        agentId: data.agentId,
        type: ErrorType.AGENT_TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: `Task ${data.taskId} timed out after ${data.timeout}ms`,
        details: data
      });
    });

    // Communication errors
    this.messageBroker.on('communication_error', (data: any) => {
      this.handleError({
        agentId: data.agentId,
        type: ErrorType.COMMUNICATION_ERROR,
        severity: ErrorSeverity.HIGH,
        message: `Communication error with agent ${data.agentId}`,
        details: data
      });
    });

    // Task failures
    this.messageBroker.on('task_response', (response: TaskResponse) => {
      if (response.status === TaskStatus.FAILED && response.error) {
        this.handleError({
          taskId: response.taskId,
          agentId: response.agentId,
          type: ErrorType.TASK_FAILURE,
          severity: this.determineSeverity(response.error),
          message: response.error,
          details: { response }
        });
      }
    });

    // Routing failures
    this.taskRouter.on('routing_failed', (event: any) => {
      this.handleError({
        taskId: event.taskId,
        type: ErrorType.ROUTING_ERROR,
        severity: ErrorSeverity.HIGH,
        message: `Routing failed: ${event.reason}`,
        details: event
      });
    });

    // Agent health issues
    this.agentRegistry.on('agent_unhealthy', (event: any) => {
      this.handleError({
        agentId: event.agentId,
        type: ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: `Agent ${event.agentId} became unhealthy: ${event.reason}`,
        details: event
      });
    });
  }

  private startErrorMonitoring(): void {
    this.errorCheckInterval = setInterval(async () => {
      await this.checkCircuitBreakers();
      await this.processQueuedErrors();
    }, 10000); // Check every 10 seconds
  }

  public async handleError(errorData: {
    taskId?: string;
    agentId?: string;
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    details?: Record<string, any>;
    stack?: string;
  }): Promise<void> {
    const context: ErrorContext = {
      id: uuidv4(),
      taskId: errorData.taskId,
      agentId: errorData.agentId,
      type: errorData.type,
      severity: errorData.severity,
      message: errorData.message,
      details: errorData.details,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.getMaxRetries(errorData.type, errorData.severity),
      recoveryStrategy: this.determineRecoveryStrategy(errorData),
      resolved: false,
      stack: errorData.stack
    };

    this.errors.set(context.id, context);

    // Limit error history size
    if (this.errors.size > this.maxErrorHistorySize) {
      const oldestErrorId = Array.from(this.errors.keys())[0];
      this.errors.delete(oldestErrorId);
    }

    logger.error(`Error handled: ${context.type} - ${context.message}`, {
      errorId: context.id,
      taskId: context.taskId,
      agentId: context.agentId,
      severity: context.severity
    });

    this.emit('error_handled', context);

    // Immediate recovery attempt
    await this.attemptRecovery(context);
  }

  private async attemptRecovery(context: ErrorContext): Promise<void> {
    // Check circuit breaker state
    if (context.agentId && this.isCircuitBreakerOpen(context.agentId)) {
      logger.warn(`Circuit breaker is open for agent ${context.agentId}, skipping recovery`);
      return;
    }

    // Find applicable recovery actions
    const applicableActions = this.recoveryActions
      .filter(action => action.strategy === context.recoveryStrategy)
      .sort((a, b) => b.priority - a.priority);

    for (const action of applicableActions) {
      try {
        logger.debug(`Attempting recovery action: ${action.description} for error ${context.id}`);
        
        const success = await action.action(context);
        
        if (success) {
          context.resolved = true;
          context.resolvedAt = Date.now();
          
          logger.info(`Error ${context.id} resolved using strategy: ${action.description}`);
          
          this.emit('error_resolved', { context, action });
          return;
        }
      } catch (recoveryError) {
        logger.error(`Recovery action ${action.id} failed for error ${context.id}:`, recoveryError);
      }
    }

    // If no recovery action succeeded, escalate based on severity
    if (!context.resolved) {
      await this.escalateError(context);
    }
  }

  private async escalateError(context: ErrorContext): Promise<void> {
    context.retryCount++;

    if (context.retryCount >= context.maxRetries) {
      if (context.severity === ErrorSeverity.CRITICAL) {
        // Escalate critical errors immediately
        context.recoveryStrategy = RecoveryStrategy.ESCALATE;
      } else {
        // Abort non-critical errors that can't be recovered
        context.recoveryStrategy = RecoveryStrategy.ABORT;
      }
      
      await this.attemptRecovery(context);
    } else {
      // Try different recovery strategy
      const fallbackStrategies: RecoveryStrategy[] = [
        RecoveryStrategy.REASSIGN,
        RecoveryStrategy.RETRY,
        RecoveryStrategy.FALLBACK,
        RecoveryStrategy.ESCALATE
      ];

      const currentIndex = fallbackStrategies.indexOf(context.recoveryStrategy);
      if (currentIndex < fallbackStrategies.length - 1) {
        context.recoveryStrategy = fallbackStrategies[currentIndex + 1];
        
        logger.info(`Escalating recovery strategy for error ${context.id} to: ${context.recoveryStrategy}`);
        
        setTimeout(async () => {
          await this.attemptRecovery(context);
        }, 5000); // Wait 5 seconds before trying new strategy
      }
    }
  }

  private async retryTask(context: ErrorContext): Promise<void> {
    if (!context.taskId) return;

    const task = await this.messageBroker.getTask(context.taskId);
    if (!task) return;

    // Increment retry count in broker
    const retries = await this.messageBroker.incrementTaskRetry(context.taskId);
    
    if (retries <= task.maxRetries) {
      // Reset task status to pending for retry
      await this.resetTaskForReassignment(task);
      
      logger.info(`Task ${context.taskId} retry ${retries}/${task.maxRetries} initiated`);
    } else {
      logger.warn(`Task ${context.taskId} exceeded max retries (${task.maxRetries}), aborting`);
      
      context.recoveryStrategy = RecoveryStrategy.ABORT;
      await this.attemptRecovery(context);
    }
  }

  private async resetTaskForReassignment(task: Task): Promise<void> {
    const taskResponse: TaskResponse = {
      id: uuidv4(),
      type: MessageType.TASK_RESPONSE,
      timestamp: Date.now(),
      agentId: 'system',
      taskId: task.id,
      status: TaskStatus.PENDING,
      progress: 0
    };

    await this.messageBroker.publishTaskResponse(taskResponse);
  }

  private async updateCircuitBreaker(agentId: string, failure: boolean): Promise<void> {
    const now = Date.now();
    let state = this.circuitBreakers.get(agentId);

    if (!state) {
      state = {
        agentId,
        failures: 0,
        lastFailureTime: now,
        state: 'closed',
        nextAttemptTime: now
      };
      this.circuitBreakers.set(agentId, state);
    }

    if (failure) {
      state.failures++;
      state.lastFailureTime = now;

      if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        state.state = 'open';
        state.nextAttemptTime = now + this.CIRCUIT_BREAKER_TIMEOUT;
        
        this.emit('circuit_breaker_opened', { agentId, failures: state.failures });
      }
    } else {
      // Success - reset failure count
      state.failures = Math.max(0, state.failures - 1);
      
      if (state.state === 'half_open' && state.failures === 0) {
        state.state = 'closed';
        this.emit('circuit_breaker_closed', { agentId });
      }
    }
  }

  private isCircuitBreakerOpen(agentId: string): boolean {
    const state = this.circuitBreakers.get(agentId);
    return state?.state === 'open';
  }

  private async checkCircuitBreakers(): Promise<void> {
    const now = Date.now();

    for (const [agentId, state] of this.circuitBreakers) {
      if (state.state === 'open' && now >= state.nextAttemptTime) {
        state.state = 'half_open';
        state.nextAttemptTime = now + (this.CIRCUIT_BREAKER_TIMEOUT / 2);
        
        this.emit('circuit_breaker_half_open', { agentId });
        
        logger.info(`Circuit breaker for agent ${agentId} moved to half-open state`);
      }
    }
  }

  private async processQueuedErrors(): Promise<void> {
    // Process unresolved errors that might need retry
    const unresolvedErrors = Array.from(this.errors.values())
      .filter(error => !error.resolved && error.retryCount < error.maxRetries);

    for (const error of unresolvedErrors) {
      const timeSinceError = Date.now() - error.timestamp;
      const retryDelay = this.DEFAULT_RETRY_DELAYS[Math.min(error.retryCount, this.DEFAULT_RETRY_DELAYS.length - 1)];

      if (timeSinceError >= retryDelay) {
        await this.attemptRecovery(error);
      }
    }
  }

  private determineSeverity(errorMessage: string): ErrorSeverity {
    const criticalKeywords = ['critical', 'fatal', 'security', 'corruption'];
    const highKeywords = ['timeout', 'connection', 'network', 'unavailable'];
    const mediumKeywords = ['validation', 'parameter', 'format'];

    const lowerMessage = errorMessage.toLowerCase();

    if (criticalKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return ErrorSeverity.CRITICAL;
    } else if (highKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return ErrorSeverity.HIGH;
    } else if (mediumKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  private determineRecoveryStrategy(errorData: any): RecoveryStrategy {
    switch (errorData.type) {
      case ErrorType.COMMUNICATION_ERROR:
      case ErrorType.AGENT_TIMEOUT:
        return RecoveryStrategy.REASSIGN;
      
      case ErrorType.TASK_FAILURE:
        return errorData.severity === ErrorSeverity.CRITICAL 
          ? RecoveryStrategy.ESCALATE 
          : RecoveryStrategy.RETRY;
      
      case ErrorType.ROUTING_ERROR:
        return RecoveryStrategy.RETRY;
      
      case ErrorType.RESOURCE_EXHAUSTION:
        return RecoveryStrategy.CIRCUIT_BREAKER;
      
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  private getMaxRetries(type: ErrorType, severity: ErrorSeverity): number {
    if (severity === ErrorSeverity.CRITICAL) {
      return 1; // Don't retry critical errors multiple times
    }

    switch (type) {
      case ErrorType.COMMUNICATION_ERROR:
        return 5;
      case ErrorType.AGENT_TIMEOUT:
        return 3;
      case ErrorType.TASK_FAILURE:
        return 2;
      default:
        return this.config.tasks.defaultRetries;
    }
  }

  // Management methods
  public addRecoveryAction(action: RecoveryAction): void {
    const existingIndex = this.recoveryActions.findIndex(a => a.id === action.id);
    
    if (existingIndex >= 0) {
      this.recoveryActions[existingIndex] = action;
    } else {
      this.recoveryActions.push(action);
    }
    
    // Sort by priority
    this.recoveryActions.sort((a, b) => b.priority - a.priority);
    
    this.emit('recovery_action_added', action);
  }

  public removeRecoveryAction(actionId: string): boolean {
    const index = this.recoveryActions.findIndex(a => a.id === actionId);
    
    if (index >= 0) {
      const action = this.recoveryActions.splice(index, 1)[0];
      this.emit('recovery_action_removed', action);
      return true;
    }
    
    return false;
  }

  // Query methods
  public getError(errorId: string): ErrorContext | undefined {
    return this.errors.get(errorId);
  }

  public getErrorsByTask(taskId: string): ErrorContext[] {
    return Array.from(this.errors.values()).filter(error => error.taskId === taskId);
  }

  public getErrorsByAgent(agentId: string): ErrorContext[] {
    return Array.from(this.errors.values()).filter(error => error.agentId === agentId);
  }

  public getUnresolvedErrors(): ErrorContext[] {
    return Array.from(this.errors.values()).filter(error => !error.resolved);
  }

  public getErrorStats(): any {
    const errors = Array.from(this.errors.values());
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    const recentErrors = errors.filter(error => now - error.timestamp < oneHour);
    
    const statsByType: Record<string, number> = {};
    const statsBySeverity: Record<string, number> = {};
    
    for (const error of recentErrors) {
      statsByType[error.type] = (statsByType[error.type] || 0) + 1;
      statsBySeverity[error.severity] = (statsBySeverity[error.severity] || 0) + 1;
    }
    
    return {
      totalErrors: errors.length,
      recentErrors: recentErrors.length,
      unresolvedErrors: this.getUnresolvedErrors().length,
      errorsByType: statsByType,
      errorsBySeverity: statsBySeverity,
      circuitBreakers: Array.from(this.circuitBreakers.values()),
      recoveryActions: this.recoveryActions.length
    };
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Delegation Error Handler...');
    
    if (this.errorCheckInterval) {
      clearInterval(this.errorCheckInterval);
    }
    
    this.errors.clear();
    this.recoveryActions = [];
    this.circuitBreakers.clear();
    
    logger.info('Delegation Error Handler cleanup complete');
  }
}