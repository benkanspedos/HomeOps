'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MinimalisticCard, MetricCard } from '@/components/futuristic/MinimalisticCard';
import { StatusIndicator } from '@/components/futuristic/StatusIndicator';
import { GalaxyBackground } from '@/components/futuristic/GalaxyBackground';
import { 
  Activity, 
  Server, 
  DollarSign, 
  Bell,
  TrendingUp,
  Cpu,
  HardDrive,
  Database,
  Clock,
  Shield,
  Network,
  BarChart3,
  Settings
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    services: { running: 0, stopped: 0, unhealthy: 0, total: 0 },
    accounts: { total: 3, balance: 31170.50 },
    alerts: { active: 2, triggered: 15 },
    health: { cpu: 0, memory: 0, disk: 38 }
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/services/health/summary`);
        if (response.ok) {
          const data = await response.json();
          setMetrics(prev => ({
            ...prev,
            services: {
              running: data.running,
              stopped: data.stopped,
              unhealthy: data.unhealthy,
              total: data.totalServices
            },
            health: {
              cpu: Math.round(data.cpuUsage),
              memory: Math.round(data.memoryUsage),
              disk: 38
            }
          }));
        }
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      } finally {
        setLoading(false);
      }
    };

    // Update time
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    fetchHealth();
    const healthInterval = setInterval(fetchHealth, 30000); // Check every 30 seconds

    return () => {
      clearInterval(timeInterval);
      clearInterval(healthInterval);
    };
  }, []);

  const getSystemStatus = () => {
    if (loading) return 'initializing';
    if (metrics.services.unhealthy > 0) return 'warning';
    if (metrics.services.stopped > 0) return 'degraded';
    return 'operational';
  };

  const statusMessages = {
    initializing: 'System initializing...',
    operational: 'All systems operational',
    degraded: 'Some services offline',
    warning: 'Attention required',
  };

  // Sample data for charts
  const uptimeData = [
    { name: 'Mon', value: 100 },
    { name: 'Tue', value: 98 },
    { name: 'Wed', value: 100 },
    { name: 'Thu', value: 95 },
    { name: 'Fri', value: 100 },
    { name: 'Sat', value: 100 },
    { name: 'Sun', value: 99 },
  ];

  const balanceData = [
    { name: 'Week 1', value: 28500 },
    { name: 'Week 2', value: 29200 },
    { name: 'Week 3', value: 30100 },
    { name: 'Week 4', value: 31170 },
  ];

  const cpuData = [
    { name: '00:00', value: 25 },
    { name: '06:00', value: 45 },
    { name: '12:00', value: 65 },
    { name: '18:00', value: metrics.health.cpu },
    { name: 'Now', value: metrics.health.cpu + Math.random() * 10 - 5 },
  ];

  const systemStatus = getSystemStatus();

  return (
    <>
      {/* Galaxy Background */}
      <GalaxyBackground density="low" animated />
      
      <div className="relative z-10 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Refined Header */}
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="space-y-2">
              <h1 className="text-4xl font-light text-gray-200 tracking-wide">
                HomeOps
              </h1>
              <div className="w-24 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent mx-auto" />
              <p className="text-sm text-gray-400 font-light tracking-wider">
                System Management Dashboard
              </p>
            </div>
            
            {/* Status Line */}
            <motion.div
              className="flex items-center justify-center space-x-4 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="flex items-center space-x-2">
                <StatusIndicator 
                  status={systemStatus === 'operational' ? 'active' : systemStatus === 'warning' ? 'warning' : 'idle'}
                  size="sm"
                  showLabel={false}
                />
                <span className="text-gray-400">
                  {statusMessages[systemStatus as keyof typeof statusMessages]}
                </span>
              </div>
              
              <div className="w-px h-4 bg-gray-600/30" />
              
              <div className="flex items-center space-x-2 text-gray-500">
                <Clock size={14} />
                <span className="font-mono text-xs">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Primary Metrics Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <MetricCard
              title="Services"
              value={loading ? '...' : `${metrics.services.running}/${metrics.services.total}`}
              subtitle="Active containers"
              icon={Server}
              variant="primary"
              trend={metrics.services.unhealthy > 0 ? 'down' : 'up'}
            />

            <MetricCard
              title="Portfolio"
              value={`$${metrics.accounts.balance.toLocaleString()}`}
              subtitle={`${metrics.accounts.total} accounts`}
              icon={DollarSign}
              variant="accent"
              trend="up"
            />

            <MetricCard
              title="Alerts"
              value={metrics.alerts.active}
              subtitle={`${metrics.alerts.triggered} today`}
              icon={Bell}
              variant={metrics.alerts.active > 0 ? 'default' : 'primary'}
              trend={metrics.alerts.active > 0 ? 'down' : 'neutral'}
            />

            <MetricCard
              title="System Health"
              value="Optimal"
              subtitle="All systems online"
              icon={Activity}
              variant="primary"
              trend="up"
            />
          </motion.div>

          {/* System Resources */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <MinimalisticCard
              title="CPU Usage"
              subtitle="Processing power"
              icon={Cpu}
              variant="primary"
            >
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-light text-blue-300">
                    {metrics.health.cpu}%
                  </span>
                  <span className="text-xs text-gray-500">utilization</span>
                </div>
                
                <div className="space-y-2">
                  <div className="w-full bg-gray-800/50 rounded-full h-1.5">
                    <motion.div
                      className="h-1.5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${metrics.health.cpu}%` }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </MinimalisticCard>

            <MinimalisticCard
              title="Memory"
              subtitle="RAM allocation"
              icon={HardDrive}
              variant="default"
            >
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-light text-gray-300">
                    {metrics.health.memory}%
                  </span>
                  <span className="text-xs text-gray-500">allocated</span>
                </div>
                
                <div className="space-y-2">
                  <div className="w-full bg-gray-800/50 rounded-full h-1.5">
                    <motion.div
                      className="h-1.5 bg-gradient-to-r from-gray-500 to-gray-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${metrics.health.memory}%` }}
                      transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    {((metrics.health.memory / 100) * 16).toFixed(1)} / 16 GB
                  </div>
                </div>
              </div>
            </MinimalisticCard>

            <MinimalisticCard
              title="Storage"
              subtitle="Disk capacity"
              icon={Database}
              variant="accent"
            >
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-light text-gray-300">
                    {metrics.health.disk}%
                  </span>
                  <span className="text-xs text-gray-500">capacity</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Used</div>
                    <div className="text-gray-300 font-medium">380 GB</div>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Free</div>
                    <div className="text-gray-300 font-medium">620 GB</div>
                  </div>
                </div>
              </div>
            </MinimalisticCard>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <MinimalisticCard
              title="System Activity"
              subtitle="Recent events"
              icon={BarChart3}
              variant="primary"
            >
              <div className="space-y-3">
                {[
                  { icon: TrendingUp, message: 'Trade executed: AAPL +10 shares', time: '2 min ago', status: 'active' },
                  { icon: Bell, message: 'Low balance alert triggered', time: '15 min ago', status: 'warning' },
                  { icon: Server, message: 'Redis service auto-restarted', time: '1 hr ago', status: 'active' },
                ].map((activity, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-gray-900/20 border border-gray-700/20"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                  >
                    <StatusIndicator 
                      status={activity.status as any}
                      size="sm"
                      showLabel={false}
                    />
                    <activity.icon size={16} className="text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{activity.message}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </MinimalisticCard>

            <MinimalisticCard
              title="Network Overview"
              subtitle="Infrastructure status"
              icon={Network}
              variant="default"
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'Web Server', status: 'active' },
                  { name: 'Database', status: 'active' },
                  { name: 'Cache', status: 'active' },
                  { name: 'Auth Service', status: metrics.services.unhealthy > 0 ? 'warning' : 'active' },
                ].map((service, index) => (
                  <motion.div
                    key={service.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-900/20 border border-gray-700/20"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + index * 0.05 }}
                  >
                    <span className="text-sm text-gray-300">{service.name}</span>
                    <StatusIndicator 
                      status={service.status as any}
                      size="sm"
                      showLabel={false}
                    />
                  </motion.div>
                ))}
              </div>
            </MinimalisticCard>
          </motion.div>
        </div>
      </div>
    </>
  );
}