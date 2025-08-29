import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  DelegationMessage, 
  MessageType, 
  Task, 
  Agent,
  TaskRequest,
  TaskResponse,
  DelegationConfig 
} from '../../types/delegation.js';
import { logger } from '../../utils/logger.js';

export class DelegationMessageBroker extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private config: DelegationConfig;
  private channels = {
    tasks: 'delegation:tasks',
    agents: 'delegation:agents',
    events: 'delegation:events',
    responses: 'delegation:responses'
  };

  constructor(config: DelegationConfig, redisOptions?: any) {
    super();
    this.config = config;
    
    // Create Redis connections
    this.redis = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);
    
    this.setupSubscriptions();
    
    logger.info('Delegation Message Broker initialized');
  }

  private setupSubscriptions(): void {
    // Subscribe to all delegation channels
    this.subscriber.subscribe(
      this.channels.tasks,
      this.channels.agents,
      this.channels.events,
      this.channels.responses
    );

    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const data: DelegationMessage = JSON.parse(message);
        this.handleChannelMessage(channel, data);
      } catch (error) {
        logger.error(`Failed to parse message from channel ${channel}:`, error);
      }
    });

    this.subscriber.on('error', (error: Error) => {
      logger.error('Redis subscriber error:', error);
    });

    this.redis.on('error', (error: Error) => {
      logger.error('Redis client error:', error);
    });
  }

  private handleChannelMessage(channel: string, message: DelegationMessage): void {
    logger.debug(`Received message on channel ${channel}:`, {
      type: message.type,
      id: message.id,
      agentId: message.agentId
    });

    // Emit events based on channel and message type
    switch (channel) {
      case this.channels.tasks:
        this.emit('task_message', message);
        break;
      case this.channels.agents:
        this.emit('agent_message', message);
        break;
      case this.channels.events:
        this.emit('system_event', message);
        break;
      case this.channels.responses:
        this.emit('response_message', message);
        break;
    }

    // Also emit based on message type for easier handling
    this.emit(message.type, message);
  }

  public async publishTaskRequest(taskRequest: TaskRequest): Promise<void> {
    try {
      const message = JSON.stringify(taskRequest);
      await this.redis.publish(this.channels.tasks, message);
      
      // Store task in Redis for persistence
      await this.storeTask(taskRequest);
      
      logger.info(`Published task request: ${taskRequest.task.name} (${taskRequest.task.id})`);
    } catch (error) {
      logger.error('Failed to publish task request:', error);
      throw error;
    }
  }

  public async publishTaskResponse(taskResponse: TaskResponse): Promise<void> {
    try {
      const message = JSON.stringify(taskResponse);
      await this.redis.publish(this.channels.responses, message);
      
      // Update task status in Redis
      await this.updateTaskStatus(taskResponse);
      
      logger.info(`Published task response: ${taskResponse.taskId} - ${taskResponse.status}`);
    } catch (error) {
      logger.error('Failed to publish task response:', error);
      throw error;
    }
  }

  public async publishAgentMessage(agentMessage: DelegationMessage): Promise<void> {
    try {
      const message = JSON.stringify(agentMessage);
      await this.redis.publish(this.channels.agents, message);
      
      logger.debug(`Published agent message: ${agentMessage.type} from ${agentMessage.agentId}`);
    } catch (error) {
      logger.error('Failed to publish agent message:', error);
      throw error;
    }
  }

  public async publishSystemEvent(systemEvent: DelegationMessage): Promise<void> {
    try {
      const message = JSON.stringify(systemEvent);
      await this.redis.publish(this.channels.events, message);
      
      logger.debug(`Published system event: ${systemEvent.type}`);
    } catch (error) {
      logger.error('Failed to publish system event:', error);
      throw error;
    }
  }

  private async storeTask(taskRequest: TaskRequest): Promise<void> {
    const task: Task = {
      id: taskRequest.task.id,
      name: taskRequest.task.name,
      description: taskRequest.task.description,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      priority: taskRequest.task.priority,
      parameters: taskRequest.task.parameters,
      requiredCapabilities: taskRequest.task.requiredCapabilities,
      progress: 0,
      retries: 0,
      maxRetries: taskRequest.task.retries || this.config.tasks.defaultRetries,
      timeout: taskRequest.task.timeout,
      metadata: {}
    };

    const key = `${this.config.redis.keyPrefix}task:${task.id}`;
    await this.redis.hset(key, {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt.toString(),
      updatedAt: task.updatedAt.toString(),
      priority: task.priority.toString(),
      parameters: JSON.stringify(task.parameters),
      requiredCapabilities: JSON.stringify(task.requiredCapabilities),
      progress: task.progress.toString(),
      retries: task.retries.toString(),
      maxRetries: task.maxRetries.toString(),
      timeout: task.timeout?.toString() || '',
      metadata: JSON.stringify(task.metadata)
    });

    await this.redis.expire(key, this.config.redis.taskTtl);

    // Add to task queue for processing
    await this.redis.zadd(
      `${this.config.redis.keyPrefix}queue:pending`,
      task.priority,
      task.id
    );
  }

  private async updateTaskStatus(taskResponse: TaskResponse): Promise<void> {
    const key = `${this.config.redis.keyPrefix}task:${taskResponse.taskId}`;
    
    const updates: Record<string, string> = {
      status: taskResponse.status,
      updatedAt: Date.now().toString(),
      progress: (taskResponse.progress || 0).toString()
    };

    if (taskResponse.result) {
      updates.result = JSON.stringify(taskResponse.result);
    }

    if (taskResponse.error) {
      updates.error = taskResponse.error;
    }

    if (taskResponse.status === 'completed' || taskResponse.status === 'failed') {
      updates.completedAt = Date.now().toString();
      
      // Remove from pending queue
      await this.redis.zrem(
        `${this.config.redis.keyPrefix}queue:pending`,
        taskResponse.taskId
      );
      
      // Add to completed queue
      await this.redis.zadd(
        `${this.config.redis.keyPrefix}queue:${taskResponse.status}`,
        Date.now(),
        taskResponse.taskId
      );
    }

    await this.redis.hset(key, updates);
  }

  public async getTask(taskId: string): Promise<Task | null> {
    const key = `${this.config.redis.keyPrefix}task:${taskId}`;
    const taskData = await this.redis.hgetall(key);
    
    if (Object.keys(taskData).length === 0) {
      return null;
    }

    try {
      return {
        id: taskData.id,
        name: taskData.name,
        description: taskData.description,
        status: taskData.status as any,
        assignedAgentId: taskData.assignedAgentId || undefined,
        createdAt: parseInt(taskData.createdAt),
        updatedAt: parseInt(taskData.updatedAt),
        completedAt: taskData.completedAt ? parseInt(taskData.completedAt) : undefined,
        priority: parseInt(taskData.priority),
        parameters: JSON.parse(taskData.parameters || '{}'),
        requiredCapabilities: JSON.parse(taskData.requiredCapabilities || '[]'),
        result: taskData.result ? JSON.parse(taskData.result) : undefined,
        error: taskData.error || undefined,
        progress: parseInt(taskData.progress || '0'),
        retries: parseInt(taskData.retries || '0'),
        maxRetries: parseInt(taskData.maxRetries || '3'),
        timeout: taskData.timeout ? parseInt(taskData.timeout) : undefined,
        metadata: JSON.parse(taskData.metadata || '{}')
      };
    } catch (error) {
      logger.error(`Failed to parse task data for ${taskId}:`, error);
      return null;
    }
  }

  public async getPendingTasks(limit: number = 10): Promise<string[]> {
    // Get highest priority tasks first (ZREVRANGE for descending order)
    return await this.redis.zrevrange(
      `${this.config.redis.keyPrefix}queue:pending`,
      0,
      limit - 1
    );
  }

  public async getTasksByStatus(status: string, limit: number = 50): Promise<string[]> {
    return await this.redis.zrevrange(
      `${this.config.redis.keyPrefix}queue:${status}`,
      0,
      limit - 1
    );
  }

  public async assignTaskToAgent(taskId: string, agentId: string): Promise<boolean> {
    const key = `${this.config.redis.keyPrefix}task:${taskId}`;
    const exists = await this.redis.exists(key);
    
    if (!exists) {
      return false;
    }

    await this.redis.hset(key, {
      assignedAgentId: agentId,
      status: 'in_progress',
      updatedAt: Date.now().toString()
    });

    return true;
  }

  public async storeAgent(agent: Agent): Promise<void> {
    const key = `${this.config.redis.keyPrefix}agent:${agent.id}`;
    
    await this.redis.hset(key, {
      id: agent.id,
      name: agent.name,
      version: agent.version,
      status: agent.status,
      capabilities: JSON.stringify(agent.capabilities),
      maxConcurrentTasks: agent.maxConcurrentTasks.toString(),
      currentTasks: agent.currentTasks.toString(),
      lastSeen: agent.lastSeen.toString(),
      registeredAt: agent.registeredAt.toString(),
      description: agent.description || '',
      tags: JSON.stringify(agent.tags || []),
      connectionId: agent.connectionId || '',
      endpoint: agent.endpoint || ''
    });

    await this.redis.expire(key, this.config.redis.agentTtl);
  }

  public async getAgent(agentId: string): Promise<Agent | null> {
    const key = `${this.config.redis.keyPrefix}agent:${agentId}`;
    const agentData = await this.redis.hgetall(key);
    
    if (Object.keys(agentData).length === 0) {
      return null;
    }

    try {
      return {
        id: agentData.id,
        name: agentData.name,
        version: agentData.version,
        status: agentData.status as any,
        capabilities: JSON.parse(agentData.capabilities || '[]'),
        maxConcurrentTasks: parseInt(agentData.maxConcurrentTasks),
        currentTasks: parseInt(agentData.currentTasks),
        lastSeen: parseInt(agentData.lastSeen),
        registeredAt: parseInt(agentData.registeredAt),
        description: agentData.description || undefined,
        tags: JSON.parse(agentData.tags || '[]'),
        connectionId: agentData.connectionId || undefined,
        endpoint: agentData.endpoint || undefined
      };
    } catch (error) {
      logger.error(`Failed to parse agent data for ${agentId}:`, error);
      return null;
    }
  }

  public async getAllAgents(): Promise<Agent[]> {
    const pattern = `${this.config.redis.keyPrefix}agent:*`;
    const keys = await this.redis.keys(pattern);
    const agents: Agent[] = [];

    for (const key of keys) {
      const agentId = key.replace(`${this.config.redis.keyPrefix}agent:`, '');
      const agent = await this.getAgent(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  }

  public async getAgentsByCapability(capability: string): Promise<Agent[]> {
    const allAgents = await this.getAllAgents();
    return allAgents.filter(agent => 
      agent.capabilities.includes(capability) && 
      agent.status === 'available'
    );
  }

  public async incrementTaskRetry(taskId: string): Promise<number> {
    const key = `${this.config.redis.keyPrefix}task:${taskId}`;
    const retries = await this.redis.hincrby(key, 'retries', 1);
    await this.redis.hset(key, 'updatedAt', Date.now().toString());
    return retries;
  }

  public async getQueueStats(): Promise<any> {
    const stats = {
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      agents: 0
    };

    try {
      stats.pending = await this.redis.zcard(`${this.config.redis.keyPrefix}queue:pending`);
      stats.inProgress = await this.redis.zcard(`${this.config.redis.keyPrefix}queue:in_progress`);
      stats.completed = await this.redis.zcard(`${this.config.redis.keyPrefix}queue:completed`);
      stats.failed = await this.redis.zcard(`${this.config.redis.keyPrefix}queue:failed`);
      
      const agentKeys = await this.redis.keys(`${this.config.redis.keyPrefix}agent:*`);
      stats.agents = agentKeys.length;
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
    }

    return stats;
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Delegation Message Broker...');
    
    // Close Redis connections
    this.subscriber.disconnect();
    this.redis.disconnect();
    
    logger.info('Delegation Message Broker cleanup complete');
  }
}