'use client';

import React, { useState } from 'react';
import { ContainerCardProps } from '@/types/monitoring';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Play,
  Square,
  RotateCw,
  FileText,
  MoreVertical,
  Clock,
  Cpu,
  HardDrive,
  AlertCircle,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function ContainerHealthCard({
  container,
  metrics,
  onRestart,
  onStop,
  onViewLogs,
  onViewDetails,
}: ContainerCardProps) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const getStatusColor = () => {
    switch (container.status) {
      case 'running':
        return 'text-green-500 bg-green-500/10';
      case 'stopped':
        return 'text-red-500 bg-red-500/10';
      case 'paused':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'error':
        return 'text-red-600 bg-red-600/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getHealthIcon = () => {
    switch (container.health) {
      case 'healthy':
        return <Activity className="w-4 h-4 text-green-500" />;
      case 'unhealthy':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'starting':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleAction = (action: string) => {
    setIsActionsOpen(false);
    switch (action) {
      case 'restart':
        onRestart?.(container.id);
        break;
      case 'stop':
        onStop?.(container.id);
        break;
      case 'logs':
        onViewLogs?.(container.id);
        break;
      case 'details':
        onViewDetails?.(container.id);
        break;
    }
  };

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${getStatusColor()}`}>
            {container.status === 'running' ? (
              <Play className="w-5 h-5" />
            ) : container.status === 'stopped' ? (
              <Square className="w-5 h-5" />
            ) : (
              <Activity className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{container.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{container.image}</p>
          </div>
        </div>
        
        <Popover open={isActionsOpen} onOpenChange={setIsActionsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleAction('restart')}
              disabled={container.status !== 'running'}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleAction('stop')}
              disabled={container.status !== 'running'}
            >
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleAction('logs')}
            >
              <FileText className="mr-2 h-4 w-4" />
              View Logs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleAction('details')}
            >
              <Activity className="mr-2 h-4 w-4" />
              Details
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <Badge
          variant={container.status === 'running' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {container.status}
        </Badge>
        
        <div className="flex items-center gap-1">
          {getHealthIcon()}
          <span className="text-xs text-gray-600">{container.health}</span>
        </div>
        
        {container.uptime > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600">
              {formatUptime(container.uptime)}
            </span>
          </div>
        )}
      </div>

      {metrics && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-600">CPU</span>
            </div>
            <span className="text-xs font-medium">{metrics.cpuPercent.toFixed(1)}%</span>
          </div>
          <Progress value={metrics.cpuPercent} className="h-1.5" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-600">Memory</span>
            </div>
            <span className="text-xs font-medium">
              {metrics.memoryUsageMB.toFixed(0)} MB
            </span>
          </div>
          <Progress value={metrics.memoryPercent} className="h-1.5" />
        </div>
      )}

      {container.restartCount > 0 && (
        <div className="mt-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Restart Count</span>
            <Badge
              variant={container.restartCount > 5 ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {container.restartCount}
            </Badge>
          </div>
        </div>
      )}
    </Card>
  );
}