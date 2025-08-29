'use client';

import { useState, useEffect, useCallback } from 'react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: number;
  issues: string[];
  metrics: {
    totalAgents: number;
    activeAgents: number;
    healthyAgents: number;
    busyAgents: number;
    offlineAgents: number;
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDuration: number;
    systemLoad: number;
    throughputPerHour: number;
    errorRate: number;
  };
}

interface Agent {
  id: string;
  name: string;
  version: string;
  status: 'available' | 'busy' | 'offline' | 'error';
  capabilities: string[];
  maxConcurrentTasks: number;
  currentTasks: number;
  lastSeen: number;
  registeredAt: number;
  description?: string;
  tags?: string[];
  healthScore: number;
  isHealthy: boolean;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  assignedAgentId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  priority: number;
  parameters: Record<string, any>;
  requiredCapabilities: string[];
  result?: any;
  error?: string;
  progress: number;
  retries: number;
  maxRetries: number;
  timeout?: number;
  metadata?: Record<string, any>;
}

interface DelegationError {
  id: string;
  taskId?: string;
  agentId?: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  recoveryStrategy: string;
  resolved: boolean;
  resolvedAt?: number;
}

interface DelegationStats {
  timestamp: number;
  isRunning: boolean;
  queue: {
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    websocket?: {
      totalConnections: number;
      totalAgents: number;
      activeAgents: number;
    };
  };
  registry: {
    totalAgents: number;
    activeAgents: number;
    healthyAgents: number;
    busyAgents: number;
    offlineAgents: number;
    averageHealthScore: number;
    totalCapabilities: number;
  };
  routing: {
    totalAssignments: number;
    completedTasks: number;
    averageTaskDuration: number;
    ruleUsage: Record<string, number>;
    activeRules: number;
    totalRules: number;
  };
  errors: {
    totalErrors: number;
    recentErrors: number;
    unresolvedErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoveryActions: number;
  };
  systemHealth: {
    status: string;
    timestamp: number;
    issues: string[];
  };
}

export function useDelegation() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errors, setErrors] = useState<DelegationError[]>([]);
  const [stats, setStats] = useState<DelegationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101/api';

  const fetchWithTimeout = async (url: string, timeout = 5000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // Get auth token from localStorage (or wherever you store it)
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const fetchSystemHealth = useCallback(async (): Promise<SystemHealth> => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/health`);
    if (!response.ok) {
      throw new Error(`Failed to fetch system health: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Transform the response to match our interface
    return {
      status: data.status || 'unknown',
      timestamp: data.timestamp || Date.now(),
      issues: data.issues || [],
      metrics: data.metrics || {}
    };
  }, [apiBaseUrl]);

  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/agents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }, [apiBaseUrl]);

  const fetchTasks = useCallback(async (): Promise<Task[]> => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/tasks`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }, [apiBaseUrl]);

  const fetchErrors = useCallback(async (): Promise<DelegationError[]> => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/errors`);
    if (!response.ok) {
      throw new Error(`Failed to fetch errors: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }, [apiBaseUrl]);

  const fetchStats = useCallback(async (): Promise<DelegationStats> => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    return await response.json();
  }, [apiBaseUrl]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [healthData, agentsData, tasksData, errorsData, statsData] = await Promise.allSettled([
        fetchSystemHealth(),
        fetchAgents(),
        fetchTasks(),
        fetchErrors(),
        fetchStats(),
      ]);

      // Process results
      if (healthData.status === 'fulfilled') {
        setSystemHealth(healthData.value);
      } else {
        console.error('Failed to fetch system health:', healthData.reason);
      }

      if (agentsData.status === 'fulfilled') {
        setAgents(agentsData.value);
      } else {
        console.error('Failed to fetch agents:', agentsData.reason);
      }

      if (tasksData.status === 'fulfilled') {
        setTasks(tasksData.value);
      } else {
        console.error('Failed to fetch tasks:', tasksData.reason);
      }

      if (errorsData.status === 'fulfilled') {
        setErrors(errorsData.value);
      } else {
        console.error('Failed to fetch errors:', errorsData.reason);
      }

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      } else {
        console.error('Failed to fetch stats:', statsData.reason);
      }

      // If all requests failed, set error
      const allFailed = [healthData, agentsData, tasksData, errorsData, statsData]
        .every(result => result.status === 'rejected');
      
      if (allFailed) {
        setError('Unable to connect to delegation service. Please check if the backend is running.');
      }

    } catch (err) {
      console.error('Error refreshing delegation data:', err);
      setError('Failed to load delegation data');
    } finally {
      setIsLoading(false);
    }
  }, [fetchSystemHealth, fetchAgents, fetchTasks, fetchErrors, fetchStats]);

  // Task management functions
  const submitTask = useCallback(async (taskData: {
    name: string;
    description?: string;
    priority?: number;
    parameters?: Record<string, any>;
    requiredCapabilities?: string[];
    timeout?: number;
    retries?: number;
  }): Promise<string> => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/tasks`, 5000);
    if (!response.ok) {
      throw new Error(`Failed to submit task: ${response.statusText}`);
    }
    
    const result = await fetch(`${apiBaseUrl}/delegation/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!result.ok) {
      throw new Error(`Failed to submit task: ${result.statusText}`);
    }

    const data = await result.json();
    
    // Refresh data after submitting task
    refreshData();
    
    return data.taskId;
  }, [apiBaseUrl, refreshData]);

  const getTaskProgress = useCallback(async (taskId: string) => {
    const response = await fetchWithTimeout(`${apiBaseUrl}/delegation/tasks/${taskId}/progress`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task progress: ${response.statusText}`);
    }
    return await response.json();
  }, [apiBaseUrl]);

  const cancelTask = useCallback(async (taskId: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/delegation/tasks/${taskId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel task: ${response.statusText}`);
    }

    // Refresh data after canceling task
    refreshData();
  }, [apiBaseUrl, refreshData]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        refreshData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshData, isLoading]);

  return {
    // State
    systemHealth,
    agents,
    tasks,
    errors,
    stats,
    isLoading,
    error,

    // Actions
    refreshData,
    submitTask,
    getTaskProgress,
    cancelTask,

    // Computed values
    isConnected: !error && (systemHealth !== null || agents.length > 0),
    activeAgentCount: agents.filter(agent => agent.status === 'available').length,
    activeTasks: tasks.filter(task => task.status === 'in_progress'),
    unresolvedErrors: errors.filter(error => !error.resolved),
  };
}