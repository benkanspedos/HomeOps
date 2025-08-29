import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { monitoringApi } from '@/lib/api/monitoring';
import { ContainerHealthSummary } from '@/types/monitoring';

export function useContainerHealth(refreshInterval: number = 10000) {
  const queryClient = useQueryClient();
  
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery<ContainerHealthSummary>({
    queryKey: ['containerHealth'],
    queryFn: () => monitoringApi.getContainerHealth(),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });

  // Container action mutations
  const restartMutation = useMutation({
    mutationFn: (containerId: string) => monitoringApi.restartContainer(containerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerHealth'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (containerId: string) => monitoringApi.stopContainer(containerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerHealth'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: (containerId: string) => monitoringApi.startContainer(containerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerHealth'] });
    },
  });

  // Real-time updates via SSE
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const eventSource = monitoringApi.createHealthStream();
    
    eventSource.onmessage = (event) => {
      try {
        const updatedData = JSON.parse(event.data);
        queryClient.setQueryData(['containerHealth'], updatedData);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
      // Fallback to polling
      refetch();
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient, refetch]);

  return {
    containers: data?.containers || [],
    summary: data ? {
      total: data.total,
      running: data.running,
      stopped: data.stopped,
      unhealthy: data.unhealthy,
    } : null,
    isLoading,
    error,
    refetch,
    restartContainer: restartMutation.mutate,
    stopContainer: stopMutation.mutate,
    startContainer: startMutation.mutate,
    isRestarting: restartMutation.isPending,
    isStopping: stopMutation.isPending,
    isStarting: startMutation.isPending,
  };
}

// Hook for individual container health
export function useContainer(containerId: string) {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['container', containerId],
    queryFn: () => monitoringApi.getContainerHealth(containerId),
    refetchInterval: 5000,
    enabled: !!containerId,
  });

  return {
    container: data?.containers?.[0],
    isLoading,
    error,
    refetch,
  };
}

// Hook for container logs
export function useContainerLogs(containerId: string, lines: number = 100) {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['containerLogs', containerId, lines],
    queryFn: () => monitoringApi.getContainerLogs(containerId, lines),
    enabled: !!containerId,
    refetchInterval: false, // Manual refresh only
  });

  return {
    logs: data?.lines || [],
    isLoading,
    error,
    refetch,
  };
}