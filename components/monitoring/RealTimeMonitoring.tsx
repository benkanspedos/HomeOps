'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMonitoringWebSocket } from '@/hooks/useWebSocket';
import { 
  Activity, 
  Server, 
  Cpu, 
  HardDrive, 
  Database, 
  Bell, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  Pause,
  Play,
  Eye,
  Settings
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';

interface RealTimeMonitoringProps {
  className?: string;
}

export function RealTimeMonitoring({ className }: RealTimeMonitoringProps) {
  const {
    isConnected,
    realTimeData,
    lastUpdate,
    subscribeToRealTime,
    unsubscribeFromRealTime,
    requestMetrics,
    requestContainerLogs,
  } = useMonitoringWebSocket();

  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [updateInterval, setUpdateInterval] = useState(5000);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [containerLogs, setContainerLogs] = useState<{ [key: string]: string[] }>({});

  // Subscribe to real-time updates when component mounts or settings change
  useEffect(() => {
    if (isConnected && isRealTimeEnabled) {
      subscribeToRealTime(updateInterval);
    } else if (isConnected && !isRealTimeEnabled) {
      unsubscribeFromRealTime();
    }

    return () => {
      if (isConnected) {
        unsubscribeFromRealTime();
      }
    };
  }, [isConnected, isRealTimeEnabled, updateInterval, subscribeToRealTime, unsubscribeFromRealTime]);

  const toggleRealTime = () => {
    setIsRealTimeEnabled(!isRealTimeEnabled);
  };

  const handleManualRefresh = () => {
    requestMetrics();
  };

  const handleViewLogs = (containerId: string) => {
    requestContainerLogs(containerId, 50);
    setSelectedContainer(containerId);
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'exited':
      case 'stopped':
        return <XCircle className="text-red-500" size={20} />;
      case 'restarting':
        return <RefreshCw className="text-yellow-500 animate-spin" size={20} />;
      default:
        return <AlertTriangle className="text-gray-500" size={20} />;
    }
  };

  const getHealthStatusColor = (healthStatus?: string) => {
    switch (healthStatus?.toLowerCase()) {
      case 'healthy':
        return 'text-green-500 bg-green-500/10';
      case 'unhealthy':
        return 'text-red-500 bg-red-500/10';
      case 'starting':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!realTimeData) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-500" size={40} />
          <p className="text-gray-600">Loading real-time monitoring data...</p>
          <div className="flex items-center justify-center mt-2 space-x-2 text-sm">
            {isConnected ? (
              <>
                <Wifi size={16} className="text-green-500" />
                <span className="text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-500" />
                <span className="text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Activity size={24} />
            <span>Real-Time Monitoring</span>
          </h2>
          
          <div className="flex items-center space-x-2 text-sm">
            {isConnected ? (
              <>
                <Wifi size={16} className="text-green-500" />
                <span className="text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-500" />
                <span className="text-red-600">Disconnected</span>
              </>
            )}
            
            {lastUpdate && (
              <>
                <span className="text-gray-400">•</span>
                <Clock size={14} className="text-gray-400" />
                <span className="text-gray-600">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={updateInterval}
            onChange={(e) => setUpdateInterval(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white"
            disabled={!isRealTimeEnabled}
          >
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>

          <Button
            onClick={toggleRealTime}
            variant={isRealTimeEnabled ? "default" : "outline"}
            size="sm"
            className="flex items-center space-x-2"
          >
            {isRealTimeEnabled ? <Pause size={16} /> : <Play size={16} />}
            <span>{isRealTimeEnabled ? 'Pause' : 'Resume'}</span>
          </Button>

          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            disabled={!isConnected}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Server className="text-blue-500" size={24} />
                <h3 className="text-lg font-medium">Containers</h3>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {realTimeData.system?.runningContainers || 0}/{realTimeData.system?.containerCount || 0}
              </div>
              <div className="text-sm text-gray-500">Running / Total</div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Cpu className="text-green-500" size={24} />
                <h3 className="text-lg font-medium">CPU</h3>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {realTimeData.system?.totalCPU?.toFixed(1) || '0.0'}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(realTimeData.system?.totalCPU || 0, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <HardDrive className="text-yellow-500" size={24} />
                <h3 className="text-lg font-medium">Memory</h3>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {realTimeData.system?.memoryPercent?.toFixed(1) || '0.0'}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(realTimeData.system?.memoryPercent || 0, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {formatBytes((realTimeData.system?.usedMemoryMB || 0) * 1024 * 1024)} / 
                {formatBytes((realTimeData.system?.totalMemoryMB || 0) * 1024 * 1024)}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Database className="text-purple-500" size={24} />
                <h3 className="text-lg font-medium">Disk</h3>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {realTimeData.system?.diskPercent?.toFixed(1) || '0.0'}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(realTimeData.system?.diskPercent || 0, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {formatBytes((realTimeData.system?.diskUsageMB || 0) * 1024 * 1024)} used
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Container Health Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium flex items-center space-x-2">
            <Server size={20} />
            <span>Container Health Status</span>
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Container</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Image</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Health</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Uptime</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Restarts</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">CPU</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Memory</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <AnimatePresence>
                {realTimeData.containers?.map((container: any) => {
                  const metrics = realTimeData.containerMetrics?.find((m: any) => m.containerId === container.containerId);
                  return (
                    <motion.tr
                      key={container.containerId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        {getStatusIcon(container.state)}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{container.containerName}</div>
                          <div className="text-sm text-gray-500 font-mono">
                            {container.containerId?.substring(0, 12)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{container.image}</td>
                      <td className="px-6 py-4">
                        <Badge className={getHealthStatusColor(container.healthStatus)}>
                          {container.healthStatus || 'none'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatUptime(container.uptime)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${container.restartCount > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                          {container.restartCount || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {metrics ? `${metrics.cpuPercent?.toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {metrics ? (
                          <div>
                            <div>{metrics.memoryPercent?.toFixed(1)}%</div>
                            <div className="text-xs text-gray-500">
                              {formatBytes((metrics.memoryUsageMB || 0) * 1024 * 1024)}
                            </div>
                          </div>
                        ) : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          onClick={() => handleViewLogs(container.containerId)}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye size={16} />
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Container Logs Modal */}
      <AnimatePresence>
        {selectedContainer && containerLogs[selectedContainer] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedContainer(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Container Logs: {selectedContainer.substring(0, 12)}
                </h3>
                <Button
                  onClick={() => setSelectedContainer(null)}
                  variant="ghost"
                  size="sm"
                >
                  ✕
                </Button>
              </div>
              
              <div className="p-4 bg-gray-900 text-green-400 font-mono text-sm overflow-y-auto max-h-96">
                {containerLogs[selectedContainer].map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap break-words mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}