import {
  ContainerHealth,
  ContainerHealthSummary,
  ContainerMetrics,
  SystemMetrics,
  Alert,
  AlertHistory,
  AlertConfig,
  AlertTemplate,
  NotificationTestResult,
  ContainerLogs,
} from '@/types/monitoring';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101/api';

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.data || data;
}

export const monitoringApi = {
  // Container Health APIs
  async getContainerHealth(containerId?: string): Promise<ContainerHealthSummary> {
    const url = containerId 
      ? `${API_BASE}/health/containers?containerId=${containerId}`
      : `${API_BASE}/health/containers`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    return handleResponse<ContainerHealthSummary>(response);
  },

  async getContainerLogs(containerId: string, lines: number = 100): Promise<ContainerLogs> {
    const response = await fetch(
      `${API_BASE}/health/containers/${containerId}/logs?lines=${lines}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );
    
    return handleResponse<ContainerLogs>(response);
  },

  // Metrics APIs
  async getMetrics(containerId: string, hours: number = 24): Promise<ContainerMetrics[]> {
    const response = await fetch(
      `${API_BASE}/health/metrics/${containerId}?hours=${hours}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );
    
    return handleResponse<ContainerMetrics[]>(response);
  },

  async getCurrentMetrics(containerId: string): Promise<ContainerMetrics> {
    const response = await fetch(
      `${API_BASE}/health/metrics/${containerId}/current`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );
    
    return handleResponse<ContainerMetrics>(response);
  },

  async getSystemHealth(): Promise<SystemMetrics> {
    const response = await fetch(`${API_BASE}/health/system`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    return handleResponse<SystemMetrics>(response);
  },

  // Alert APIs
  async configureAlert(config: AlertConfig): Promise<{ alertId: string }> {
    const response = await fetch(`${API_BASE}/alerts/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    
    return handleResponse<{ alertId: string }>(response);
  },

  async updateAlert(alertId: string, config: Partial<AlertConfig>): Promise<void> {
    const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    
    await handleResponse<void>(response);
  },

  async deleteAlert(alertId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    await handleResponse<void>(response);
  },

  async getAlertHistory(hours: number = 24, alertId?: string): Promise<AlertHistory[]> {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (alertId) params.append('alertId', alertId);
    
    const response = await fetch(`${API_BASE}/alerts/history?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    const data = await handleResponse<{ history: AlertHistory[] }>(response);
    return data.history || [];
  },

  async getAlertTemplates(): Promise<AlertTemplate[]> {
    const response = await fetch(`${API_BASE}/alerts/templates`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    return handleResponse<AlertTemplate[]>(response);
  },

  async testAlert(channel: string, config: any): Promise<NotificationTestResult> {
    const response = await fetch(`${API_BASE}/alerts/test/${channel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    
    return handleResponse<NotificationTestResult>(response);
  },

  // Server-Sent Events for real-time updates
  createHealthStream(): EventSource {
    const eventSource = new EventSource(`${API_BASE}/health/stream`, {
      withCredentials: true,
    });
    
    return eventSource;
  },

  // Container Actions
  async restartContainer(containerId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/services/${containerId}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    await handleResponse<void>(response);
  },

  async stopContainer(containerId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/services/${containerId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    await handleResponse<void>(response);
  },

  async startContainer(containerId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/services/${containerId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    await handleResponse<void>(response);
  },
};

// WebSocket connection for real-time updates (if needed)
export class MonitoringWebSocket {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(private url: string = 'ws://localhost:3101') {}

  connect(): void {
    try {
      this.ws = new WebSocket(`${this.url}/ws`);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.clearReconnectTimer();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data.payload);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        this.connect();
      }, this.reconnectInterval);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export default monitoringApi;