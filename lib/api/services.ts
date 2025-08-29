// API service for Docker container management

export interface ServiceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unhealthy';
  container: string;
  port: number;
  healthCheck?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  stats?: {
    cpu: number;
    memory: number;
    network: {
      rx: number;
      tx: number;
    };
  };
}

export interface ServiceHealth {
  totalServices: number;
  running: number;
  stopped: number;
  unhealthy: number;
  cpuUsage: number;
  memoryUsage: number;
  networkRx: number;
  networkTx: number;
  timestamp: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';

class ServicesAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  private async fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  async getServices(): Promise<ServiceStatus[]> {
    return this.fetcher<ServiceStatus[]>('/api/services');
  }

  async getService(id: string): Promise<ServiceStatus> {
    return this.fetcher<ServiceStatus>(`/api/services/${id}`);
  }

  async getServiceStatus(id: string): Promise<{ status: string; healthy: boolean }> {
    return this.fetcher(`/api/services/${id}/status`);
  }

  async startService(id: string): Promise<{ success: boolean; message: string }> {
    return this.fetcher(`/api/services/${id}/start`, { method: 'POST' });
  }

  async stopService(id: string): Promise<{ success: boolean; message: string }> {
    return this.fetcher(`/api/services/${id}/stop`, { method: 'POST' });
  }

  async restartService(id: string): Promise<{ success: boolean; message: string }> {
    return this.fetcher(`/api/services/${id}/restart`, { method: 'POST' });
  }

  async getHealthSummary(): Promise<ServiceHealth> {
    return this.fetcher<ServiceHealth>('/api/services/health/summary');
  }
}

export const servicesAPI = new ServicesAPI();

// Custom hooks for React components
export function useServices() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const data = await servicesAPI.getServices();
        setServices(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
    const interval = setInterval(fetchServices, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return { services, loading, error, refetch: async () => {
    const data = await servicesAPI.getServices();
    setServices(data);
  }};
}

export function useServiceHealth() {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);
        const data = await servicesAPI.getHealthSummary();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return { health, loading, error };
}

// Import React hooks at the top of the file
import { useState, useEffect } from 'react';