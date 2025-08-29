'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap,
  Settings,
  BarChart3,
  Network,
  Shield
} from 'lucide-react';
import { SystemOverview } from '@/components/delegation/SystemOverview';
import { AgentManager } from '@/components/delegation/AgentManager';
import { TaskQueue } from '@/components/delegation/TaskQueue';
import { StatusTracker } from '@/components/delegation/StatusTracker';
import { ErrorMonitor } from '@/components/delegation/ErrorMonitor';
import { RoutingRules } from '@/components/delegation/RoutingRules';
import { useDelegation } from '@/hooks/useDelegation';

export default function DelegationDashboard() {
  const {
    systemHealth,
    agents,
    tasks,
    errors,
    stats,
    isLoading,
    error,
    refreshData
  } = useDelegation();

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Refresh data every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  if (isLoading && !systemHealth) {
    return (
      <div className=\"flex items-center justify-center min-h-screen\">
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto\"></div>
          <p className=\"mt-4 text-gray-600\">Loading delegation system...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className=\"container mx-auto px-4 py-8\">
        <Alert className=\"mb-6\">
          <AlertTriangle className=\"h-4 w-4\" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button 
              onClick={refreshData} 
              className=\"ml-4\"
              size=\"sm\"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getSystemStatusBadge = () => {
    if (!systemHealth) return <Badge variant=\"outline\">Unknown</Badge>;
    
    const { status } = systemHealth;
    
    switch (status) {
      case 'healthy':
        return <Badge className=\"bg-green-100 text-green-800\">Healthy</Badge>;
      case 'degraded':
        return <Badge className=\"bg-yellow-100 text-yellow-800\">Degraded</Badge>;
      case 'unhealthy':
        return <Badge className=\"bg-red-100 text-red-800\">Unhealthy</Badge>;
      default:
        return <Badge variant=\"outline\">{status}</Badge>;
    }
  };

  const getQuickStats = () => {
    if (!stats) return { agents: 0, tasks: 0, errors: 0, uptime: 0 };
    
    return {
      agents: stats.registry?.activeAgents || 0,
      tasks: stats.queue?.pending + stats.queue?.inProgress || 0,
      errors: stats.errors?.unresolvedErrors || 0,
      uptime: Math.floor(process.uptime?.() || 0)
    };
  };

  const quickStats = getQuickStats();

  return (
    <div className=\"container mx-auto px-4 py-8\">
      {/* Header */}
      <div className=\"flex justify-between items-center mb-8\">
        <div>
          <h1 className=\"text-3xl font-bold text-gray-900\">Task Delegation System</h1>
          <p className=\"text-gray-600 mt-2\">Monitor and manage distributed task processing</p>
        </div>
        <div className=\"flex items-center space-x-4\">
          {getSystemStatusBadge()}
          <Button onClick={refreshData} size=\"sm\" disabled={isLoading}>
            <Activity className=\"h-4 w-4 mr-2\" />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className=\"grid grid-cols-1 md:grid-cols-4 gap-6 mb-8\">
        <Card className=\"p-6\">
          <div className=\"flex items-center\">
            <div className=\"p-2 bg-blue-100 rounded-lg\">
              <Users className=\"h-6 w-6 text-blue-600\" />
            </div>
            <div className=\"ml-4\">
              <p className=\"text-sm font-medium text-gray-600\">Active Agents</p>
              <p className=\"text-2xl font-bold text-gray-900\">{quickStats.agents}</p>
            </div>
          </div>
        </Card>

        <Card className=\"p-6\">
          <div className=\"flex items-center\">
            <div className=\"p-2 bg-green-100 rounded-lg\">
              <Clock className=\"h-6 w-6 text-green-600\" />
            </div>
            <div className=\"ml-4\">
              <p className=\"text-sm font-medium text-gray-600\">Active Tasks</p>
              <p className=\"text-2xl font-bold text-gray-900\">{quickStats.tasks}</p>
            </div>
          </div>
        </Card>

        <Card className=\"p-6\">
          <div className=\"flex items-center\">
            <div className={`p-2 rounded-lg ${quickStats.errors > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <AlertTriangle className={`h-6 w-6 ${quickStats.errors > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div className=\"ml-4\">
              <p className=\"text-sm font-medium text-gray-600\">Unresolved Errors</p>
              <p className=\"text-2xl font-bold text-gray-900\">{quickStats.errors}</p>
            </div>
          </div>
        </Card>

        <Card className=\"p-6\">
          <div className=\"flex items-center\">
            <div className=\"p-2 bg-purple-100 rounded-lg\">
              <Zap className=\"h-6 w-6 text-purple-600\" />
            </div>
            <div className=\"ml-4\">
              <p className=\"text-sm font-medium text-gray-600\">Uptime</p>
              <p className=\"text-2xl font-bold text-gray-900\">
                {Math.floor(quickStats.uptime / 3600)}h {Math.floor((quickStats.uptime % 3600) / 60)}m
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* System Alerts */}
      {systemHealth?.issues && systemHealth.issues.length > 0 && (
        <Alert className=\"mb-6\">
          <AlertTriangle className=\"h-4 w-4\" />
          <AlertTitle>System Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className=\"list-disc list-inside mt-2\">
              {systemHealth.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className=\"space-y-6\">
        <TabsList className=\"grid w-full grid-cols-6\">
          <TabsTrigger value=\"overview\" className=\"flex items-center space-x-2\">
            <BarChart3 className=\"h-4 w-4\" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value=\"agents\" className=\"flex items-center space-x-2\">
            <Users className=\"h-4 w-4\" />
            <span>Agents</span>
          </TabsTrigger>
          <TabsTrigger value=\"tasks\" className=\"flex items-center space-x-2\">
            <Clock className=\"h-4 w-4\" />
            <span>Tasks</span>
          </TabsTrigger>
          <TabsTrigger value=\"status\" className=\"flex items-center space-x-2\">
            <Activity className=\"h-4 w-4\" />
            <span>Status</span>
          </TabsTrigger>
          <TabsTrigger value=\"errors\" className=\"flex items-center space-x-2\">
            <AlertTriangle className=\"h-4 w-4\" />
            <span>Errors</span>
          </TabsTrigger>
          <TabsTrigger value=\"routing\" className=\"flex items-center space-x-2\">
            <Network className=\"h-4 w-4\" />
            <span>Routing</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value=\"overview\" className=\"space-y-6\">
          <SystemOverview 
            systemHealth={systemHealth}
            stats={stats}
            agents={agents}
            tasks={tasks}
          />
        </TabsContent>

        <TabsContent value=\"agents\" className=\"space-y-6\">
          <AgentManager 
            agents={agents}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value=\"tasks\" className=\"space-y-6\">
          <TaskQueue 
            tasks={tasks}
            stats={stats?.queue}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value=\"status\" className=\"space-y-6\">
          <StatusTracker 
            systemHealth={systemHealth}
            stats={stats}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value=\"errors\" className=\"space-y-6\">
          <ErrorMonitor 
            errors={errors}
            stats={stats?.errors}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value=\"routing\" className=\"space-y-6\">
          <RoutingRules 
            stats={stats?.routing}
            onRefresh={refreshData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}