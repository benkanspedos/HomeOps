import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

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

export interface CommandIntent {
  action: string;
  target: string;
  parameters: Record<string, any>;
  confidence: number;
  requiresConfirmation: boolean;
  description: string;
}

export interface VoiceProcessingStatus {
  status: 'listening' | 'processing' | 'transcribing' | 'executing' | 'completed' | 'error';
  message?: string;
  progress?: number;
  data?: any;
}

interface UseNLPWebSocketOptions {
  userId: string;
  sessionId: string;
  autoConnect?: boolean;
  serverUrl?: string;
}

interface UseNLPWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  messages: ChatMessage[];
  voiceStatus: VoiceProcessingStatus | null;
  pendingCommand: CommandIntent | null;
  
  // Actions
  sendMessage: (message: string) => void;
  sendVoiceData: (audioData: ArrayBuffer) => void;
  executeCommand: (intent: CommandIntent) => void;
  confirmCommand: (intent: CommandIntent, confirmed: boolean) => void;
  getHistory: (limit?: number) => void;
  clearMessages: () => void;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
  
  // Statistics
  stats: {
    activeSessions: number;
    totalMessages: number;
    connectedUsers: number;
  } | null;
}

export function useNLPWebSocket({
  userId,
  sessionId,
  autoConnect = true,
  serverUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3101'
}: UseNLPWebSocketOptions): UseNLPWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceProcessingStatus | null>(null);
  const [pendingCommand, setPendingCommand] = useState<CommandIntent | null>(null);
  const [stats, setStats] = useState<UseNLPWebSocketReturn['stats']>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      
      // Authenticate after connection
      newSocket.emit('chat:authenticate', { userId, sessionId });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
      
      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++;
            connect();
          }
        }, 2000 * reconnectAttemptsRef.current);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      toast.error('Connection failed. Retrying...');
    });

    // Authentication events
    newSocket.on('chat:authenticated', (data) => {
      console.log('Authenticated:', data);
      toast.success('Connected to chat service');
      
      // Request chat history after authentication
      newSocket.emit('chat:get-history', { sessionId, limit: 50 });
    });

    // Chat message events
    newSocket.on('chat:message-received', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('chat:message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      
      // If message contains execution result, show toast
      if (message.executionResult) {
        if (message.executionResult.success) {
          toast.success(message.executionResult.message);
        } else {
          toast.error(message.executionResult.message);
        }
      }
    });

    newSocket.on('chat:history', (data: { messages: ChatMessage[]; totalCount: number }) => {
      setMessages(data.messages);
    });

    newSocket.on('chat:error', (error: { error: string; details?: string }) => {
      console.error('Chat error:', error);
      toast.error(error.error);
    });

    // Command confirmation events
    newSocket.on('chat:command-confirmation-required', (data: { 
      intent: CommandIntent; 
      messageId: string; 
      sessionId: string 
    }) => {
      setPendingCommand(data.intent);
      toast.info(`Command requires confirmation: ${data.intent.description}`);
    });

    newSocket.on('command:result', (data: { 
      intent: CommandIntent; 
      result: any; 
      sessionId: string 
    }) => {
      if (data.result.success) {
        toast.success(`Command executed: ${data.result.message}`);
      } else {
        toast.error(`Command failed: ${data.result.message}`);
      }
      setPendingCommand(null);
    });

    newSocket.on('command:confirmed-result', (data) => {
      if (data.result.success) {
        toast.success(`Command executed: ${data.result.message}`);
      } else {
        toast.error(`Command failed: ${data.result.message}`);
      }
      setPendingCommand(null);
    });

    newSocket.on('command:cancelled', () => {
      toast.info('Command cancelled');
      setPendingCommand(null);
    });

    newSocket.on('command:error', (error: { error: string; details?: string }) => {
      console.error('Command error:', error);
      toast.error(error.error);
      setPendingCommand(null);
    });

    // Voice processing events
    newSocket.on('voice:status', (status: VoiceProcessingStatus) => {
      setVoiceStatus(status);
      
      if (status.status === 'error') {
        toast.error(status.message || 'Voice processing error');
      }
    });

    newSocket.on('voice:transcription', (data: { 
      transcription: string; 
      intent?: CommandIntent; 
      messageId: string 
    }) => {
      // Add transcribed message to chat
      const message: ChatMessage = {
        id: data.messageId,
        content: data.transcription,
        role: 'user',
        timestamp: new Date().toISOString(),
        sessionId,
        userId,
        commandExecuted: data.intent
      };
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('voice:command-confirmation-required', (data: { 
      intent: CommandIntent; 
      transcription: string; 
      messageId: string 
    }) => {
      setPendingCommand(data.intent);
      toast.info(`Voice command requires confirmation: ${data.intent.description}`);
    });

    newSocket.on('voice:error', (error: { error: string; details?: string }) => {
      console.error('Voice error:', error);
      toast.error(error.error);
      setVoiceStatus(null);
    });

    // System events
    newSocket.on('system:command-executed', (data: { 
      userId: string; 
      intent: CommandIntent; 
      result: any 
    }) => {
      // Show notification for commands executed by other users
      if (data.userId !== userId) {
        toast.info(`System: ${data.intent.description} executed by ${data.userId}`);
      }
    });

    newSocket.on('system:shutdown', (data: { message: string }) => {
      toast.warning(data.message);
      disconnect();
    });

    setSocket(newSocket);
  }, [serverUrl, userId, sessionId]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }
  }, []);

  // Send chat message
  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current?.connected) {
      toast.error('Not connected to chat service');
      return;
    }

    socketRef.current.emit('chat:send-message', { message, sessionId });
  }, [sessionId]);

  // Send voice data
  const sendVoiceData = useCallback((audioData: ArrayBuffer) => {
    if (!socketRef.current?.connected) {
      toast.error('Not connected to chat service');
      return;
    }

    socketRef.current.emit('voice:start-processing', { audioData, sessionId });
  }, [sessionId]);

  // Execute command directly
  const executeCommand = useCallback((intent: CommandIntent) => {
    if (!socketRef.current?.connected) {
      toast.error('Not connected to chat service');
      return;
    }

    socketRef.current.emit('command:execute', { intent, sessionId });
  }, [sessionId]);

  // Confirm or cancel pending command
  const confirmCommand = useCallback((intent: CommandIntent, confirmed: boolean) => {
    if (!socketRef.current?.connected) {
      toast.error('Not connected to chat service');
      return;
    }

    socketRef.current.emit('command:confirm', { intent, sessionId, confirmed });
  }, [sessionId]);

  // Get chat history
  const getHistory = useCallback((limit?: number) => {
    if (!socketRef.current?.connected) {
      toast.error('Not connected to chat service');
      return;
    }

    socketRef.current.emit('chat:get-history', { sessionId, limit });
  }, [sessionId]);

  // Clear messages locally
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Request stats periodically when connected
  useEffect(() => {
    if (!connected || !socketRef.current) return;

    const fetchStats = () => {
      // In a real implementation, you would request stats from server
      // For now, we'll use placeholder data
      setStats({
        activeSessions: 1,
        totalMessages: messages.length,
        connectedUsers: 1
      });
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [connected, messages.length]);

  return {
    socket,
    connected,
    messages,
    voiceStatus,
    pendingCommand,
    sendMessage,
    sendVoiceData,
    executeCommand,
    confirmCommand,
    getHistory,
    clearMessages,
    connect,
    disconnect,
    stats
  };
}

export default useNLPWebSocket;