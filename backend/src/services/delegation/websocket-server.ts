import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { 
  DelegationMessage, 
  MessageType, 
  Agent, 
  AgentStatus, 
  TaskRequest, 
  TaskResponse,
  AgentRegistration,
  AgentHeartbeat,
  DelegationConfig
} from '../../types/delegation.js';
import { logger } from '../../utils/logger.js';

export class DelegationWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private connections = new Map<string, WebSocket>();
  private agents = new Map<string, Agent>();
  private config: DelegationConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: DelegationConfig) {
    super();
    this.config = config;
    
    this.wss = new WebSocketServer({
      port: config.websocket.port,
      path: config.websocket.path,
      maxPayload: 16 * 1024 * 1024, // 16MB max message size
    });

    this.setupServer();
    this.startHeartbeatMonitoring();
    
    logger.info(`Delegation WebSocket server started on port ${config.websocket.port}`);
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const connectionId = uuidv4();
      const clientIp = request.socket.remoteAddress;
      
      // Authenticate WebSocket connection
      if (!this.authenticateConnection(request)) {
        logger.warn(`WebSocket authentication failed for ${clientIp}`);
        ws.close(1008, 'Authentication required');
        return;
      }
      
      logger.info(`Authenticated WebSocket connection: ${connectionId} from ${clientIp}`);
      
      // Store connection
      this.connections.set(connectionId, ws);
      
      // Set up connection metadata
      (ws as any).connectionId = connectionId;
      (ws as any).connectedAt = Date.now();
      (ws as any).lastActivity = Date.now();

      // Setup ping/pong
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
        (ws as any).lastActivity = Date.now();
      });

      // Handle messages
      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data, ws);
      });

      // Handle connection close
      ws.on('close', (code: number, reason: Buffer) => {
        logger.info(`WebSocket connection closed: ${connectionId}, code: ${code}, reason: ${reason.toString()}`);
        this.handleDisconnection(connectionId);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        logger.error(`WebSocket error on connection ${connectionId}:`, error);
        this.handleConnectionError(connectionId, error);
      });

      // Send welcome message
      this.sendMessage(connectionId, {
        id: uuidv4(),
        type: MessageType.SYSTEM_EVENT,
        timestamp: Date.now(),
        agentId: 'system',
        event: {
          name: 'connection_established',
          level: 'info',
          description: 'WebSocket connection established successfully',
          data: { connectionId }
        }
      });
    });

    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  private handleMessage(connectionId: string, data: Buffer, ws: WebSocket): void {
    try {
      const message: DelegationMessage = JSON.parse(data.toString());
      
      // Validate message structure
      if (!this.validateMessage(message)) {
        this.sendError(connectionId, 'INVALID_MESSAGE', 'Message format is invalid');
        return;
      }

      // Update last activity
      (ws as any).lastActivity = Date.now();

      // Log message for debugging
      logger.debug(`Received message from ${connectionId}:`, {
        type: message.type,
        id: message.id,
        agentId: message.agentId
      });

      // Route message based on type
      switch (message.type) {
        case MessageType.AGENT_REGISTER:
          this.handleAgentRegistration(connectionId, message as AgentRegistration);
          break;
          
        case MessageType.AGENT_HEARTBEAT:
          this.handleAgentHeartbeat(connectionId, message as AgentHeartbeat);
          break;
          
        case MessageType.TASK_RESPONSE:
          this.handleTaskResponse(connectionId, message as TaskResponse);
          break;
          
        default:
          // Forward message to event system for other handlers
          this.emit('message', { connectionId, message });
      }

    } catch (error) {
      logger.error(`Failed to process message from ${connectionId}:`, error);
      this.sendError(connectionId, 'MESSAGE_PROCESSING_ERROR', 'Failed to process message');
    }
  }

  private validateMessage(message: any): message is DelegationMessage {
    return (
      typeof message === 'object' &&
      typeof message.id === 'string' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.agentId === 'string' &&
      Object.values(MessageType).includes(message.type)
    );
  }

  private handleAgentRegistration(connectionId: string, message: AgentRegistration): void {
    const agent: Agent = {
      id: message.agentId,
      name: message.agent.name,
      version: message.agent.version,
      status: AgentStatus.AVAILABLE,
      capabilities: message.agent.capabilities,
      maxConcurrentTasks: message.agent.maxConcurrentTasks,
      currentTasks: 0,
      lastSeen: Date.now(),
      registeredAt: Date.now(),
      description: message.agent.description,
      tags: message.agent.tags,
      connectionId: connectionId
    };

    this.agents.set(message.agentId, agent);
    
    logger.info(`Agent registered: ${agent.name} (${agent.id})`, {
      capabilities: agent.capabilities,
      maxTasks: agent.maxConcurrentTasks
    });

    // Acknowledge registration
    this.sendMessage(connectionId, {
      id: uuidv4(),
      type: MessageType.SYSTEM_EVENT,
      timestamp: Date.now(),
      agentId: 'system',
      event: {
        name: 'agent_registered',
        level: 'info',
        description: `Agent ${agent.name} registered successfully`,
        data: { agentId: agent.id }
      }
    });

    // Emit registration event for other components
    this.emit('agent_registered', agent);
  }

  private handleAgentHeartbeat(connectionId: string, message: AgentHeartbeat): void {
    const agent = this.agents.get(message.agentId);
    
    if (!agent) {
      this.sendError(connectionId, 'AGENT_NOT_REGISTERED', 'Agent must register before sending heartbeat');
      return;
    }

    // Update agent status
    agent.status = message.status;
    agent.currentTasks = message.currentTasks;
    agent.lastSeen = Date.now();

    // Emit heartbeat event
    this.emit('agent_heartbeat', { agent, heartbeat: message });
    
    logger.debug(`Heartbeat from agent ${agent.name}: ${agent.status}, tasks: ${agent.currentTasks}/${agent.maxConcurrentTasks}`);
  }

  private handleTaskResponse(connectionId: string, message: TaskResponse): void {
    logger.info(`Task response from agent ${message.agentId}:`, {
      taskId: message.taskId,
      status: message.status,
      hasResult: !!message.result,
      hasError: !!message.error
    });

    // Emit task response for task manager
    this.emit('task_response', message);
  }

  private handleDisconnection(connectionId: string): void {
    // Remove connection
    this.connections.delete(connectionId);

    // Find and update agents associated with this connection
    for (const [agentId, agent] of this.agents) {
      if (agent.connectionId === connectionId) {
        agent.status = AgentStatus.OFFLINE;
        agent.connectionId = undefined;
        
        logger.info(`Agent disconnected: ${agent.name} (${agent.id})`);
        this.emit('agent_disconnected', agent);
      }
    }
  }

  private authenticateConnection(request: IncomingMessage): boolean {
    try {
      // Skip authentication in development or if explicitly disabled
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_WS_AUTH === 'true') {
        logger.debug('Skipping WebSocket authentication in development mode');
        return true;
      }

      // Extract token from query parameters or headers
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || 
                   request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('WebSocket connection missing authentication token');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      if (!decoded || !decoded.userId) {
        logger.warn('Invalid WebSocket authentication token');
        return false;
      }

      // Store user info in request for later use
      (request as any).user = decoded;
      
      logger.debug(`WebSocket authenticated for user: ${decoded.userId}`);
      return true;

    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      return false;
    }
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    logger.error(`Connection error for ${connectionId}:`, error);
    
    // Clean up connection
    this.handleDisconnection(connectionId);
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      // Ping all connections
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.warn(`Terminating inactive connection: ${(ws as any).connectionId}`);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });

      // Check for stale agents
      const now = Date.now();
      const maxMissedHeartbeats = this.config.agents.maxMissedHeartbeats;
      const heartbeatInterval = this.config.agents.heartbeatInterval;
      const staleThreshold = maxMissedHeartbeats * heartbeatInterval;

      for (const [agentId, agent] of this.agents) {
        if (now - agent.lastSeen > staleThreshold && agent.status !== AgentStatus.OFFLINE) {
          logger.warn(`Agent ${agent.name} (${agent.id}) appears to be stale, marking as offline`);
          agent.status = AgentStatus.OFFLINE;
          this.emit('agent_stale', agent);
        }
      }

    }, this.config.websocket.pingInterval);
  }

  public sendMessage(connectionId: string, message: DelegationMessage): boolean {
    const ws = this.connections.get(connectionId);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn(`Cannot send message to ${connectionId}: connection not available`);
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      logger.debug(`Sent message to ${connectionId}:`, { type: message.type, id: message.id });
      return true;
    } catch (error) {
      logger.error(`Failed to send message to ${connectionId}:`, error);
      return false;
    }
  }

  public sendToAgent(agentId: string, message: DelegationMessage): boolean {
    const agent = this.agents.get(agentId);
    
    if (!agent || !agent.connectionId) {
      logger.warn(`Cannot send message to agent ${agentId}: agent not connected`);
      return false;
    }

    return this.sendMessage(agent.connectionId, message);
  }

  public broadcast(message: DelegationMessage, excludeConnectionId?: string): number {
    let sentCount = 0;
    
    for (const [connectionId, ws] of this.connections) {
      if (connectionId !== excludeConnectionId && ws.readyState === WebSocket.OPEN) {
        if (this.sendMessage(connectionId, message)) {
          sentCount++;
        }
      }
    }

    logger.debug(`Broadcasted message to ${sentCount} connections`);
    return sentCount;
  }

  private sendError(connectionId: string, code: string, message: string): void {
    this.sendMessage(connectionId, {
      id: uuidv4(),
      type: MessageType.ERROR,
      timestamp: Date.now(),
      agentId: 'system',
      error: {
        code,
        message
      }
    });
  }

  public getConnectedAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.status !== AgentStatus.OFFLINE
    );
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  public getConnectionStats(): any {
    return {
      totalConnections: this.connections.size,
      totalAgents: this.agents.size,
      activeAgents: this.getConnectedAgents().length,
      agentsByStatus: {
        available: Array.from(this.agents.values()).filter(a => a.status === AgentStatus.AVAILABLE).length,
        busy: Array.from(this.agents.values()).filter(a => a.status === AgentStatus.BUSY).length,
        offline: Array.from(this.agents.values()).filter(a => a.status === AgentStatus.OFFLINE).length,
        error: Array.from(this.agents.values()).filter(a => a.status === AgentStatus.ERROR).length,
      }
    };
  }

  public shutdown(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('Shutting down Delegation WebSocket Server...');
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Close all connections
      this.wss.clients.forEach((ws) => {
        ws.close(1000, 'Server shutdown');
      });

      // Close server
      this.wss.close(() => {
        logger.info('Delegation WebSocket Server shutdown complete');
        resolve();
      });
    });
  }
}

// Extend WebSocket interface to include isAlive property
declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean;
  }
}