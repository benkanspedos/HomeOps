import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketConfig {
  url?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => () => void;
  off: (event: string) => void;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101',
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

export function useWebSocket(config: WebSocketConfig = {}): UseWebSocketReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventListenersRef = useRef<Map<string, ((data: any) => void)[]>>(new Map());

  const connect = useCallback(() => {
    if (socket?.connected) return;

    const newSocket = io(mergedConfig.url!, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to WebSocket server, attempt:', attemptNumber);
      setIsConnected(true);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to WebSocket server');
      setIsConnected(false);
    });

    setSocket(newSocket);
  }, [mergedConfig.url, socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  const emit = useCallback((event: string, data?: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }, [socket]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
      
      // Track the listener for cleanup
      const listeners = eventListenersRef.current.get(event) || [];
      listeners.push(callback);
      eventListenersRef.current.set(event, listeners);

      return () => {
        socket.off(event, callback);
        const currentListeners = eventListenersRef.current.get(event) || [];
        const filteredListeners = currentListeners.filter(l => l !== callback);
        if (filteredListeners.length > 0) {
          eventListenersRef.current.set(event, filteredListeners);
        } else {
          eventListenersRef.current.delete(event);
        }
      };
    }
    
    return () => {}; // Return empty cleanup function if no socket
  }, [socket]);

  const off = useCallback((event: string) => {
    if (socket) {
      socket.off(event);
      eventListenersRef.current.delete(event);
    }
  }, [socket]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (mergedConfig.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [mergedConfig.autoConnect, connect, disconnect]);

  // Cleanup all event listeners on unmount
  useEffect(() => {
    return () => {
      eventListenersRef.current.clear();
    };
  }, []);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}

// Specialized hook for monitoring WebSocket events
export function useMonitoringWebSocket() {
  const webSocket = useWebSocket();
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const subscribeToRealTime = useCallback((interval: number = 5000) => {
    webSocket.emit('subscribe:real-time', { interval });
  }, [webSocket]);

  const unsubscribeFromRealTime = useCallback(() => {
    webSocket.emit('unsubscribe:real-time');
  }, [webSocket]);

  const requestMetrics = useCallback(() => {
    webSocket.emit('request:metrics');
  }, [webSocket]);

  const requestContainerLogs = useCallback((containerId: string, lines: number = 100) => {
    webSocket.emit('request:container-logs', { containerId, lines });
  }, [webSocket]);

  const requestAlertHistory = useCallback((hours: number = 24, alertId?: string) => {
    webSocket.emit('request:alert-history', { hours, alertId });
  }, [webSocket]);

  // Set up event listeners
  useEffect(() => {
    if (!webSocket.socket) return;

    const cleanupFunctions: (() => void)[] = [];

    // Listen for initial data
    cleanupFunctions.push(
      webSocket.on('initial:data', (data) => {
        setRealTimeData(data);
        setLastUpdate(new Date());
      })
    );

    // Listen for metrics updates
    cleanupFunctions.push(
      webSocket.on('metrics:update', (data) => {
        setRealTimeData(prev => ({ ...prev, ...data }));
        setLastUpdate(new Date());
      })
    );

    // Listen for real-time alerts
    cleanupFunctions.push(
      webSocket.on('alert:broadcast', (alert) => {
        console.log('Real-time alert received:', alert);
        // You can add custom alert handling here
      })
    );

    // Listen for system status changes
    cleanupFunctions.push(
      webSocket.on('system:status', (status) => {
        console.log('System status update:', status);
      })
    );

    // Listen for errors
    cleanupFunctions.push(
      webSocket.on('error', (error) => {
        console.error('WebSocket error:', error);
      })
    );

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [webSocket]);

  return {
    ...webSocket,
    realTimeData,
    lastUpdate,
    subscribeToRealTime,
    unsubscribeFromRealTime,
    requestMetrics,
    requestContainerLogs,
    requestAlertHistory,
  };
}

export default useWebSocket;