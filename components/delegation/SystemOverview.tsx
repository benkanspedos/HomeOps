'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, Clock, Zap, Users, AlertTriangle } from 'lucide-react';

interface SystemOverviewProps {
  systemHealth: any;
  stats: any;
  agents: any[];
  tasks: any[];
}

export function SystemOverview({ systemHealth, stats, agents, tasks }: SystemOverviewProps) {
  // Mock data for charts - in real implementation, this would come from props
  const performanceData = [
    { time: '00:00', throughput: 45, errorRate: 2.1, responseTime: 120 },
    { time: '04:00', throughput: 52, errorRate: 1.8, responseTime: 115 },
    { time: '08:00', throughput: 78, errorRate: 3.2, responseTime: 145 },
    { time: '12:00', throughput: 95, errorRate: 2.5, responseTime: 125 },
    { time: '16:00', throughput: 87, errorRate: 1.9, responseTime: 110 },
    { time: '20:00', throughput: 65, errorRate: 2.8, responseTime: 135 },
  ];

  const taskStatusData = [
    { name: 'Completed', value: stats?.queue?.completed || 0, color: '#10B981' },
    { name: 'In Progress', value: stats?.queue?.inProgress || 0, color: '#3B82F6' },
    { name: 'Pending', value: stats?.queue?.pending || 0, color: '#F59E0B' },
    { name: 'Failed', value: stats?.queue?.failed || 0, color: '#EF4444' },
  ];

  const agentLoadData = agents?.slice(0, 8).map(agent => ({
    name: agent.name?.slice(0, 10) || agent.id.slice(0, 8),
    load: (agent.currentTasks / agent.maxConcurrentTasks) * 100,
    tasks: agent.currentTasks,
    maxTasks: agent.maxConcurrentTasks,
  })) || [];

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className=\"space-y-6\">
      {/* System Health Summary */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-gray-900\">System Health</h2>
          <Badge 
            className={
              systemHealth?.status === 'healthy' ? 'bg-green-100 text-green-800' :
              systemHealth?.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }
          >
            {systemHealth?.status || 'Unknown'}
          </Badge>
        </div>
        
        <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
          <div className=\"text-center\">
            <div className=\"text-2xl font-bold text-gray-900\">
              {stats?.registry?.totalAgents || 0}
            </div>
            <div className=\"text-sm text-gray-600\">Total Agents</div>
            <div className=\"text-xs text-green-600 mt-1\">
              {stats?.registry?.activeAgents || 0} active
            </div>
          </div>
          
          <div className=\"text-center\">
            <div className=\"text-2xl font-bold text-gray-900\">
              {systemHealth?.metrics?.throughputPerHour || 0}
            </div>
            <div className=\"text-sm text-gray-600\">Tasks/Hour</div>
            <div className=\"text-xs text-blue-600 mt-1\">
              {((systemHealth?.metrics?.throughputPerHour || 0) / 60).toFixed(1)}/min
            </div>
          </div>
          
          <div className=\"text-center\">
            <div className={`text-2xl font-bold ${getHealthColor(100 - (systemHealth?.metrics?.errorRate || 0))}`}>
              {(100 - (systemHealth?.metrics?.errorRate || 0)).toFixed(1)}%
            </div>
            <div className=\"text-sm text-gray-600\">Success Rate</div>
            <div className=\"text-xs text-gray-500 mt-1\">
              {systemHealth?.metrics?.errorRate?.toFixed(1) || 0}% errors
            </div>
          </div>
          
          <div className=\"text-center\">
            <div className=\"text-2xl font-bold text-gray-900\">
              {systemHealth?.metrics?.averageTaskDuration ? 
                (systemHealth.metrics.averageTaskDuration / 1000).toFixed(1) : '0.0'}s
            </div>
            <div className=\"text-sm text-gray-600\">Avg Duration</div>
            <div className=\"text-xs text-gray-500 mt-1\">per task</div>
          </div>
        </div>
      </Card>

      {/* Performance Charts */}
      <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
        {/* Throughput & Error Rate */}
        <Card className=\"p-6\">
          <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
            Performance Trends
          </h3>
          <ResponsiveContainer width=\"100%\" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray=\"3 3\" />
              <XAxis dataKey=\"time\" />
              <YAxis yAxisId=\"left\" />
              <YAxis yAxisId=\"right\" orientation=\"right\" />
              <Tooltip />
              <Line 
                yAxisId=\"left\"
                type=\"monotone\" 
                dataKey=\"throughput\" 
                stroke=\"#3B82F6\" 
                strokeWidth={2}
                name=\"Throughput/hr\"
              />
              <Line 
                yAxisId=\"right\"
                type=\"monotone\" 
                dataKey=\"errorRate\" 
                stroke=\"#EF4444\" 
                strokeWidth={2}
                name=\"Error Rate %\"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Task Status Distribution */}
        <Card className=\"p-6\">
          <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
            Task Distribution
          </h3>
          <div className=\"flex items-center justify-center\">
            <ResponsiveContainer width=\"100%\" height={300}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx=\"50%\"
                  cy=\"50%\"
                  outerRadius={100}
                  fill=\"#8884d8\"
                  dataKey=\"value\"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Agent Load Distribution */}
      <Card className=\"p-6\">
        <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
          Agent Load Distribution
        </h3>
        <ResponsiveContainer width=\"100%\" height={300}>
          <BarChart data={agentLoadData}>
            <CartesianGrid strokeDasharray=\"3 3\" />
            <XAxis dataKey=\"name\" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                name === 'load' ? `${value.toFixed(1)}%` : value,
                name === 'load' ? 'Load' : 'Tasks'
              ]}
              labelFormatter={(label) => `Agent: ${label}`}
            />
            <Bar 
              dataKey=\"load\" 
              fill=\"#3B82F6\" 
              name=\"Load %\"
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* System Metrics Grid */}
      <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6\">
        <Card className=\"p-4\">
          <div className=\"flex items-center justify-between\">
            <div>
              <p className=\"text-sm text-gray-600\">System Load</p>
              <p className=\"text-2xl font-bold text-gray-900\">
                {systemHealth?.metrics?.systemLoad?.toFixed(1) || 0}%
              </p>
            </div>
            <Activity className=\"h-8 w-8 text-blue-500\" />
          </div>
          <Progress 
            value={systemHealth?.metrics?.systemLoad || 0} 
            className=\"mt-2\"
          />
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center justify-between\">
            <div>
              <p className=\"text-sm text-gray-600\">Queue Size</p>
              <p className=\"text-2xl font-bold text-gray-900\">
                {(stats?.queue?.pending || 0) + (stats?.queue?.inProgress || 0)}
              </p>
            </div>
            <Clock className=\"h-8 w-8 text-green-500\" />
          </div>
          <div className=\"text-xs text-gray-500 mt-1\">
            {stats?.queue?.pending || 0} pending, {stats?.queue?.inProgress || 0} active
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center justify-between\">
            <div>
              <p className=\"text-sm text-gray-600\">Active Connections</p>
              <p className=\"text-2xl font-bold text-gray-900\">
                {stats?.queue?.websocket?.totalConnections || 0}
              </p>
            </div>
            <Users className=\"h-8 w-8 text-purple-500\" />
          </div>
          <div className=\"text-xs text-gray-500 mt-1\">
            WebSocket connections
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center justify-between\">
            <div>
              <p className=\"text-sm text-gray-600\">Response Time</p>
              <p className=\"text-2xl font-bold text-gray-900\">
                {systemHealth?.metrics?.averageTaskDuration ? 
                  (systemHealth.metrics.averageTaskDuration / 1000).toFixed(1) : '0.0'}s
              </p>
            </div>
            <Zap className=\"h-8 w-8 text-yellow-500\" />
          </div>
          <div className=\"text-xs text-gray-500 mt-1\">
            Average task duration
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className=\"p-6\">
        <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
          Recent System Events
        </h3>
        <div className=\"space-y-3\">
          {/* Mock recent events - in real implementation, these would be actual system events */}
          <div className=\"flex items-center space-x-3 p-3 bg-green-50 rounded-lg\">
            <div className=\"w-2 h-2 bg-green-500 rounded-full\"></div>
            <div className=\"flex-1\">
              <p className=\"text-sm text-gray-900\">Agent 'dns-worker-01' registered successfully</p>
              <p className=\"text-xs text-gray-500\">2 minutes ago</p>
            </div>
          </div>
          
          <div className=\"flex items-center space-x-3 p-3 bg-blue-50 rounded-lg\">
            <div className=\"w-2 h-2 bg-blue-500 rounded-full\"></div>
            <div className=\"flex-1\">
              <p className=\"text-sm text-gray-900\">Task 'dns-update-pihole' completed successfully</p>
              <p className=\"text-xs text-gray-500\">5 minutes ago</p>
            </div>
          </div>
          
          <div className=\"flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg\">
            <div className=\"w-2 h-2 bg-yellow-500 rounded-full\"></div>
            <div className=\"flex-1\">
              <p className=\"text-sm text-gray-900\">High system load detected (85%)</p>
              <p className=\"text-xs text-gray-500\">8 minutes ago</p>
            </div>
          </div>
          
          {stats?.errors?.unresolvedErrors === 0 && (
            <div className=\"flex items-center space-x-3 p-3 bg-gray-50 rounded-lg\">
              <div className=\"w-2 h-2 bg-gray-400 rounded-full\"></div>
              <div className=\"flex-1\">
                <p className=\"text-sm text-gray-500\">No recent system issues</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}