'use client';

import React, { useState } from 'react';
import { AlertPanelProps, AlertConfig, AlertMetricType, AlertPriority, ComparisonOperator } from '@/types/monitoring';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bell, Plus, Trash2, TestTube, Settings, Mail, MessageSquare, Webhook } from 'lucide-react';

export function AlertConfigPanel({
  alerts,
  onConfigureAlert,
  onDeleteAlert,
  onTestAlert,
  onToggleAlert,
}: AlertPanelProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'slack' | 'webhook'>('email');
  const [newAlert, setNewAlert] = useState<Partial<AlertConfig>>({
    name: '',
    metricType: AlertMetricType.CPU,
    thresholdValue: 80,
    comparisonOperator: ComparisonOperator.GREATER_THAN,
    priority: AlertPriority.MEDIUM,
    cooldownMinutes: 15,
    channels: [],
    enabled: true,
  });

  const handleAddChannel = () => {
    const channel = {
      type: selectedChannel as any,
      config: {},
      enabled: true,
    };
    
    setNewAlert(prev => ({
      ...prev,
      channels: [...(prev.channels || []), channel],
    }));
  };

  const handleSaveAlert = () => {
    if (newAlert.name && onConfigureAlert) {
      onConfigureAlert(newAlert as AlertConfig);
      setIsConfigOpen(false);
      setNewAlert({
        name: '',
        metricType: AlertMetricType.CPU,
        thresholdValue: 80,
        comparisonOperator: ComparisonOperator.GREATER_THAN,
        priority: AlertPriority.MEDIUM,
        cooldownMinutes: 15,
        channels: [],
        enabled: true,
      });
    }
  };

  const getPriorityColor = (priority: AlertPriority) => {
    switch (priority) {
      case AlertPriority.CRITICAL:
        return 'destructive';
      case AlertPriority.HIGH:
        return 'default';
      case AlertPriority.MEDIUM:
        return 'secondary';
      case AlertPriority.LOW:
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'slack':
        return <MessageSquare className="w-4 h-4" />;
      case 'webhook':
        return <Webhook className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Alert Configuration</h3>
        </div>
        
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure New Alert</DialogTitle>
              <DialogDescription>
                Set up threshold-based alerts for your containers
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="alert-name">Alert Name</Label>
                <Input
                  id="alert-name"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., High CPU Usage"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Metric Type</Label>
                  <Select
                    value={newAlert.metricType}
                    onValueChange={(value) => setNewAlert(prev => ({ ...prev, metricType: value as AlertMetricType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AlertMetricType.CPU}>CPU</SelectItem>
                      <SelectItem value={AlertMetricType.MEMORY}>Memory</SelectItem>
                      <SelectItem value={AlertMetricType.DISK}>Disk</SelectItem>
                      <SelectItem value={AlertMetricType.RESTART_COUNT}>Restarts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={newAlert.priority}
                    onValueChange={(value) => setNewAlert(prev => ({ ...prev, priority: value as AlertPriority }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AlertPriority.LOW}>Low</SelectItem>
                      <SelectItem value={AlertPriority.MEDIUM}>Medium</SelectItem>
                      <SelectItem value={AlertPriority.HIGH}>High</SelectItem>
                      <SelectItem value={AlertPriority.CRITICAL}>Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Operator</Label>
                  <Select
                    value={newAlert.comparisonOperator}
                    onValueChange={(value) => setNewAlert(prev => ({ ...prev, comparisonOperator: value as ComparisonOperator }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ComparisonOperator.GREATER_THAN}>&gt;</SelectItem>
                      <SelectItem value={ComparisonOperator.LESS_THAN}>&lt;</SelectItem>
                      <SelectItem value={ComparisonOperator.EQUAL}>=</SelectItem>
                      <SelectItem value={ComparisonOperator.NOT_EQUAL}>!=</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="threshold">Threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={newAlert.thresholdValue}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, thresholdValue: Number(e.target.value) }))}
                  />
                </div>
              </div>
              
              <div>
                <Label>Notification Channels</Label>
                <div className="flex gap-2 mt-2">
                  <Select value={selectedChannel} onValueChange={setSelectedChannel as any}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddChannel} variant="outline" size="sm">
                    Add
                  </Button>
                </div>
                
                <div className="mt-2 space-y-1">
                  {newAlert.channels?.map((channel, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {getChannelIcon(channel.type)}
                      <span>{channel.type}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAlert}>
                  Create Alert
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={alert.enabled}
                onCheckedChange={(checked) => onToggleAlert?.(alert.id, checked)}
              />
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{alert.name}</span>
                  <Badge variant={getPriorityColor(alert.priority)}>
                    {alert.priority}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {alert.metricType} {alert.comparisonOperator} {alert.thresholdValue}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {alert.channels.map((channel, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onTestAlert?.(channel.type)}
                >
                  {getChannelIcon(channel.type)}
                </Button>
              ))}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                onClick={() => onDeleteAlert?.(alert.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        
        {alerts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No alerts configured</p>
            <p className="text-sm mt-1">Create your first alert to get started</p>
          </div>
        )}
      </div>
    </Card>
  );
}