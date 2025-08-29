'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/hooks/useAlerts';
import { useContainerHealth } from '@/hooks/useContainerHealth';
import { AlertConfigPanel } from '@/components/monitoring/AlertConfigPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
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
  Bell,
  Settings,
  Plus,
  Save,
  TestTube,
  Mail,
  MessageSquare,
  Webhook,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  AlertConfig,
  AlertMetricType,
  AlertPriority,
  ComparisonOperator,
  AlertTemplate,
} from '@/types/monitoring';

export default function AlertConfigurationPage() {
  const router = useRouter();
  const { containers } = useContainerHealth();
  const {
    templates,
    configureAlert,
    testAlert,
    testResult,
    isConfiguring,
    isTesting,
  } = useAlerts();

  const [selectedTemplate, setSelectedTemplate] = useState<AlertTemplate | null>(null);
  const [emailConfig, setEmailConfig] = useState({
    to: '',
    from: '',
    subject: 'HomeOps Alert',
  });
  const [slackConfig, setSlackConfig] = useState({
    webhookUrl: '',
    channel: '#alerts',
  });
  const [webhookConfig, setWebhookConfig] = useState({
    url: '',
    headers: '{}',
  });
  
  // Mock existing alerts for display
  const [existingAlerts] = useState<AlertConfig[]>([
    {
      name: 'High CPU Usage',
      enabled: true,
      metricType: AlertMetricType.CPU,
      thresholdValue: 80,
      comparisonOperator: ComparisonOperator.GREATER_THAN,
      priority: AlertPriority.HIGH,
      channels: [
        { type: 'email', config: { to: 'admin@homeops.local' }, enabled: true }
      ],
    },
    {
      name: 'Container Down',
      enabled: true,
      metricType: AlertMetricType.CONTAINER_STATUS,
      thresholdValue: 0,
      comparisonOperator: ComparisonOperator.EQUAL,
      priority: AlertPriority.CRITICAL,
      channels: [
        { type: 'slack', config: {}, enabled: true }
      ],
    },
  ]);

  const handleTemplateSelect = (template: AlertTemplate) => {
    setSelectedTemplate(template);
  };

  const handleTestChannel = async (channel: string) => {
    let config = {};
    
    switch (channel) {
      case 'email':
        config = emailConfig;
        break;
      case 'slack':
        config = slackConfig;
        break;
      case 'webhook':
        config = webhookConfig;
        break;
    }
    
    await testAlert({ channel, config });
  };

  const handleSaveChannelConfig = () => {
    // Save channel configuration
    console.log('Saving channel configs:', { emailConfig, slackConfig, webhookConfig });
  };

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
            <Bell className="w-6 h-6" />
            Alert Configuration
          </h1>
          <p className="text-gray-500 mt-1">Configure alerts and notification channels for your monitoring system</p>
        </div>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
          <TabsTrigger value="channels">Notification Channels</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        
        {/* Alert Rules Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <AlertConfigPanel
            alerts={existingAlerts as any}
            onConfigureAlert={configureAlert}
            onTestAlert={(channel) => handleTestChannel(channel)}
          />
          
          {/* Global Thresholds */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Global Thresholds
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>CPU Warning Threshold (%)</Label>
                <Input type="number" defaultValue={70} min={0} max={100} />
              </div>
              <div>
                <Label>CPU Critical Threshold (%)</Label>
                <Input type="number" defaultValue={85} min={0} max={100} />
              </div>
              <div>
                <Label>Memory Warning Threshold (%)</Label>
                <Input type="number" defaultValue={75} min={0} max={100} />
              </div>
              <div>
                <Label>Memory Critical Threshold (%)</Label>
                <Input type="number" defaultValue={90} min={0} max={100} />
              </div>
              <div>
                <Label>Disk Warning Threshold (%)</Label>
                <Input type="number" defaultValue={80} min={0} max={100} />
              </div>
              <div>
                <Label>Disk Critical Threshold (%)</Label>
                <Input type="number" defaultValue={95} min={0} max={100} />
              </div>
            </div>
            
            <Button className="mt-4">
              <Save className="w-4 h-4 mr-2" />
              Save Thresholds
            </Button>
          </Card>
        </TabsContent>
        
        {/* Notification Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          {/* Email Configuration */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Configuration
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestChannel('email')}
                disabled={isTesting}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Test
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email-to">To Address</Label>
                <Input
                  id="email-to"
                  type="email"
                  value={emailConfig.to}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="admin@homeops.local"
                />
              </div>
              <div>
                <Label htmlFor="email-from">From Address</Label>
                <Input
                  id="email-from"
                  type="email"
                  value={emailConfig.from}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, from: e.target.value }))}
                  placeholder="alerts@homeops.local"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="email-subject">Subject Template</Label>
                <Input
                  id="email-subject"
                  value={emailConfig.subject}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="[HomeOps Alert] {alert_name}"
                />
              </div>
            </div>
          </Card>
          
          {/* Slack Configuration */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Slack Configuration
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestChannel('slack')}
                disabled={isTesting}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Test
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="slack-webhook">Webhook URL</Label>
                <Input
                  id="slack-webhook"
                  type="url"
                  value={slackConfig.webhookUrl}
                  onChange={(e) => setSlackConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
                />
              </div>
              <div>
                <Label htmlFor="slack-channel">Default Channel</Label>
                <Input
                  id="slack-channel"
                  value={slackConfig.channel}
                  onChange={(e) => setSlackConfig(prev => ({ ...prev, channel: e.target.value }))}
                  placeholder="#alerts"
                />
              </div>
            </div>
          </Card>
          
          {/* Webhook Configuration */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Webhook Configuration
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestChannel('webhook')}
                disabled={isTesting}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Test
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={webhookConfig.url}
                  onChange={(e) => setWebhookConfig(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://your-webhook-endpoint.com/alerts"
                />
              </div>
              <div>
                <Label htmlFor="webhook-headers">Headers (JSON)</Label>
                <Input
                  id="webhook-headers"
                  value={webhookConfig.headers}
                  onChange={(e) => setWebhookConfig(prev => ({ ...prev, headers: e.target.value }))}
                  placeholder='{"Authorization": "Bearer token"}'
                />
              </div>
            </div>
          </Card>
          
          {/* Test Results */}
          {testResult && (
            <Card className="p-4">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-600">Test successful!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-600">Test failed: {testResult.error}</span>
                  </>
                )}
              </div>
            </Card>
          )}
          
          <div className="flex justify-end">
            <Button onClick={handleSaveChannelConfig}>
              <Save className="w-4 h-4 mr-2" />
              Save Channel Configuration
            </Button>
          </div>
        </TabsContent>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Alert Templates</h3>
            <p className="text-sm text-gray-500 mb-4">
              Quick-start templates for common monitoring scenarios
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedTemplate?.name === template.name ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{template.name}</h4>
                    <Badge variant={
                      template.priority === AlertPriority.CRITICAL ? 'destructive' :
                      template.priority === AlertPriority.HIGH ? 'default' :
                      'secondary'
                    }>
                      {template.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{template.metricType}</span>
                    <span>{template.comparisonOperator}</span>
                    <span>{template.thresholdValue}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedTemplate && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Selected Template: {selectedTemplate.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Click "Create Alert from Template" to configure this alert
                    </p>
                  </div>
                  <Button onClick={() => {
                    const newAlert: AlertConfig = {
                      name: selectedTemplate.name,
                      metricType: selectedTemplate.metricType,
                      thresholdValue: selectedTemplate.thresholdValue,
                      comparisonOperator: selectedTemplate.comparisonOperator,
                      priority: selectedTemplate.priority,
                      channels: [],
                      enabled: true,
                    };
                    configureAlert(newAlert);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Alert from Template
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}