'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMetrics } from '@/hooks/useMetrics';
import { useContainer, useContainerLogs } from '@/hooks/useContainerHealth';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Clock,
  TrendingUp,
  TrendingDown,
  Terminal,
  Download,
  RefreshCw,
} from 'lucide-react';

export default function ContainerMetricsPage() {
  const params = useParams();
  const router = useRouter();
  const containerId = params?.containerId as string;
  
  const [timeRange, setTimeRange] = useState(24);
  const [logLines, setLogLines] = useState(100);
  
  const { container, isLoading: isLoadingContainer } = useContainer(containerId);
  const { logs, refetch: refetchLogs } = useContainerLogs(containerId, logLines);
  
  const {
    currentMetrics,
    chartData,
    statistics,
    timeRange: currentTimeRange,
    setTimeRange: updateTimeRange,
    isLoadingContainer: isLoadingMetrics,
    refetchContainer: refetchMetrics,
  } = useMetrics({ containerId, hours: timeRange });

  const handleTimeRangeChange = (value: string) => {
    const hours = parseInt(value);
    setTimeRange(hours);
    updateTimeRange(hours);
  };

  const handleExportLogs = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerId}-logs-${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoadingContainer || !container) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 animate-pulse text-gray-400" />
          <p className="text-gray-500">Loading container metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/monitoring')}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            {container.name}
          </h1>
          <p className="text-gray-500 mt-1">{container.image}</p>
          
          <div className="flex items-center gap-3 mt-3">
            <Badge
              variant={container.status === 'running' ? 'default' : 'secondary'}
            >
              {container.status}
            </Badge>
            <Badge
              variant={container.health === 'healthy' ? 'default' : 'destructive'}
            >
              {container.health}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              Uptime: {Math.floor(container.uptime / 3600)}h {Math.floor((container.uptime % 3600) / 60)}m
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange.toString()} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last Hour</SelectItem>
              <SelectItem value="6">Last 6 Hours</SelectItem>
              <SelectItem value="24">Last 24 Hours</SelectItem>
              <SelectItem value="168">Last 7 Days</SelectItem>
              <SelectItem value="720">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={refetchMetrics} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Metrics */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">CPU Usage</p>
                <p className="text-2xl font-bold">{currentMetrics.cpuPercent.toFixed(1)}%</p>
                {statistics?.cpu && (
                  <p className="text-xs text-gray-400 mt-1">
                    Avg: {statistics.cpu.average.toFixed(1)}%
                  </p>
                )}
              </div>
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Memory Usage</p>
                <p className="text-2xl font-bold">{currentMetrics.memoryUsageMB.toFixed(0)} MB</p>
                {statistics?.memory && (
                  <p className="text-xs text-gray-400 mt-1">
                    {currentMetrics.memoryPercent.toFixed(1)}% used
                  </p>
                )}
              </div>
              <HardDrive className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Network I/O</p>
                <p className="text-2xl font-bold">
                  {((currentMetrics.networkRxBytes + currentMetrics.networkTxBytes) / 1024 / 1024).toFixed(1)} MB
                </p>
                <p className="text-xs text-gray-400 mt-1">Total traffic</p>
              </div>
              <Network className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Restart Count</p>
                <p className="text-2xl font-bold">{container.restartCount}</p>
                <p className="text-xs text-gray-400 mt-1">Total restarts</p>
              </div>
              <RefreshCw className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Statistics Summary */}
      {statistics && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">CPU Range</p>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-500" />
                <span className="text-sm">{statistics.cpu.min.toFixed(1)}%</span>
                <span className="text-gray-400">-</span>
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="text-sm">{statistics.cpu.max.toFixed(1)}%</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Memory Range</p>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-500" />
                <span className="text-sm">{statistics.memory.min.toFixed(1)}%</span>
                <span className="text-gray-400">-</span>
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="text-sm">{statistics.memory.max.toFixed(1)}%</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Avg CPU</p>
              <p className="text-lg font-semibold">{statistics.cpu.average.toFixed(1)}%</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Avg Memory</p>
              <p className="text-lg font-semibold">{statistics.memory.average.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs for Charts and Logs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="metrics">Metrics History</TabsTrigger>
          <TabsTrigger value="logs">Container Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="metrics">
          <MetricsChart
            data={chartData}
            timeRange={`${timeRange}h`}
            height={400}
            showLegend={true}
          />
        </TabsContent>
        
        <TabsContent value="logs" className="space-y-4">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold">Container Logs</h3>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={logLines.toString()} onValueChange={(v) => setLogLines(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">Last 50</SelectItem>
                    <SelectItem value="100">Last 100</SelectItem>
                    <SelectItem value="200">Last 200</SelectItem>
                    <SelectItem value="500">Last 500</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetchLogs}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLogs}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre">
                {logs.length > 0 ? logs.join('\n') : 'No logs available'}
              </pre>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}