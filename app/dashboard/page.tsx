'use client';

import { StatusCard } from '@/components/dashboard/StatusCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { 
  Activity, 
  Server, 
  DollarSign, 
  Bell,
  TrendingUp,
  Users,
  Cpu,
  HardDrive
} from 'lucide-react';

export default function DashboardPage() {
  // Mock data - in production, this would come from API
  const metrics = {
    services: { running: 5, stopped: 1, error: 0 },
    accounts: { total: 3, balance: 31170.50 },
    alerts: { active: 2, triggered: 15 },
    health: { cpu: 45, memory: 62, disk: 38 }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome back! Here's an overview of your HomeOps system.
        </p>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Services"
          value={`${metrics.services.running}/${metrics.services.running + metrics.services.stopped}`}
          subtitle="Running"
          icon={Server}
          status="success"
        />
        <StatusCard
          title="Total Balance"
          value={`$${metrics.accounts.balance.toLocaleString()}`}
          subtitle={`${metrics.accounts.total} accounts`}
          icon={DollarSign}
          status="success"
        />
        <StatusCard
          title="Active Alerts"
          value={metrics.alerts.active.toString()}
          subtitle={`${metrics.alerts.triggered} triggered today`}
          icon={Bell}
          status={metrics.alerts.active > 0 ? 'warning' : 'success'}
        />
        <StatusCard
          title="System Health"
          value="Healthy"
          subtitle="All systems operational"
          icon={Activity}
          status="success"
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MetricCard
          title="CPU Usage"
          value={metrics.health.cpu}
          unit="%"
          icon={Cpu}
          color="blue"
        />
        <MetricCard
          title="Memory Usage"
          value={metrics.health.memory}
          unit="%"
          icon={HardDrive}
          color="green"
        />
        <MetricCard
          title="Disk Usage"
          value={metrics.health.disk}
          unit="%"
          icon={HardDrive}
          color="purple"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Service Uptime"
          subtitle="Last 7 days"
          data={[
            { name: 'Mon', value: 100 },
            { name: 'Tue', value: 98 },
            { name: 'Wed', value: 100 },
            { name: 'Thu', value: 95 },
            { name: 'Fri', value: 100 },
            { name: 'Sat', value: 100 },
            { name: 'Sun', value: 99 },
          ]}
        />
        <ChartCard
          title="Account Balance"
          subtitle="Last 30 days"
          data={[
            { name: 'Week 1', value: 28500 },
            { name: 'Week 2', value: 29200 },
            { name: 'Week 3', value: 30100 },
            { name: 'Week 4', value: 31170 },
          ]}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b dark:border-gray-700">
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-green-500 mr-3" />
              <div>
                <p className="font-medium">Trade Executed</p>
                <p className="text-sm text-gray-500">AAPL: Buy 10 shares @ $185.50</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">2 minutes ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b dark:border-gray-700">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-yellow-500 mr-3" />
              <div>
                <p className="font-medium">Alert Triggered</p>
                <p className="text-sm text-gray-500">Low balance warning on Checking account</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">15 minutes ago</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center">
              <Server className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <p className="font-medium">Service Restarted</p>
                <p className="text-sm text-gray-500">Redis cache service auto-restarted</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">1 hour ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}