import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { monitoringApi } from '@/lib/api/monitoring';
import {
  Alert,
  AlertHistory,
  AlertConfig,
  AlertTemplate,
  NotificationTestResult,
} from '@/types/monitoring';

export function useAlerts() {
  const queryClient = useQueryClient();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Get alert history
  const historyQuery = useQuery<AlertHistory[]>({
    queryKey: ['alertHistory'],
    queryFn: () => monitoringApi.getAlertHistory(),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  // Get alert templates
  const templatesQuery = useQuery<AlertTemplate[]>({
    queryKey: ['alertTemplates'],
    queryFn: () => monitoringApi.getAlertTemplates(),
    staleTime: 300000, // Templates don't change often
  });

  // Configure new alert
  const configureMutation = useMutation({
    mutationFn: (config: AlertConfig) => monitoringApi.configureAlert(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
    },
  });

  // Update existing alert
  const updateMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: Partial<AlertConfig> }) =>
      monitoringApi.updateAlert(id, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Delete alert
  const deleteMutation = useMutation({
    mutationFn: (alertId: string) => monitoringApi.deleteAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
    },
  });

  // Test alert channel
  const testMutation = useMutation<
    NotificationTestResult,
    Error,
    { channel: string; config: any }
  >({
    mutationFn: ({ channel, config }) => monitoringApi.testAlert(channel, config),
  });

  return {
    // Data
    history: historyQuery.data || [],
    templates: templatesQuery.data || [],
    selectedAlert,
    
    // Selection
    selectAlert: setSelectedAlert,
    
    // Loading states
    isLoadingHistory: historyQuery.isLoading,
    isLoadingTemplates: templatesQuery.isLoading,
    isConfiguring: configureMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTesting: testMutation.isPending,
    
    // Errors
    historyError: historyQuery.error,
    templatesError: templatesQuery.error,
    configureError: configureMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
    testError: testMutation.error,
    
    // Actions
    configureAlert: configureMutation.mutate,
    updateAlert: updateMutation.mutate,
    deleteAlert: deleteMutation.mutate,
    testAlert: testMutation.mutate,
    
    // Test results
    testResult: testMutation.data,
    
    // Refetch
    refetchHistory: historyQuery.refetch,
    refetchTemplates: templatesQuery.refetch,
  };
}

// Hook for alert statistics
export function useAlertStatistics(hours: number = 24) {
  const { history, isLoadingHistory } = useAlerts();

  const statistics = {
    total: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    byPriority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    recentAlerts: [] as AlertHistory[],
  };

  if (history && history.length > 0) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const recentHistory = history.filter(
      alert => new Date(alert.triggeredAt) > cutoffTime
    );

    statistics.total = recentHistory.length;
    statistics.sent = recentHistory.filter(a => a.status === 'sent').length;
    statistics.failed = recentHistory.filter(a => a.status === 'failed').length;
    statistics.suppressed = recentHistory.filter(a => a.status === 'suppressed').length;
    statistics.recentAlerts = recentHistory.slice(0, 10);
  }

  return {
    statistics,
    isLoading: isLoadingHistory,
  };
}

// Hook for real-time alert notifications
export function useAlertNotifications(onAlert?: (alert: AlertHistory) => void) {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<AlertHistory[]>([]);

  // Poll for new alerts
  useQuery({
    queryKey: ['alertNotifications'],
    queryFn: async () => {
      const history = await monitoringApi.getAlertHistory(1); // Last hour
      const newAlerts = history.filter(alert => {
        const alertTime = new Date(alert.triggeredAt).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return alertTime > fiveMinutesAgo;
      });

      if (newAlerts.length > 0) {
        setNotifications(prev => [...newAlerts, ...prev].slice(0, 10));
        newAlerts.forEach(alert => onAlert?.(alert));
      }

      return newAlerts;
    },
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 20000,
  });

  const dismissNotification = (alertId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== alertId));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    dismissNotification,
    clearNotifications,
  };
}