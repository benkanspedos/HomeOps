'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  TestTube, 
  Check, 
  X, 
  AlertTriangle,
  Settings,
  Mail,
  MessageSquare,
  Webhook,
  Zap,
  Clock,
  Filter,
  Search
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/Input';
import { AlertConfig, AlertChannel } from '@/types/monitoring';

type AlertChannelConfig = AlertChannel;

interface AlertManagementPanelProps {
  className?: string;
  onAlertConfigured?: (alert: AlertConfig) => void;
  onAlertDeleted?: (alertId: string) => void;
  onAlertTested?: (alert: AlertConfig) => void;
}

const METRIC_OPTIONS = [
  { value: 'cpu', label: 'CPU Usage (%)', icon: '🖥️' },
  { value: 'memory', label: 'Memory Usage (%)', icon: '💾' },
  { value: 'disk', label: 'Disk Usage (%)', icon: '💿' },
  { value: 'network', label: 'Network Traffic (MB)', icon: '🌐' },
  { value: 'restart_count', label: 'Restart Count', icon: '🔄' },
  { value: 'container_status', label: 'Container Status', icon: '📦' },
  { value: 'health_check', label: 'Health Check', icon: '❤️' },
];

const COMPARISON_OPERATORS = [
  { value: '>', label: 'Greater than' },
  { value: '>=', label: 'Greater than or equal' },
  { value: '<', label: 'Less than' },
  { value: '<=', label: 'Less than or equal' },
  { value: '=', label: 'Equal to' },
  { value: '!=', label: 'Not equal to' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

const CHANNEL_TYPES = [
  { type: 'email', label: 'Email', icon: Mail, color: 'text-blue-500' },
  { type: 'slack', label: 'Slack', icon: MessageSquare, color: 'text-green-500' },
  { type: 'webhook', label: 'Webhook', icon: Webhook, color: 'text-purple-500' },
  { type: 'discord', label: 'Discord', icon: Zap, color: 'text-indigo-500' },
];

export function AlertManagementPanel({ 
  className, 
  onAlertConfigured, 
  onAlertDeleted, 
  onAlertTested 
}: AlertManagementPanelProps) {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');

  // Form state for creating/editing alerts
  const [formData, setFormData] = useState<Partial<AlertConfig>>({
    name: '',
    enabled: true,
    metricType: 'cpu',
    thresholdValue: 80,
    comparisonOperator: '>',
    priority: 'medium',
    cooldownMinutes: 15,
    channels: [],
    description: ''
  });

  // Load existing alerts
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockAlerts: AlertConfig[] = [
        {
          id: '1',
          name: 'High CPU Usage',
          enabled: true,
          metricType: 'cpu',
          thresholdValue: 80,
          comparisonOperator: '>',
          priority: 'high',
          cooldownMinutes: 15,
          channels: [
            { type: 'email', enabled: true, config: { to: 'admin@homeops.com' } }
          ],
          description: 'Alert when CPU usage exceeds 80%'
        },
        {
          id: '2',
          name: 'Memory Critical',
          enabled: true,
          metricType: 'memory',
          thresholdValue: 90,
          comparisonOperator: '>',
          priority: 'critical',
          cooldownMinutes: 10,
          channels: [
            { type: 'slack', enabled: true, config: { webhookUrl: 'https://hooks.slack.com/...' } },
            { type: 'email', enabled: true, config: { to: 'admin@homeops.com' } }
          ],
          description: 'Critical alert for memory usage above 90%'
        },
        {
          id: '3',
          name: 'Container Restart Loop',
          enabled: false,
          metricType: 'restart_count',
          thresholdValue: 5,
          comparisonOperator: '>',
          priority: 'high',
          cooldownMinutes: 30,
          channels: [
            { type: 'webhook', enabled: true, config: { url: 'https://api.homeops.com/alerts' } }
          ],
          description: 'Alert when container restarts more than 5 times'
        }
      ];
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const handleCreateAlert = () => {
    setIsCreating(true);
    setEditingAlert(null);
    setFormData({
      name: '',
      enabled: true,
      metricType: 'cpu',
      thresholdValue: 80,
      comparisonOperator: '>',
      priority: 'medium',
      cooldownMinutes: 15,
      channels: [],
      description: ''
    });
  };

  const handleEditAlert = (alert: AlertConfig) => {
    setEditingAlert(alert);
    setIsCreating(false);
    setFormData(alert);
  };

  const handleSaveAlert = async () => {
    try {
      const alertData = formData as AlertConfig;
      
      if (editingAlert) {
        // Update existing alert
        const updatedAlerts = alerts.map(a => 
          a.id === editingAlert.id ? { ...alertData, id: editingAlert.id } : a
        );
        setAlerts(updatedAlerts);
      } else {
        // Create new alert
        const newAlert = {
          ...alertData,
          id: `alert-${Date.now()}`
        };
        setAlerts([...alerts, newAlert]);
      }

      // Notify parent component
      if (onAlertConfigured) {
        onAlertConfigured(alertData);
      }

      // Reset form
      setIsCreating(false);
      setEditingAlert(null);
    } catch (error) {
      console.error('Failed to save alert:', error);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      setAlerts(alerts.filter(a => a.id !== alertId));
      if (onAlertDeleted) {
        onAlertDeleted(alertId);
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const handleTestAlert = async (alert: AlertConfig) => {
    try {
      if (onAlertTested) {
        onAlertTested(alert);
      }
      // Show success message
      alert('Test alert sent successfully!');
    } catch (error) {
      console.error('Failed to test alert:', error);
      alert('Failed to send test alert');
    }
  };

  const handleToggleAlert = async (alertId: string) => {
    const updatedAlerts = alerts.map(a => 
      a.id === alertId ? { ...a, enabled: !a.enabled } : a
    );
    setAlerts(updatedAlerts);
  };

  const addChannel = (type: AlertChannelConfig['type']) => {
    const newChannel: AlertChannelConfig = {
      type,
      enabled: true,
      config: {}
    };
    
    setFormData({
      ...formData,
      channels: [...(formData.channels || []), newChannel]
    });
  };

  const removeChannel = (index: number) => {
    const updatedChannels = formData.channels?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, channels: updatedChannels });
  };

  const updateChannel = (index: number, updates: Partial<AlertChannelConfig>) => {
    const updatedChannels = formData.channels?.map((channel, i) => 
      i === index ? { ...channel, ...updates } : channel
    ) || [];
    setFormData({ ...formData, channels: updatedChannels });
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (searchTerm && !alert.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterPriority !== 'all' && alert.priority !== filterPriority) {
      return false;
    }
    if (filterEnabled !== 'all') {
      const isEnabled = filterEnabled === 'enabled';
      if (alert.enabled !== isEnabled) {
        return false;
      }
    }
    return true;
  });

  const getPriorityColor = (priority: string) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority)?.color || 'bg-gray-100 text-gray-800';
  };

  const getChannelIcon = (type: string) => {
    const channelType = CHANNEL_TYPES.find(c => c.type === type);
    return channelType ? channelType.icon : Bell;
  };

  const getChannelColor = (type: string) => {
    return CHANNEL_TYPES.find(c => c.type === type)?.color || 'text-gray-500';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Bell size={24} />
            <span>Alert Management</span>
          </h2>
          <p className="text-gray-600 mt-1">Configure alerts for system monitoring</p>
        </div>
        
        <Button
          onClick={handleCreateAlert}
          className="flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>Create Alert</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search size={16} className="text-gray-400" />
            <Input
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Priorities</option>
              {PRIORITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-500">
            {filteredAlerts.length} of {alerts.length} alerts
          </div>
        </div>
      </Card>

      {/* Alert List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className={`w-3 h-3 rounded-full mt-2 ${alert.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{alert.name}</h3>
                    {alert.description && (
                      <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge className={getPriorityColor(alert.priority)}>
                    {alert.priority}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Metric:</span>
                  <span className="font-medium">
                    {METRIC_OPTIONS.find(m => m.value === alert.metricType)?.label || alert.metricType}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Threshold:</span>
                  <span className="font-medium">
                    {alert.comparisonOperator} {alert.thresholdValue}
                    {alert.metricType.includes('percent') || alert.metricType === 'cpu' || alert.metricType === 'memory' || alert.metricType === 'disk' ? '%' : ''}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Cooldown:</span>
                  <span className="font-medium flex items-center space-x-1">
                    <Clock size={12} />
                    <span>{alert.cooldownMinutes || 15} min</span>
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Channels:</span>
                  <div className="flex items-center space-x-2">
                    {alert.channels.map((channel, index) => {
                      const Icon = getChannelIcon(channel.type);
                      return (
                        <div
                          key={index}
                          className={`p-1 rounded ${channel.enabled ? getChannelColor(channel.type) : 'text-gray-300'}`}
                          title={channel.type}
                        >
                          <Icon size={16} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <Button
                  onClick={() => handleToggleAlert(alert.id!)}
                  variant={alert.enabled ? "outline" : "default"}
                  size="sm"
                >
                  {alert.enabled ? 'Disable' : 'Enable'}
                </Button>
                
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleTestAlert(alert)}
                    variant="ghost"
                    size="sm"
                  >
                    <TestTube size={16} />
                  </Button>
                  
                  <Button
                    onClick={() => handleEditAlert(alert)}
                    variant="ghost"
                    size="sm"
                  >
                    <Edit size={16} />
                  </Button>
                  
                  <Button
                    onClick={() => handleDeleteAlert(alert.id!)}
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Create/Edit Alert Modal */}
      <AnimatePresence>
        {(isCreating || editingAlert) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">
                  {editingAlert ? 'Edit Alert' : 'Create New Alert'}
                </h3>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alert Name *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter alert name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {PRIORITY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Metric Configuration */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Metric Type *
                    </label>
                    <select
                      value={formData.metricType}
                      onChange={(e) => setFormData({ ...formData, metricType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {METRIC_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Condition
                    </label>
                    <select
                      value={formData.comparisonOperator}
                      onChange={(e) => setFormData({ ...formData, comparisonOperator: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {COMPARISON_OPERATORS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Threshold Value *
                    </label>
                    <Input
                      type="number"
                      value={formData.thresholdValue}
                      onChange={(e) => setFormData({ ...formData, thresholdValue: Number(e.target.value) })}
                      placeholder="Enter threshold"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description for this alert"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                {/* Channels */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Notification Channels
                    </label>
                    <div className="flex space-x-2">
                      {CHANNEL_TYPES.map(channel => (
                        <Button
                          key={channel.type}
                          onClick={() => addChannel(channel.type as any)}
                          variant="ghost"
                          size="sm"
                          className={channel.color}
                        >
                          <channel.icon size={16} />
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.channels?.map((channel, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md">
                        <div className={`p-2 rounded ${getChannelColor(channel.type)}`}>
                          {React.createElement(getChannelIcon(channel.type), { size: 16 })}
                        </div>
                        
                        <div className="flex-1">
                          <div className="font-medium text-sm capitalize">{channel.type}</div>
                          {/* Channel-specific configuration would go here */}
                          <div className="text-xs text-gray-500">
                            {channel.type === 'email' && 'Email notifications'}
                            {channel.type === 'slack' && 'Slack webhook'}
                            {channel.type === 'webhook' && 'HTTP webhook'}
                            {channel.type === 'discord' && 'Discord webhook'}
                          </div>
                        </div>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={channel.enabled}
                            onChange={(e) => updateChannel(index, { enabled: e.target.checked })}
                            className="mr-2"
                          />
                          <span className="text-sm">Enabled</span>
                        </label>
                        
                        <Button
                          onClick={() => removeChannel(index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ))}
                    
                    {(!formData.channels || formData.channels.length === 0) && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No notification channels configured. Click the icons above to add channels.
                      </div>
                    )}
                  </div>
                </div>

                {/* Cooldown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cooldown Period (minutes)
                  </label>
                  <Input
                    type="number"
                    value={formData.cooldownMinutes}
                    onChange={(e) => setFormData({ ...formData, cooldownMinutes: Number(e.target.value) })}
                    placeholder="15"
                    min="1"
                    max="1440"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum time between alert notifications for the same condition
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                <Button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingAlert(null);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                
                <Button
                  onClick={handleSaveAlert}
                  disabled={!formData.name || !formData.thresholdValue}
                >
                  <Check size={16} className="mr-2" />
                  {editingAlert ? 'Update Alert' : 'Create Alert'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}