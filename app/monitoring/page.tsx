'use client';

import React, { useState } from 'react';
import { useContainerHealth } from '@/hooks/useContainerHealth';
import { useSystemMetrics } from '@/hooks/useMetrics';
import { useAlerts, useAlertStatistics } from '@/hooks/useAlerts';
import { ContainerHealthCard } from '@/components/monitoring/ContainerHealthCard';
import { SystemResourceGauge } from '@/components/monitoring/SystemResourceGauge';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { AlertConfigPanel } from '@/components/monitoring/AlertConfigPanel';
import { AlertHistoryTable } from '@/components/monitoring/AlertHistoryTable';
import { AlertManagementPanel } from '@/components/monitoring/AlertManagementPanel';
import { RealTimeMonitoring } from '@/components/monitoring/RealTimeMonitoring';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Server, 
  Bell, 
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Alert, AlertMetricType, AlertPriority, ComparisonOperator } from '@/types/monitoring';

export default function MonitoringDashboard() {
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [mockAlerts] = useState<Alert[]>([
    {
      id: '1',
      name: 'High CPU Usage',
      metricType: AlertMetricType.CPU,
      thresholdValue: 80,
      comparisonOperator: ComparisonOperator.GREATER_THAN,
      priority: AlertPriority.HIGH,
      channels: [{ type: 'email', config: {}, enabled: true }],
      enabled: true,
      createdAt: new Date(),
    },
  ]);

  const {
    containers,
    summary,
    isLoading: isLoadingContainers,
    refetch: refetchContainers,
    restartContainer,
    stopContainer,
  } = useContainerHealth();

  const {
    metrics: systemMetrics,
    isLoading: isLoadingSystem,
    refetch: refetchSystem,
  } = useSystemMetrics();

  const {
    history,
    templates,
    isLoadingHistory,
    configureAlert,
    deleteAlert,
    testAlert,
  } = useAlerts();

  const { statistics } = useAlertStatistics(24);

  const handleViewLogs = (containerId: string) => {
    // Navigate to logs view
    window.location.href = `/monitoring/logs/${containerId}`;
  };

  const handleViewDetails = (containerId: string) => {
    // Navigate to metrics detail
    window.location.href = `/monitoring/metrics/${containerId}`;
  };

  const handleRefreshAll = () => {
    refetchContainers();
    refetchSystem();
  };

  // Mock metrics data for chart
  const mockChartData = {
    cpu: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      value: Math.random() * 100,
      label: `${Math.floor(Math.random() * 100)}%`,
    })),
    memory: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      value: Math.random() * 100,
      label: `${Math.floor(Math.random() * 1024)} MB`,
    })),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            System Monitoring
          </h1>
          <p className="text-gray-500 mt-1">Monitor your containers and system resources in real-time</p>
        </div>
        
        <Button onClick={handleRefreshAll} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Total Containers</p>
              <p className="text-2xl font-bold">{summary?.total || 0}</p>
            </div>
            <Server className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Running</p>
              <p className="text-2xl font-bold text-green-600">{summary?.running || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Stopped</p>
              <p className="text-2xl font-bold text-red-600">{summary?.stopped || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Alerts (24h)</p>
              <p className="text-2xl font-bold text-yellow-600">{statistics.total}</p>
            </div>
            <Bell className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* System Resources */}
      <div>
        <h2 className="text-lg font-semibold mb-3">System Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SystemResourceGauge 
            metrics={systemMetrics!} 
            type="cpu"
            thresholds={{ warning: 70, critical: 85 }}
          />
          <SystemResourceGauge 
            metrics={systemMetrics!} 
            type="memory"
            thresholds={{ warning: 75, critical: 90 }}
          />
          <SystemResourceGauge 
            metrics={systemMetrics!} 
            type="disk"
            thresholds={{ warning: 80, critical: 95 }}
          />
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="realtime" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="realtime">Real-Time</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="realtime" className="space-y-4">
          <RealTimeMonitoring />
        </TabsContent>
        
        <TabsContent value="containers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Container Health</h2>
            {isLoadingContainers && (
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {containers.map((container) => (
              <ContainerHealthCard
                key={container.id}
                container={container}
                onRestart={restartContainer}
                onStop={stopContainer}
                onViewLogs={handleViewLogs}
                onViewDetails={handleViewDetails}
              />
            ))}
            
            {containers.length === 0 && !isLoadingContainers && (
              <div className="col-span-full text-center py-12">
                <Server className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No containers found</p>
                <p className="text-sm text-gray-400 mt-1">Start some containers to see them here</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="metrics">
          <MetricsChart 
            data={mockChartData}
            timeRange={timeRange}
            onRangeChange={setTimeRange}
            height={400}
          />
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          <AlertManagementPanel 
            onAlertConfigured={configureAlert}
            onAlertDeleted={deleteAlert}
            onAlertTested={(alert) => {
              // Test the first channel as a simple implementation
              if (alert.channels && alert.channels.length > 0) {
                testAlert({ 
                  channel: alert.channels[0].type, 
                  config: alert.channels[0].config 
                });
              }
            }}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <AlertHistoryTable 
            history={history}
            loading={isLoadingHistory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}