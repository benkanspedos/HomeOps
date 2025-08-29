'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FuturisticCard } from '@/components/futuristic/FuturisticCard';
import { StatusOrb } from '@/components/futuristic/StatusOrb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { 
  Server,
  Play,
  Square,
  RotateCw,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Cpu,
  MemoryStick,
  Network,
  Shield,
  Database,
  Globe,
  Zap
} from 'lucide-react';

interface ServiceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unhealthy';
  container: string;
  port: number;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Fetch services
  const fetchServices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/services`);
      if (!response.ok) throw new Error('Failed to fetch services');
      const data = await response.json();
      setServices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  // Service actions
  const handleServiceAction = async (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    setActionInProgress(`${serviceId}-${action}`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/services/${serviceId}/${action}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`Failed to ${action} service`);
      
      // Refresh services after action
      setTimeout(fetchServices, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} service`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'stopped':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      case 'unhealthy':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Docker Services
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage and monitor your Docker containers
          </p>
        </div>
        <Button 
          onClick={fetchServices}
          variant="outline"
          className="flex items-center"
        >
          <RotateCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {services.map((service) => (
          <Card key={service.id} className="p-6">
            {/* Service Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <Server className="h-6 w-6 text-gray-400 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.container}</p>
                </div>
              </div>
              {getStatusIcon(service.status)}
            </div>

            {/* Service Info */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium capitalize ${
                  service.status === 'running' ? 'text-green-600' :
                  service.status === 'stopped' ? 'text-gray-600' :
                  service.status === 'unhealthy' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {service.status}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Port:</span>
                <span className="font-medium">{service.port}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Priority:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(service.priority)}`}>
                  {service.priority}
                </span>
              </div>
            </div>

            {/* Resource Usage */}
            {service.stats && service.status === 'running' && (
              <div className="border-t pt-4 mb-4">
                <h4 className="text-sm font-medium mb-2">Resource Usage</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">CPU:</span>
                    <span className="font-medium">{service.stats.cpu.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Memory:</span>
                    <span className="font-medium">{service.stats.memory.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Network:</span>
                    <span className="font-medium text-xs">
                      ↓ {formatBytes(service.stats.network.rx)} / ↑ {formatBytes(service.stats.network.tx)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {service.status === 'stopped' ? (
                <Button
                  onClick={() => handleServiceAction(service.id, 'start')}
                  disabled={actionInProgress !== null}
                  size="sm"
                  className="flex-1"
                  variant="success"
                >
                  {actionInProgress === `${service.id}-start` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => handleServiceAction(service.id, 'stop')}
                  disabled={actionInProgress !== null || service.priority === 'critical'}
                  size="sm"
                  className="flex-1"
                  variant="danger"
                >
                  {actionInProgress === `${service.id}-stop` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-1" />
                      Stop
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={() => handleServiceAction(service.id, 'restart')}
                disabled={actionInProgress !== null || service.status === 'stopped'}
                size="sm"
                className="flex-1"
                variant="outline"
              >
                {actionInProgress === `${service.id}-restart` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RotateCw className="h-4 w-4 mr-1" />
                    Restart
                  </>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}