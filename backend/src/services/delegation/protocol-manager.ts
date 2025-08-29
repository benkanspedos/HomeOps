import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { DelegationWebSocketServer } from './websocket-server.js';
import { DelegationMessageBroker } from './message-broker.js';
import { 
  DelegationMessage, 
  MessageType, 
  TaskRequest, 
  TaskResponse,
  AgentRegistration,
  AgentHeartbeat,
  Agent,
  Task,
  DelegationConfig
} from '../../types/delegation.js';
import { logger } from '../../utils/logger.js';

export class DelegationProtocolManager extends EventEmitter {
  private wsServer: DelegationWebSocketServer;
  private messageBroker: DelegationMessageBroker;
  private config: DelegationConfig;
  private isRunning = false;

  constructor(config: DelegationConfig, redisOptions?: any) {
    super();
    this.config = config;
    
    // Initialize components
    this.wsServer = new DelegationWebSocketServer(config);
    this.messageBroker = new DelegationMessageBroker(config, redisOptions);
    
    this.setupEventHandlers();
    
    logger.info('Delegation Protocol Manager initialized');
  }

  private setupEventHandlers(): void {
    // WebSocket Server Events
    this.wsServer.on('agent_registered', (agent: Agent) => {
      this.handleAgentRegistration(agent);
    });

    this.wsServer.on('agent_heartbeat', ({ agent, heartbeat }: { agent: Agent, heartbeat: AgentHeartbeat }) => {
      this.handleAgentHeartbeat(agent, heartbeat);
    });

    this.wsServer.on('task_response', (response: TaskResponse) => {
      this.handleTaskResponse(response);
    });

    this.wsServer.on('agent_disconnected', (agent: Agent) => {
      this.handleAgentDisconnection(agent);
    });

    this.wsServer.on('message', ({ connectionId, message }: { connectionId: string, message: DelegationMessage }) => {
      this.handleGenericMessage(connectionId, message);
    });

    // Message Broker Events
    this.messageBroker.on('task_request', (taskRequest: TaskRequest) => {
      this.handleTaskRequest(taskRequest);
    });

    this.messageBroker.on('response_message', (response: TaskResponse) => {
      this.emit('task_response', response);
    });

    this.messageBroker.on('system_event', (event: DelegationMessage) => {
      this.emit('system_event', event);
    });

    logger.info('Event handlers set up for Delegation Protocol Manager');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Delegation Protocol Manager is already running');
      return;
    }

    try {
      logger.info('Starting Delegation Protocol Manager...');
      
      // WebSocket server starts automatically in constructor
      // Message broker connections are established in constructor
      
      this.isRunning = true;
      
      this.emit('started');
      logger.info('Delegation Protocol Manager started successfully');
      
    } catch (error) {
      logger.error('Failed to start Delegation Protocol Manager:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Delegation Protocol Manager is not running');
      return;
    }

    try {
      logger.info('Stopping Delegation Protocol Manager...');
      
      await this.wsServer.shutdown();
      await this.messageBroker.cleanup();
      
      this.isRunning = false;
      
      this.emit('stopped');
      logger.info('Delegation Protocol Manager stopped successfully');
      
    } catch (error) {
      logger.error('Failed to stop Delegation Protocol Manager:', error);
      throw error;
    }
  }

  private async handleAgentRegistration(agent: Agent): Promise<void> {
    try {
      // Store agent in Redis
      await this.messageBroker.storeAgent(agent);
      
      // Publish agent registration event
      const registrationMessage: DelegationMessage = {
        id: uuidv4(),
        type: MessageType.SYSTEM_EVENT,
        timestamp: Date.now(),
        agentId: 'system',
        event: {
          name: 'agent_registered',
          level: 'info',
          description: `Agent ${agent.name} (${agent.id}) registered successfully`,
          data: {
            agentId: agent.id,
            capabilities: agent.capabilities,
            maxTasks: agent.maxConcurrentTasks
          }
        }
      };

      await this.messageBroker.publishSystemEvent(registrationMessage);
      
      this.emit('agent_registered', agent);
      
      logger.info(`Agent registration processed: ${agent.name} (${agent.id})`);
      
    } catch (error) {
      logger.error(`Failed to process agent registration for ${agent.id}:`, error);
    }
  }

  private async handleAgentHeartbeat(agent: Agent, heartbeat: AgentHeartbeat): Promise<void> {
    try {
      // Update agent in Redis
      await this.messageBroker.storeAgent(agent);
      
      // Publish heartbeat to message broker
      await this.messageBroker.publishAgentMessage(heartbeat);
      
      this.emit('agent_heartbeat', { agent, heartbeat });
      
    } catch (error) {
      logger.error(`Failed to process agent heartbeat for ${agent.id}:`, error);
    }
  }

  private async handleTaskRequest(taskRequest: TaskRequest): Promise<void> {
    try {
      logger.info(`Processing task request: ${taskRequest.task.name} (${taskRequest.task.id})`);
      
      // Find suitable agent
      const suitableAgents = await this.findSuitableAgents(taskRequest.task.requiredCapabilities);
      
      if (suitableAgents.length === 0) {
        logger.warn(`No suitable agents found for task ${taskRequest.task.id}`);
        
        // Send task failed response
        const failureResponse: TaskResponse = {
          id: uuidv4(),
          type: MessageType.TASK_RESPONSE,
          timestamp: Date.now(),
          agentId: 'system',
          taskId: taskRequest.task.id,
          status: 'failed',
          error: 'No suitable agents available'
        };
        
        await this.messageBroker.publishTaskResponse(failureResponse);
        return;
      }

      // Select best agent (for now, use the one with least current tasks)
      const bestAgent = suitableAgents.reduce((best, current) => 
        current.currentTasks < best.currentTasks ? current : best
      );

      // Assign task to agent
      await this.messageBroker.assignTaskToAgent(taskRequest.task.id, bestAgent.id);
      
      // Send task request to selected agent
      const success = this.wsServer.sendToAgent(bestAgent.id, taskRequest);
      
      if (success) {
        logger.info(`Task ${taskRequest.task.id} assigned to agent ${bestAgent.name} (${bestAgent.id})`);
        
        this.emit('task_assigned', {
          taskId: taskRequest.task.id,
          agentId: bestAgent.id,
          agentName: bestAgent.name
        });
      } else {
        logger.error(`Failed to send task to agent ${bestAgent.id}`);
        
        const failureResponse: TaskResponse = {
          id: uuidv4(),
          type: MessageType.TASK_RESPONSE,
          timestamp: Date.now(),
          agentId: 'system',
          taskId: taskRequest.task.id,
          status: 'failed',
          error: 'Failed to communicate with assigned agent'
        };
        
        await this.messageBroker.publishTaskResponse(failureResponse);
      }
      
    } catch (error) {
      logger.error(`Failed to process task request ${taskRequest.task.id}:`, error);
      
      const errorResponse: TaskResponse = {
        id: uuidv4(),
        type: MessageType.TASK_RESPONSE,
        timestamp: Date.now(),
        agentId: 'system',
        taskId: taskRequest.task.id,
        status: 'failed',
        error: `Task processing error: ${error.message}`
      };
      
      await this.messageBroker.publishTaskResponse(errorResponse);
    }
  }

  private async handleTaskResponse(response: TaskResponse): Promise<void> {
    try {
      // Publish response to message broker
      await this.messageBroker.publishTaskResponse(response);
      
      this.emit('task_response', response);
      
      logger.info(`Task response processed: ${response.taskId} - ${response.status}`);
      
    } catch (error) {
      logger.error(`Failed to process task response ${response.taskId}:`, error);
    }
  }

  private handleAgentDisconnection(agent: Agent): void {
    logger.info(`Agent disconnected: ${agent.name} (${agent.id})`);
    
    this.emit('agent_disconnected', agent);
    
    // TODO: Handle task reassignment for tasks assigned to disconnected agent
  }

  private handleGenericMessage(connectionId: string, message: DelegationMessage): void {
    logger.debug(`Generic message from ${connectionId}:`, { type: message.type, id: message.id });
    
    this.emit('message', { connectionId, message });
  }

  private async findSuitableAgents(requiredCapabilities: string[]): Promise<Agent[]> {
    const suitableAgents: Agent[] = [];
    
    for (const capability of requiredCapabilities) {
      const agents = await this.messageBroker.getAgentsByCapability(capability);
      
      // Find agents that have all required capabilities
      for (const agent of agents) {
        const hasAllCapabilities = requiredCapabilities.every(cap => 
          agent.capabilities.includes(cap)
        );
        
        if (hasAllCapabilities && 
            agent.status === 'available' && 
            agent.currentTasks < agent.maxConcurrentTasks &&
            !suitableAgents.find(a => a.id === agent.id)) {
          suitableAgents.push(agent);
        }
      }
    }
    
    return suitableAgents;
  }

  // Public API methods
  public async submitTask(task: Partial<TaskRequest['task']>): Promise<string> {
    const taskId = uuidv4();
    
    const taskRequest: TaskRequest = {
      id: uuidv4(),
      type: MessageType.TASK_REQUEST,
      timestamp: Date.now(),
      agentId: 'system',
      task: {
        id: taskId,
        name: task.name || 'Unnamed Task',
        description: task.description || '',
        priority: task.priority || 1,
        parameters: task.parameters || {},
        requiredCapabilities: task.requiredCapabilities || [],
        timeout: task.timeout,
        retries: task.retries
      }
    };

    await this.messageBroker.publishTaskRequest(taskRequest);
    
    return taskId;
  }

  public async getTask(taskId: string): Promise<Task | null> {
    return await this.messageBroker.getTask(taskId);
  }

  public async getConnectedAgents(): Promise<Agent[]> {
    return this.wsServer.getConnectedAgents();
  }

  public async getAllAgents(): Promise<Agent[]> {
    return await this.messageBroker.getAllAgents();
  }

  public async getQueueStats(): Promise<any> {
    const brokerStats = await this.messageBroker.getQueueStats();
    const wsStats = this.wsServer.getConnectionStats();
    
    return {
      ...brokerStats,
      websocket: wsStats
    };
  }

  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      wsServer: !!this.wsServer,
      messageBroker: !!this.messageBroker,
      uptime: process.uptime()
    };
  }
}