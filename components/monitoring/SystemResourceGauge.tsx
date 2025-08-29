'use client';

import React from 'react';
import { SystemGaugeProps } from '@/types/monitoring';
import { Card } from '@/components/ui/Card';
import { Cpu, HardDrive, Database } from 'lucide-react';

export function SystemResourceGauge({
  metrics,
  type,
  thresholds = { warning: 70, critical: 85 },
}: SystemGaugeProps) {
  if (!metrics) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500">Loading metrics...</p>
        </div>
      </Card>
    );
  }

  const getValue = () => {
    switch (type) {
      case 'cpu':
        return metrics.totalCPU;
      case 'memory':
        return metrics.memoryPercent;
      case 'disk':
        return metrics.diskPercent;
      default:
        return 0;
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'cpu':
        return 'CPU Usage';
      case 'memory':
        return 'Memory Usage';
      case 'disk':
        return 'Disk Usage';
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'cpu':
        return <Cpu className="w-5 h-5" />;
      case 'memory':
        return <HardDrive className="w-5 h-5" />;
      case 'disk':
        return <Database className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getDetails = () => {
    switch (type) {
      case 'cpu':
        return `${metrics.runningContainers} containers`;
      case 'memory':
        return `${metrics.usedMemoryMB.toFixed(0)} / ${metrics.totalMemoryMB.toFixed(0)} MB`;
      case 'disk':
        return `${metrics.diskUsageMB.toFixed(0)} MB used`;
      default:
        return '';
    }
  };

  const value = getValue();
  const percentage = Math.min(100, Math.max(0, value));
  
  const getColor = () => {
    if (percentage >= thresholds.critical) return '#ef4444'; // red
    if (percentage >= thresholds.warning) return '#f59e0b'; // yellow
    return '#10b981'; // green
  };

  const radius = 45;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = getColor();

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-gray-600">{getIcon()}</div>
          <h3 className="font-medium text-sm">{getLabel()}</h3>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="relative">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              stroke="#e5e7eb"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            
            {/* Progress circle */}
            <circle
              stroke={color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease' }}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeLinecap="round"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>
              {percentage.toFixed(0)}%
            </span>
            <span className="text-xs text-gray-500 text-center mt-0.5">
              {getDetails()}
            </span>
          </div>
        </div>
      </div>

      {/* Threshold indicators */}
      <div className="flex justify-between items-center mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-600">Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-600">&gt;{thresholds.warning}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-600">&gt;{thresholds.critical}%</span>
        </div>
      </div>
    </Card>
  );
}