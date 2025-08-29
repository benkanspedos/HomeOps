import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { healthMonitor } from './health-monitor.service';
import { alertService } from './alert.service';
import { openaiService, CommandIntent } from './openai.service';
import { commandExecutionEngine, SecurityContext } from './command-execution.service';
import winston from 'winston';

export interface RealTimeMetrics {
  containers: any[];
  system: any;
  alerts: any[];
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  commandExecuted?: CommandIntent;
  executionResult?: any;
  sessionId: string;
  userId: string;
}

export interface VoiceProcessingStatus {
  status: 'listening' | 'processing' | 'transcribing' | 'executing' | 'completed' | 'error';
  message?: string;
  progress?: number;
  data?: any;
}

export class WebSocketService {
  private io: SocketIOServer;
  private logger: winston.Logger;
  private metricsInterval?: NodeJS.Timeout;
  private connectedClients: Set<string> = new Set();
  private chatSessions: Map<string, ChatMessage[]> = new Map();
  private userSessions: Map<string, string> = new Map(); // socketId -> userId

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
        new winston.transports.File({ 
          filename: 'logs/websocket.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
    });

    this.setupEventHandlers();
    this.logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // Send initial data immediately
      this.sendInitialData(socket);

      // Handle client requests
      socket.on('request:metrics', async () => {
        await this.sendMetricsToSocket(socket);
      });

      socket.on('request:container-logs', async (data: { containerId: string; lines?: number }) => {
        await this.sendContainerLogs(socket, data.containerId, data.lines);
      });

      socket.on('request:alert-history', async (data: { hours?: number; alertId?: string }) => {
        await this.sendAlertHistory(socket, data.hours, data.alertId);
      });

      socket.on('subscribe:real-time', (data: { interval?: number }) => {
        this.startRealTimeUpdates(socket, data.interval);
      });

      socket.on('unsubscribe:real-time', () => {
        this.stopRealTimeUpdates(socket);
      });

      // Natural Language Interface handlers
      socket.on('chat:authenticate', (data: { userId: string, sessionId: string }) => {
        this.authenticateUser(socket, data.userId, data.sessionId);
      });

      socket.on('chat:send-message', async (data: { message: string, sessionId: string }) => {
        await this.handleChatMessage(socket, data);
      });

      socket.on('voice:start-processing', async (data: { audioData: ArrayBuffer, sessionId: string }) => {
        await this.handleVoiceInput(socket, data);
      });

      socket.on('command:execute', async (data: { intent: CommandIntent, sessionId: string }) => {
        await this.handleCommandExecution(socket, data);
      });

      socket.on('command:confirm', async (data: { intent: CommandIntent, sessionId: string, confirmed: boolean }) => {
        await this.handleCommandConfirmation(socket, data);
      });

      socket.on('chat:get-history', (data: { sessionId: string, limit?: number }) => {
        this.sendChatHistory(socket, data.sessionId, data.limit);
      });

      socket.on('disconnect', (reason) => {
        this.logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.connectedClients.delete(socket.id);
        this.userSessions.delete(socket.id);
        this.stopRealTimeUpdates(socket);
      });

      socket.on('error', (error) => {
        this.logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    // Listen to health monitor events
    healthMonitor.on('container:down', (data) => {
      this.broadcastAlert('container_down', data);
    });

    healthMonitor.on('container:restart-loop', (data) => {
      this.broadcastAlert('restart_loop', data);
    });

    healthMonitor.on('container:unhealthy', (data) => {
      this.broadcastAlert('container_unhealthy', data);
    });

    healthMonitor.on('threshold:cpu-high', (data) => {
      this.broadcastAlert('cpu_threshold', data);
    });

    healthMonitor.on('threshold:memory-high', (data) => {
      this.broadcastAlert('memory_threshold', data);
    });

    // Listen to alert service events
    alertService.on('alert:triggered', (data) => {
      this.broadcastAlert('alert_triggered', data);
    });
  }

  private async sendInitialData(socket: Socket): Promise<void> {
    try {
      const [containers, systemMetrics, alertHistory] = await Promise.all([
        healthMonitor.checkContainerHealth(),
        healthMonitor.getResourceUsage(),
        alertService.getAlertHistory(24)
      ]);

      const initialData: RealTimeMetrics = {
        containers,
        system: systemMetrics,
        alerts: alertHistory,
        timestamp: new Date().toISOString()
      };

      socket.emit('initial:data', initialData);
      this.logger.debug(`Initial data sent to ${socket.id}`);
    } catch (error) {
      this.logger.error(`Failed to send initial data to ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to load initial data' });
    }
  }

  private async sendMetricsToSocket(socket: Socket): Promise<void> {
    try {
      const [containers, systemMetrics, containerMetrics] = await Promise.all([
        healthMonitor.checkContainerHealth(),
        healthMonitor.getResourceUsage(),
        healthMonitor.collectMetrics()
      ]);

      const metricsData = {
        containers,
        system: systemMetrics,
        containerMetrics,
        timestamp: new Date().toISOString()
      };

      socket.emit('metrics:update', metricsData);
      this.logger.debug(`Metrics sent to ${socket.id}`);
    } catch (error) {
      this.logger.error(`Failed to send metrics to ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to load metrics' });
    }
  }

  private async sendContainerLogs(socket: Socket, containerId: string, lines: number = 100): Promise<void> {
    try {
      const logs = await healthMonitor.getContainerLogs(containerId, lines);
      
      socket.emit('logs:update', {
        containerId,
        logs,
        timestamp: new Date().toISOString()
      });

      this.logger.debug(`Container logs sent to ${socket.id} for ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to send container logs to ${socket.id}:`, error);
      socket.emit('error', { message: `Failed to load logs for container ${containerId}` });
    }
  }

  private async sendAlertHistory(socket: Socket, hours: number = 24, alertId?: string): Promise<void> {
    try {
      const alerts = await alertService.getAlertHistory(hours, alertId);
      
      socket.emit('alerts:history', {
        alerts,
        hours,
        alertId,
        timestamp: new Date().toISOString()
      });

      this.logger.debug(`Alert history sent to ${socket.id}`);
    } catch (error) {
      this.logger.error(`Failed to send alert history to ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to load alert history' });
    }
  }

  private startRealTimeUpdates(socket: Socket, interval: number = 5000): void {
    // Clear any existing interval
    this.stopRealTimeUpdates(socket);

    // Store interval on socket for cleanup
    (socket as any).metricsInterval = setInterval(async () => {
      await this.sendMetricsToSocket(socket);
    }, Math.max(interval, 1000)); // Minimum 1 second

    this.logger.debug(`Real-time updates started for ${socket.id} with ${interval}ms interval`);
  }

  private stopRealTimeUpdates(socket: Socket): void {
    if ((socket as any).metricsInterval) {
      clearInterval((socket as any).metricsInterval);
      (socket as any).metricsInterval = null;
      this.logger.debug(`Real-time updates stopped for ${socket.id}`);
    }
  }

  private broadcastAlert(type: string, data: any): void {
    const alertData = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.io.emit('alert:broadcast', alertData);
    this.logger.info(`Alert broadcast: ${type}`, { clientCount: this.connectedClients.size });
  }

  public broadcastMetricsUpdate(): void {
    // This can be called externally to trigger a metrics update to all connected clients
    this.io.emit('metrics:refresh', { timestamp: new Date().toISOString() });
  }

  public getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  public broadcastSystemStatus(status: 'operational' | 'degraded' | 'warning' | 'critical'): void {
    this.io.emit('system:status', {
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Authenticate user and establish session
   */
  private authenticateUser(socket: Socket, userId: string, sessionId: string): void {
    this.userSessions.set(socket.id, userId);
    
    if (!this.chatSessions.has(sessionId)) {
      this.chatSessions.set(sessionId, []);
    }

    socket.emit('chat:authenticated', {
      userId,
      sessionId,
      timestamp: new Date().toISOString()
    });

    this.logger.info(`User authenticated`, { socketId: socket.id, userId, sessionId });
  }

  /**
   * Handle chat message and process with OpenAI
   */
  private async handleChatMessage(socket: Socket, data: { message: string, sessionId: string }): Promise<void> {
    const userId = this.userSessions.get(socket.id);
    if (!userId) {
      socket.emit('chat:error', { error: 'User not authenticated' });
      return;
    }

    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create user message
      const userMessage: ChatMessage = {
        id: messageId,
        content: data.message,
        role: 'user',
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        userId
      };

      // Add to session history
      const sessionMessages = this.chatSessions.get(data.sessionId) || [];
      sessionMessages.push(userMessage);
      
      // Send user message confirmation
      socket.emit('chat:message-received', userMessage);

      // Process natural language intent
      let intent: CommandIntent | null = null;
      try {
        intent = await openaiService.processNaturalLanguage(data.message, userId);
        
        // If intent detected, ask for execution confirmation
        if (intent && intent.requiresConfirmation) {
          socket.emit('chat:command-confirmation-required', {
            intent,
            messageId: userMessage.id,
            sessionId: data.sessionId,
            timestamp: new Date().toISOString()
          });
          return;
        }
      } catch (error: any) {
        this.logger.warn('Intent recognition failed:', error.message);
      }

      // Generate conversational response
      const context = sessionMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await openaiService.generateResponse(context, userId);

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        userId,
        commandExecuted: intent || undefined
      };

      // Execute command if intent was detected and doesn't require confirmation
      if (intent && !intent.requiresConfirmation) {
        const executionResult = await this.executeCommandWithContext(intent, userId, data.sessionId, socket);
        assistantMessage.executionResult = executionResult;
      }

      sessionMessages.push(assistantMessage);
      this.chatSessions.set(data.sessionId, sessionMessages.slice(-50)); // Keep last 50 messages

      socket.emit('chat:message', assistantMessage);

    } catch (error: any) {
      this.logger.error('Chat message handling failed:', error);
      socket.emit('chat:error', { 
        error: 'Failed to process message', 
        details: error.message 
      });
    }
  }

  /**
   * Handle voice input processing
   */
  private async handleVoiceInput(socket: Socket, data: { audioData: ArrayBuffer, sessionId: string }): Promise<void> {
    const userId = this.userSessions.get(socket.id);
    if (!userId) {
      socket.emit('voice:error', { error: 'User not authenticated' });
      return;
    }

    try {
      // Send processing status
      socket.emit('voice:status', {
        status: 'processing',
        message: 'Processing voice input...',
        progress: 0
      } as VoiceProcessingStatus);

      // Convert ArrayBuffer to Buffer
      const audioBuffer = Buffer.from(data.audioData);

      // Update status - transcribing
      socket.emit('voice:status', {
        status: 'transcribing',
        message: 'Converting speech to text...',
        progress: 30
      } as VoiceProcessingStatus);

      // Process voice with OpenAI Whisper
      const voiceResult = await openaiService.processVoiceInput(audioBuffer, userId);

      if (voiceResult.error) {
        socket.emit('voice:error', { error: voiceResult.error });
        return;
      }

      // Update status - analyzing intent
      socket.emit('voice:status', {
        status: 'processing',
        message: 'Analyzing command intent...',
        progress: 60
      } as VoiceProcessingStatus);

      const transcription = voiceResult.transcription;
      const intent = voiceResult.intent;

      // Create message from transcription
      const messageId = `voice_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userMessage: ChatMessage = {
        id: messageId,
        content: transcription,
        role: 'user',
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        userId
      };

      // Add to session
      const sessionMessages = this.chatSessions.get(data.sessionId) || [];
      sessionMessages.push(userMessage);

      // Send transcription result
      socket.emit('voice:transcription', {
        transcription,
        intent,
        messageId,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });

      // Handle intent if present
      if (intent) {
        if (intent.requiresConfirmation) {
          socket.emit('voice:command-confirmation-required', {
            intent,
            transcription,
            messageId,
            sessionId: data.sessionId,
            timestamp: new Date().toISOString()
          });
        } else {
          // Execute command directly
          socket.emit('voice:status', {
            status: 'executing',
            message: `Executing: ${intent.description}`,
            progress: 80
          } as VoiceProcessingStatus);

          const executionResult = await this.executeCommandWithContext(intent, userId, data.sessionId, socket);
          
          const assistantMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: `Command executed: ${intent.description}\nResult: ${executionResult.message}`,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            sessionId: data.sessionId,
            userId,
            commandExecuted: intent,
            executionResult
          };

          sessionMessages.push(assistantMessage);
          this.chatSessions.set(data.sessionId, sessionMessages.slice(-50));

          socket.emit('voice:status', {
            status: 'completed',
            message: 'Command completed successfully',
            progress: 100,
            data: { result: executionResult, message: assistantMessage }
          } as VoiceProcessingStatus);
        }
      } else {
        // No command intent - just acknowledge transcription
        socket.emit('voice:status', {
          status: 'completed',
          message: 'Voice input processed',
          progress: 100,
          data: { transcription, message: userMessage }
        } as VoiceProcessingStatus);
      }

    } catch (error: any) {
      this.logger.error('Voice input handling failed:', error);
      socket.emit('voice:error', { 
        error: 'Failed to process voice input', 
        details: error.message 
      });
    }
  }

  /**
   * Handle command execution requests
   */
  private async handleCommandExecution(socket: Socket, data: { intent: CommandIntent, sessionId: string }): Promise<void> {
    const userId = this.userSessions.get(socket.id);
    if (!userId) {
      socket.emit('command:error', { error: 'User not authenticated' });
      return;
    }

    try {
      const executionResult = await this.executeCommandWithContext(data.intent, userId, data.sessionId, socket);
      
      socket.emit('command:result', {
        intent: data.intent,
        result: executionResult,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      this.logger.error('Command execution failed:', error);
      socket.emit('command:error', { 
        error: 'Command execution failed', 
        details: error.message 
      });
    }
  }

  /**
   * Handle command confirmation
   */
  private async handleCommandConfirmation(socket: Socket, data: { intent: CommandIntent, sessionId: string, confirmed: boolean }): Promise<void> {
    const userId = this.userSessions.get(socket.id);
    if (!userId) {
      socket.emit('command:error', { error: 'User not authenticated' });
      return;
    }

    try {
      if (!data.confirmed) {
        socket.emit('command:cancelled', {
          intent: data.intent,
          sessionId: data.sessionId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Add confirmation parameter and execute
      const confirmedIntent = {
        ...data.intent,
        parameters: { ...data.intent.parameters, confirmed: true }
      };

      const executionResult = await this.executeCommandWithContext(confirmedIntent, userId, data.sessionId, socket);
      
      socket.emit('command:confirmed-result', {
        intent: confirmedIntent,
        result: executionResult,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      this.logger.error('Command confirmation handling failed:', error);
      socket.emit('command:error', { 
        error: 'Command confirmation failed', 
        details: error.message 
      });
    }
  }

  /**
   * Execute command with proper security context
   */
  private async executeCommandWithContext(intent: CommandIntent, userId: string, sessionId: string, socket: Socket): Promise<any> {
    const securityContext: SecurityContext = {
      userId,
      sessionId,
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    };

    const result = await commandExecutionEngine.executeCommand(intent, securityContext);
    
    // Broadcast command execution to other relevant clients
    if (result.success) {
      this.broadcastCommandExecution(userId, intent, result);
    }

    return result;
  }

  /**
   * Send chat history for a session
   */
  private sendChatHistory(socket: Socket, sessionId: string, limit: number = 50): void {
    const messages = this.chatSessions.get(sessionId) || [];
    const limitedMessages = messages.slice(-limit);

    socket.emit('chat:history', {
      sessionId,
      messages: limitedMessages,
      totalCount: messages.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast command execution to relevant clients
   */
  private broadcastCommandExecution(userId: string, intent: CommandIntent, result: any): void {
    this.io.emit('system:command-executed', {
      userId,
      intent,
      result,
      timestamp: new Date().toISOString()
    });

    this.logger.info('Command execution broadcast', {
      userId,
      action: intent.action,
      target: intent.target,
      success: result.success
    });
  }

  /**
   * Get chat session statistics
   */
  public getChatStats(): {
    activeSessions: number;
    totalMessages: number;
    connectedUsers: number;
  } {
    const totalMessages = Array.from(this.chatSessions.values())
      .reduce((total, messages) => total + messages.length, 0);

    return {
      activeSessions: this.chatSessions.size,
      totalMessages,
      connectedUsers: this.userSessions.size
    };
  }

  public async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Disconnect all clients gracefully
    this.io.emit('system:shutdown', { message: 'Server is shutting down' });
    
    // Wait a moment for clients to receive the message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.io.close();
    this.logger.info('WebSocket service shut down');
  }
}

// Singleton pattern - will be initialized in server.ts
let webSocketService: WebSocketService | null = null;

export const initializeWebSocket = (httpServer: HTTPServer): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(httpServer);
  }
  return webSocketService;
};

export const getWebSocketService = (): WebSocketService | null => {
  return webSocketService;
};

export default WebSocketService;