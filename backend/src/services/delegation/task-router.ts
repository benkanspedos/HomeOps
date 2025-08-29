import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  Task, 
  TaskRequest, 
  TaskResponse, 
  TaskStatus, 
  MessageType,
  DelegationConfig 
} from '../../types/delegation.js';
import { AgentRegistry, EnhancedAgent } from './agent-registry.js';
import { DelegationMessageBroker } from './message-broker.js';
import { logger } from '../../utils/logger.js';

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  condition: (task: Task) => boolean;
  agentSelector: (agents: EnhancedAgent[], task: Task) => EnhancedAgent | null;
  priority: number;
  enabled: boolean;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: number;
  estimatedDuration?: number;
  actualDuration?: number;
  routingRule?: string;
}

export class TaskRouter extends EventEmitter {
  private agentRegistry: AgentRegistry;
  private messageBroker: DelegationMessageBroker;
  private config: DelegationConfig;
  private routingRules: RoutingRule[] = [];
  private assignments = new Map<string, TaskAssignment>();
  private queueProcessingInterval: NodeJS.Timeout | null = null;
  private isProcessingQueue = false;

  constructor(
    agentRegistry: AgentRegistry,
    messageBroker: DelegationMessageBroker,
    config: DelegationConfig
  ) {
    super();
    this.agentRegistry = agentRegistry;
    this.messageBroker = messageBroker;
    this.config = config;
    
    this.setupDefaultRoutingRules();
    this.setupEventHandlers();
    this.startQueueProcessing();
    
    logger.info('Task Router initialized');
  }

  private setupDefaultRoutingRules(): void {
    // Rule 1: High Priority Tasks - Route to healthiest agents first
    this.addRoutingRule({
      id: 'high-priority',
      name: 'High Priority Tasks',
      description: 'Route high priority tasks to the healthiest available agents',
      condition: (task: Task) => task.priority >= 8,
      agentSelector: (agents: EnhancedAgent[]) => {
        return agents
          .filter(agent => agent.isHealthy && agent.currentTasks < agent.maxConcurrentTasks)
          .sort((a, b) => b.healthScore - a.healthScore)[0] || null;
      },
      priority: 10,
      enabled: true
    });

    // Rule 2: Capability Matching - Exact capability match
    this.addRoutingRule({
      id: 'capability-exact',
      name: 'Exact Capability Match',
      description: 'Route tasks to agents with exact capability match',
      condition: (task: Task) => task.requiredCapabilities.length > 0,
      agentSelector: (agents: EnhancedAgent[], task: Task) => {
        return this.agentRegistry.findBestAgent(task.requiredCapabilities, {
          requireAll: true,
          preferLowLoad: true,
          preferHighSuccess: true,
          preferHighHealth: true
        });
      },
      priority: 8,
      enabled: true
    });

    // Rule 3: Load Balancing - Distribute load evenly
    this.addRoutingRule({
      id: 'load-balance',
      name: 'Load Balancing',
      description: 'Distribute tasks to agents with lowest current load',
      condition: () => true, // Apply to all tasks
      agentSelector: (agents: EnhancedAgent[]) => {
        const availableAgents = agents.filter(agent => 
          agent.isHealthy && agent.currentTasks < agent.maxConcurrentTasks
        );
        
        if (availableAgents.length === 0) return null;
        
        // Sort by load factor (ascending)
        return availableAgents.sort((a, b) => {
          const loadA = a.currentTasks / a.maxConcurrentTasks;
          const loadB = b.currentTasks / b.maxConcurrentTasks;
          return loadA - loadB;
        })[0];
      },
      priority: 5,
      enabled: true
    });

    // Rule 4: Fallback - Any available agent
    this.addRoutingRule({
      id: 'fallback',
      name: 'Fallback Routing',
      description: 'Route to any available agent as fallback',
      condition: () => true,
      agentSelector: (agents: EnhancedAgent[]) => {
        const availableAgents = agents.filter(agent => 
          agent.currentTasks < agent.maxConcurrentTasks
        );
        return availableAgents[0] || null;
      },
      priority: 1,
      enabled: true
    });

    logger.info(`Initialized ${this.routingRules.length} default routing rules`);
  }

  private setupEventHandlers(): void {
    // Listen for task responses to update assignments
    this.messageBroker.on('task_response', (response: TaskResponse) => {
      this.handleTaskResponse(response);
    });

    // Listen for agent status changes
    this.agentRegistry.on('agent_disconnected', (agent: EnhancedAgent) => {
      this.handleAgentDisconnection(agent);
    });
  }

  private startQueueProcessing(): void {
    this.queueProcessingInterval = setInterval(async () => {
      if (!this.isProcessingQueue) {
        await this.processTaskQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  private async processTaskQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      const pendingTaskIds = await this.messageBroker.getPendingTasks(10);
      
      for (const taskId of pendingTaskIds) {
        const task = await this.messageBroker.getTask(taskId);
        
        if (task && task.status === TaskStatus.PENDING) {
          await this.routeTask(task);
        }
      }
    } catch (error) {
      logger.error('Error processing task queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  public async routeTask(task: Task): Promise<boolean> {
    try {
      logger.info(`Routing task: ${task.name} (${task.id})`);
      
      // Get all active agents
      const activeAgents = this.agentRegistry.getActiveAgents();
      
      if (activeAgents.length === 0) {
        logger.warn(`No active agents available for task ${task.id}`);
        this.emit('routing_failed', { 
          taskId: task.id, 
          reason: 'no_active_agents',
          task 
        });
        return false;
      }

      // Apply routing rules in priority order
      const sortedRules = this.routingRules
        .filter(rule => rule.enabled)
        .sort((a, b) => b.priority - a.priority);

      let selectedAgent: EnhancedAgent | null = null;
      let appliedRule: RoutingRule | undefined;

      for (const rule of sortedRules) {
        if (rule.condition(task)) {
          selectedAgent = rule.agentSelector(activeAgents, task);
          
          if (selectedAgent) {
            appliedRule = rule;
            logger.debug(`Applied routing rule: ${rule.name} for task ${task.id}`);
            break;
          }
        }
      }

      if (!selectedAgent) {
        logger.warn(`No suitable agent found for task ${task.id}`);
        this.emit('routing_failed', { 
          taskId: task.id, 
          reason: 'no_suitable_agent',
          task 
        });
        return false;
      }

      // Create assignment
      const assignment: TaskAssignment = {
        taskId: task.id,
        agentId: selectedAgent.id,
        assignedAt: Date.now(),
        routingRule: appliedRule?.id
      };

      this.assignments.set(task.id, assignment);

      // Update task status in broker
      await this.messageBroker.assignTaskToAgent(task.id, selectedAgent.id);

      // Send task request to selected agent
      const taskRequest: TaskRequest = {
        id: uuidv4(),
        type: MessageType.TASK_REQUEST,
        timestamp: Date.now(),
        agentId: selectedAgent.id,
        task: {
          id: task.id,
          name: task.name,
          description: task.description,
          priority: task.priority,
          parameters: task.parameters,
          requiredCapabilities: task.requiredCapabilities,
          timeout: task.timeout,
          retries: task.maxRetries
        }
      };

      // Publish task request
      await this.messageBroker.publishTaskRequest(taskRequest);

      logger.info(`Task ${task.id} routed to agent ${selectedAgent.name} (${selectedAgent.id})`);
      
      this.emit('task_routed', {
        taskId: task.id,
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        routingRule: appliedRule?.name,
        assignment
      });

      return true;

    } catch (error) {
      logger.error(`Failed to route task ${task.id}:`, error);
      this.emit('routing_error', { taskId: task.id, error, task });
      return false;
    }
  }

  private handleTaskResponse(response: TaskResponse): void {
    const assignment = this.assignments.get(response.taskId);
    
    if (assignment) {
      // Calculate actual duration
      assignment.actualDuration = Date.now() - assignment.assignedAt;
      
      if (response.status === TaskStatus.COMPLETED || response.status === TaskStatus.FAILED) {
        logger.info(`Task ${response.taskId} completed by agent ${response.agentId} in ${assignment.actualDuration}ms`);
        
        this.emit('task_completed', {
          taskId: response.taskId,
          agentId: response.agentId,
          status: response.status,
          duration: assignment.actualDuration,
          assignment
        });
      }
    }
  }

  private async handleAgentDisconnection(agent: EnhancedAgent): Promise<void> {
    // Find tasks assigned to the disconnected agent
    const affectedAssignments = Array.from(this.assignments.values())
      .filter(assignment => assignment.agentId === agent.id);

    for (const assignment of affectedAssignments) {
      const task = await this.messageBroker.getTask(assignment.taskId);
      
      if (task && (task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS)) {
        logger.warn(`Reassigning task ${task.id} due to agent ${agent.id} disconnection`);
        
        // Remove current assignment
        this.assignments.delete(assignment.taskId);
        
        // Reset task status to pending for reassignment
        const taskResponse: TaskResponse = {
          id: uuidv4(),
          type: MessageType.TASK_RESPONSE,
          timestamp: Date.now(),
          agentId: 'system',
          taskId: task.id,
          status: TaskStatus.PENDING,
          error: `Agent ${agent.id} disconnected, reassigning task`
        };
        
        await this.messageBroker.publishTaskResponse(taskResponse);
        
        // The task will be picked up by the next queue processing cycle
        this.emit('task_reassigned', {
          taskId: task.id,
          previousAgentId: agent.id,
          reason: 'agent_disconnected'
        });
      }
    }
  }

  // Rule Management
  public addRoutingRule(rule: RoutingRule): void {
    const existingIndex = this.routingRules.findIndex(r => r.id === rule.id);
    
    if (existingIndex >= 0) {
      this.routingRules[existingIndex] = rule;
      logger.info(`Updated routing rule: ${rule.name}`);
    } else {
      this.routingRules.push(rule);
      logger.info(`Added routing rule: ${rule.name}`);
    }
    
    this.emit('routing_rule_updated', rule);
  }

  public removeRoutingRule(ruleId: string): boolean {
    const index = this.routingRules.findIndex(r => r.id === ruleId);
    
    if (index >= 0) {
      const rule = this.routingRules.splice(index, 1)[0];
      logger.info(`Removed routing rule: ${rule.name}`);
      this.emit('routing_rule_removed', rule);
      return true;
    }
    
    return false;
  }

  public enableRoutingRule(ruleId: string): boolean {
    const rule = this.routingRules.find(r => r.id === ruleId);
    
    if (rule) {
      rule.enabled = true;
      logger.info(`Enabled routing rule: ${rule.name}`);
      this.emit('routing_rule_enabled', rule);
      return true;
    }
    
    return false;
  }

  public disableRoutingRule(ruleId: string): boolean {
    const rule = this.routingRules.find(r => r.id === ruleId);
    
    if (rule) {
      rule.enabled = false;
      logger.info(`Disabled routing rule: ${rule.name}`);
      this.emit('routing_rule_disabled', rule);
      return true;
    }
    
    return false;
  }

  public getRoutingRules(): RoutingRule[] {
    return [...this.routingRules];
  }

  public getRoutingRule(ruleId: string): RoutingRule | undefined {
    return this.routingRules.find(r => r.id === ruleId);
  }

  // Statistics and Monitoring
  public getAssignment(taskId: string): TaskAssignment | undefined {
    return this.assignments.get(taskId);
  }

  public getActiveAssignments(): TaskAssignment[] {
    return Array.from(this.assignments.values());
  }

  public getRoutingStats(): any {
    const assignments = this.getActiveAssignments();
    const now = Date.now();
    
    const ruleUsage: Record<string, number> = {};
    let totalDuration = 0;
    let completedTasks = 0;
    
    for (const assignment of assignments) {
      if (assignment.routingRule) {
        ruleUsage[assignment.routingRule] = (ruleUsage[assignment.routingRule] || 0) + 1;
      }
      
      if (assignment.actualDuration) {
        totalDuration += assignment.actualDuration;
        completedTasks++;
      }
    }
    
    return {
      totalAssignments: assignments.length,
      completedTasks,
      averageTaskDuration: completedTasks > 0 ? totalDuration / completedTasks : 0,
      ruleUsage,
      activeRules: this.routingRules.filter(r => r.enabled).length,
      totalRules: this.routingRules.length
    };
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Task Router...');
    
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
    }
    
    this.routingRules = [];
    this.assignments.clear();
    
    logger.info('Task Router cleanup complete');
  }
}