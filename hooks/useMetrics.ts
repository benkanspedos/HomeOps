import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { monitoringApi } from '@/lib/api/monitoring';
import { ContainerMetrics, SystemMetrics, MetricChartData } from '@/types/monitoring';

interface UseMetricsOptions {
  containerId?: string;
  hours?: number;
  refreshInterval?: number;
}

export function useMetrics({
  containerId,
  hours = 24,
  refreshInterval = 30000,
}: UseMetricsOptions = {}) {
  const [timeRange, setTimeRange] = useState(hours);

  // Container metrics
  const containerMetricsQuery = useQuery({
    queryKey: ['metrics', containerId, timeRange],
    queryFn: () => containerId ? monitoringApi.getMetrics(containerId, timeRange) : Promise.resolve([]),
    enabled: !!containerId,
    refetchInterval: refreshInterval,
    staleTime: 10000,
  });

  // System metrics
  const systemMetricsQuery = useQuery({
    queryKey: ['systemMetrics'],
    queryFn: () => monitoringApi.getSystemHealth(),
    refetchInterval: refreshInterval,
    staleTime: 10000,
  });

  // Current metrics for real-time display
  const currentMetricsQuery = useQuery({
    queryKey: ['currentMetrics', containerId],
    queryFn: () => containerId ? monitoringApi.getCurrentMetrics(containerId) : Promise.resolve(null),
    enabled: !!containerId,
    refetchInterval: 5000, // More frequent updates for current metrics
    staleTime: 2000,
  });

  // Transform metrics data for charts
  const chartData = useMemo<MetricChartData>(() => {
    const metrics = containerMetricsQuery.data || [];
    
    return {
      cpu: metrics.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        value: m.cpuPercent,
        label: `${m.cpuPercent.toFixed(1)}%`,
      })),
      memory: metrics.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        value: m.memoryPercent,
        label: `${m.memoryUsageMB.toFixed(0)} MB`,
      })),
      network: metrics.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        value: (m.networkRxBytes + m.networkTxBytes) / 1024 / 1024, // MB
        label: `${((m.networkRxBytes + m.networkTxBytes) / 1024 / 1024).toFixed(2)} MB`,
      })),
      disk: metrics.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        value: m.diskUsageMB || 0,
        label: `${(m.diskUsageMB || 0).toFixed(0)} MB`,
      })),
    };
  }, [containerMetricsQuery.data]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const metrics = containerMetricsQuery.data || [];
    if (metrics.length === 0) return null;

    const cpuValues = metrics.map(m => m.cpuPercent);
    const memoryValues = metrics.map(m => m.memoryPercent);

    return {
      cpu: {
        average: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
        max: Math.max(...cpuValues),
        min: Math.min(...cpuValues),
      },
      memory: {
        average: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        max: Math.max(...memoryValues),
        min: Math.min(...memoryValues),
      },
    };
  }, [containerMetricsQuery.data]);

  return {
    // Data
    containerMetrics: containerMetricsQuery.data || [],
    systemMetrics: systemMetricsQuery.data,
    currentMetrics: currentMetricsQuery.data,
    chartData,
    statistics,
    
    // Time range controls
    timeRange,
    setTimeRange: (hours: number) => {
      setTimeRange(hours);
      containerMetricsQuery.refetch();
    },
    
    // Loading states
    isLoadingContainer: containerMetricsQuery.isLoading,
    isLoadingSystem: systemMetricsQuery.isLoading,
    isLoadingCurrent: currentMetricsQuery.isLoading,
    
    // Errors
    containerError: containerMetricsQuery.error,
    systemError: systemMetricsQuery.error,
    currentError: currentMetricsQuery.error,
    
    // Refetch functions
    refetchContainer: containerMetricsQuery.refetch,
    refetchSystem: systemMetricsQuery.refetch,
    refetchCurrent: currentMetricsQuery.refetch,
  };
}

// Specialized hook for system metrics only
export function useSystemMetrics(refreshInterval: number = 30000) {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery<SystemMetrics>({
    queryKey: ['systemMetrics'],
    queryFn: () => monitoringApi.getSystemHealth(),
    refetchInterval: refreshInterval,
    staleTime: 10000,
  });

  return {
    metrics: data,
    isLoading,
    error,
    refetch,
  };
}

// Hook for comparing multiple containers
export function useCompareMetrics(containerIds: string[], hours: number = 24) {
  const queries = useQuery({
    queryKey: ['compareMetrics', containerIds, hours],
    queryFn: async () => {
      const promises = containerIds.map(id => 
        monitoringApi.getMetrics(id, hours)
      );
      const results = await Promise.all(promises);
      
      return containerIds.map((id, index) => ({
        containerId: id,
        metrics: results[index],
      }));
    },
    enabled: containerIds.length > 0,
    refetchInterval: 60000, // Less frequent for comparison
    staleTime: 30000,
  });

  return {
    comparisons: queries.data || [],
    isLoading: queries.isLoading,
    error: queries.error,
    refetch: queries.refetch,
  };
}