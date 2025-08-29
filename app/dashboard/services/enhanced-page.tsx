'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FuturisticCard } from '@/components/futuristic/FuturisticCard';
import { StatusOrb } from '@/components/futuristic/StatusOrb';
import { 
  Server,
  Play,
  Square,
  RotateCw,
  Activity,
  AlertCircle,
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

export default function EnhancedServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'matrix'>('grid');
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    if (autoRefresh) {
      const interval = setInterval(fetchServices, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Get service icon based on name/type
  const getServiceIcon = (serviceName: string) => {
    const name = serviceName.toLowerCase();
    if (name.includes('database') || name.includes('db') || name.includes('postgres') || name.includes('mysql')) {
      return Database;
    } else if (name.includes('redis') || name.includes('cache')) {
      return MemoryStick;
    } else if (name.includes('nginx') || name.includes('proxy') || name.includes('gateway')) {
      return Globe;
    } else if (name.includes('auth') || name.includes('security')) {
      return Shield;
    } else if (name.includes('api') || name.includes('backend')) {
      return Server;
    } else {
      return Activity;
    }
  };

  // Get status orb status
  const getStatusOrbStatus = (status: string): 'active' | 'warning' | 'error' | 'idle' => {
    switch (status) {
      case 'running': return 'active';
      case 'unhealthy': return 'warning';
      case 'error': return 'error';
      default: return 'idle';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Scanning animation background */}
        <div className="absolute inset-0 cyber-grid opacity-10" />
        <div className="scan-line" />
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <motion.div
            className="cyber-loader mb-6 mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <h2 className="text-2xl font-orbitron font-bold text-cyan-400 mb-2">SCANNING SERVICES</h2>
          <p className="text-gray-400 font-mono">Establishing neural link...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 mx-auto border-2 border-red-500"
            animate={{ 
              boxShadow: [
                '0 0 20px rgba(239, 68, 68, 0.5)',
                '0 0 40px rgba(239, 68, 68, 0.8)',
                '0 0 20px rgba(239, 68, 68, 0.5)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertCircle className="h-10 w-10 text-red-400" />
          </motion.div>
          <h2 className="text-3xl font-orbitron font-bold text-red-400 mb-4">SYSTEM ERROR</h2>
          <p className="text-gray-400 font-mono mb-6">{error}</p>
          <motion.button
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-orbitron font-bold rounded-full transition-all duration-300"
            onClick={() => window.location.reload()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            RETRY CONNECTION
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0">
        {/* Data streams */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-px h-20 bg-gradient-to-b from-cyan-400/50 to-transparent"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 space-y-8 p-6">
        {/* Futuristic Header */}
        <motion.div
          className="flex justify-between items-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div>
            <h1 className="text-4xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400 mb-2 holographic">
              SERVICE CONTROL MATRIX
            </h1>
            <p className="text-cyan-300 font-mono text-lg">
              Container Management • {services.length} Services Online
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-800/50 rounded-full p-1 border border-cyan-500/20">
              <motion.button
                className={`px-4 py-2 rounded-full font-mono text-sm transition-all duration-300 ${
                  viewMode === 'grid' 
                    ? 'bg-cyan-500 text-black font-bold' 
                    : 'text-cyan-400 hover:text-cyan-300'
                }`}
                onClick={() => setViewMode('grid')}
                whileHover={{ scale: 1.05 }}
              >
                GRID
              </motion.button>
              <motion.button
                className={`px-4 py-2 rounded-full font-mono text-sm transition-all duration-300 ${
                  viewMode === 'matrix' 
                    ? 'bg-purple-500 text-black font-bold' 
                    : 'text-purple-400 hover:text-purple-300'
                }`}
                onClick={() => setViewMode('matrix')}
                whileHover={{ scale: 1.05 }}
              >
                MATRIX
              </motion.button>
            </div>
            
            {/* Auto Refresh Toggle */}
            <motion.button
              className={`px-4 py-3 rounded-full font-orbitron font-bold text-sm border-2 transition-all duration-300 ${
                autoRefresh
                  ? 'bg-green-500/20 border-green-500 text-green-400 shadow-green-500/50'
                  : 'bg-slate-800/50 border-gray-500 text-gray-400'
              }`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              AUTO-SYNC {autoRefresh ? 'ON' : 'OFF'}
            </motion.button>
            
            {/* Refresh Button */}
            <motion.button
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-orbitron font-bold rounded-full transition-all duration-300 flex items-center space-x-2 shadow-lg"
              onClick={fetchServices}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCw className="h-5 w-5" />
              <span>SYNC</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Services Grid/Matrix */}
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {services.map((service, index) => {
                const ServiceIcon = getServiceIcon(service.name);
                const isSelected = selectedService === service.id;
                
                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <FuturisticCard
                      title={service.name.toUpperCase()}
                      subtitle={service.container}
                      glowColor={service.status === 'running' ? 'green' : service.status === 'unhealthy' ? 'yellow' : service.status === 'error' ? 'pink' : 'cyan'}
                      interactive
                      dataStream={service.status === 'running'}
                      scanLine={service.status === 'unhealthy'}
                      easterEgg
                      className={isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}
                    >
                      <div 
                        className="p-6 cursor-pointer"
                        onClick={() => setSelectedService(isSelected ? null : service.id)}
                      >
                        {/* Service Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <ServiceIcon className="h-8 w-8 text-cyan-400" />
                              <div className="absolute -bottom-1 -right-1">
                                <StatusOrb 
                                  status={getStatusOrbStatus(service.status)}
                                  size="sm"
                                  interactive
                                />
                              </div>
                            </div>
                            <div>
                              <h3 className="text-lg font-orbitron font-bold text-white">{service.name}</h3>
                              <p className="text-sm font-mono text-gray-400">{service.container}</p>
                            </div>
                          </div>
                        </div>

                        {/* Service Info Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-cyan-500/20">
                            <div className="text-xs font-mono text-gray-400 mb-1">STATUS</div>
                            <div className={`font-orbitron font-bold text-sm uppercase ${
                              service.status === 'running' ? 'text-green-400' :
                              service.status === 'stopped' ? 'text-gray-400' :
                              service.status === 'unhealthy' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {service.status}
                            </div>
                          </div>
                          
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-purple-500/20">
                            <div className="text-xs font-mono text-gray-400 mb-1">PORT</div>
                            <div className="font-orbitron font-bold text-sm text-purple-400">
                              :{service.port}
                            </div>
                          </div>
                          
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-pink-500/20">
                            <div className="text-xs font-mono text-gray-400 mb-1">PRIORITY</div>
                            <div className={`font-orbitron font-bold text-xs uppercase ${
                              service.priority === 'critical' ? 'text-red-400' :
                              service.priority === 'high' ? 'text-orange-400' :
                              service.priority === 'medium' ? 'text-yellow-400' :
                              'text-blue-400'
                            }`}>
                              {service.priority}
                            </div>
                          </div>
                          
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-green-500/20">
                            <div className="text-xs font-mono text-gray-400 mb-1">UPTIME</div>
                            <div className="font-orbitron font-bold text-sm text-green-400">
                              {service.status === 'running' ? '99.9%' : '0%'}
                            </div>
                          </div>
                        </div>

                        {/* Resource Usage */}
                        {service.stats && service.status === 'running' && (
                          <div className="mb-6">
                            <h4 className="text-sm font-orbitron font-bold text-cyan-400 mb-4 flex items-center">
                              <Zap className="h-4 w-4 mr-2" />
                              RESOURCE MONITOR
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="text-center">
                                <div className="relative w-12 h-12 mx-auto mb-2">
                                  <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      stroke="rgba(6, 182, 212, 0.2)"
                                      strokeWidth="4"
                                      fill="none"
                                    />
                                    <motion.circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      stroke="#06b6d4"
                                      strokeWidth="4"
                                      fill="none"
                                      strokeLinecap="round"
                                      initial={{ strokeDasharray: `0 ${2 * Math.PI * 20}` }}
                                      animate={{ 
                                        strokeDasharray: `${(service.stats.cpu / 100) * (2 * Math.PI * 20)} ${2 * Math.PI * 20}` 
                                      }}
                                      transition={{ duration: 1, ease: 'easeOut' }}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Cpu className="h-5 w-5 text-cyan-400" />
                                  </div>
                                </div>
                                <div className="text-xs font-mono text-gray-400">CPU</div>
                                <div className="text-sm font-orbitron font-bold text-cyan-400">
                                  {service.stats.cpu.toFixed(1)}%
                                </div>
                              </div>
                              
                              <div className="text-center">
                                <div className="relative w-12 h-12 mx-auto mb-2">
                                  <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      stroke="rgba(34, 197, 94, 0.2)"
                                      strokeWidth="4"
                                      fill="none"
                                    />
                                    <motion.circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      stroke="#22c55e"
                                      strokeWidth="4"
                                      fill="none"
                                      strokeLinecap="round"
                                      initial={{ strokeDasharray: `0 ${2 * Math.PI * 20}` }}
                                      animate={{ 
                                        strokeDasharray: `${(service.stats.memory / 100) * (2 * Math.PI * 20)} ${2 * Math.PI * 20}` 
                                      }}
                                      transition={{ duration: 1, ease: 'easeOut' }}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <MemoryStick className="h-5 w-5 text-green-400" />
                                  </div>
                                </div>
                                <div className="text-xs font-mono text-gray-400">MEM</div>
                                <div className="text-sm font-orbitron font-bold text-green-400">
                                  {service.stats.memory.toFixed(1)}%
                                </div>
                              </div>
                              
                              <div className="text-center">
                                <div className="relative w-12 h-12 mx-auto mb-2">
                                  <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      stroke="rgba(168, 85, 247, 0.2)"
                                      strokeWidth="4"
                                      fill="none"
                                    />
                                    <motion.circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      stroke="#a855f7"
                                      strokeWidth="4"
                                      fill="none"
                                      strokeLinecap="round"
                                      initial={{ strokeDasharray: `0 ${2 * Math.PI * 20}` }}
                                      animate={{ 
                                        strokeDasharray: `${((service.stats.network.rx + service.stats.network.tx) / 2000000 * 100) * (2 * Math.PI * 20)} ${2 * Math.PI * 20}` 
                                      }}
                                      transition={{ duration: 1, ease: 'easeOut' }}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Network className="h-5 w-5 text-purple-400" />
                                  </div>
                                </div>
                                <div className="text-xs font-mono text-gray-400">NET</div>
                                <div className="text-sm font-orbitron font-bold text-purple-400">
                                  {formatBytes(service.stats.network.rx + service.stats.network.tx)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          {service.status === 'stopped' ? (
                            <motion.button
                              className={`flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-orbitron font-bold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                                actionInProgress !== null ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={() => handleServiceAction(service.id, 'start')}
                              disabled={actionInProgress !== null}
                              whileHover={{ scale: actionInProgress === null ? 1.05 : 1 }}
                              whileTap={{ scale: actionInProgress === null ? 0.95 : 1 }}
                            >
                              {actionInProgress === `${service.id}-start` ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <>
                                  <Play className="h-5 w-5" />
                                  <span>START</span>
                                </>
                              )}
                            </motion.button>
                          ) : (
                            <motion.button
                              className={`flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-orbitron font-bold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                                actionInProgress !== null || service.priority === 'critical' ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={() => handleServiceAction(service.id, 'stop')}
                              disabled={actionInProgress !== null || service.priority === 'critical'}
                              whileHover={{ scale: actionInProgress === null && service.priority !== 'critical' ? 1.05 : 1 }}
                              whileTap={{ scale: actionInProgress === null && service.priority !== 'critical' ? 0.95 : 1 }}
                            >
                              {actionInProgress === `${service.id}-stop` ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <>
                                  <Square className="h-5 w-5" />
                                  <span>STOP</span>
                                </>
                              )}
                            </motion.button>
                          )}
                          
                          <motion.button
                            className={`flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-orbitron font-bold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                              actionInProgress !== null || service.status === 'stopped' ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            onClick={() => handleServiceAction(service.id, 'restart')}
                            disabled={actionInProgress !== null || service.status === 'stopped'}
                            whileHover={{ scale: actionInProgress === null && service.status !== 'stopped' ? 1.05 : 1 }}
                            whileTap={{ scale: actionInProgress === null && service.status !== 'stopped' ? 0.95 : 1 }}
                          >
                            {actionInProgress === `${service.id}-restart` ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <>
                                <RotateCw className="h-5 w-5" />
                                <span>REBOOT</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </FuturisticCard>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            /* Matrix View */
            <motion.div
              key="matrix"
              className="space-y-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <FuturisticCard
                title="SERVICE MATRIX VIEW"
                subtitle="REAL-TIME MONITORING GRID"
                glowColor="purple"
                interactive
                dataStream
                className="overflow-hidden"
              >
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-2">
                    {services.map((service, index) => {
                      const ServiceIcon = getServiceIcon(service.name);
                      
                      return (
                        <motion.div
                          key={service.id}
                          className="flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-700/50 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all duration-300 cursor-pointer"
                          initial={{ opacity: 0, x: -50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          onClick={() => setSelectedService(service.id === selectedService ? null : service.id)}
                          whileHover={{ x: 10 }}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <ServiceIcon className="h-6 w-6 text-cyan-400" />
                              <div className="absolute -bottom-1 -right-1">
                                <StatusOrb 
                                  status={getStatusOrbStatus(service.status)}
                                  size="sm"
                                />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-orbitron font-bold">{service.name}</div>
                              <div className="text-xs text-gray-400 font-mono">{service.container}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-6">
                            {service.stats && service.status === 'running' && (
                              <>
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">CPU</div>
                                  <div className="text-sm font-mono text-cyan-400">{service.stats.cpu.toFixed(1)}%</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">MEM</div>
                                  <div className="text-sm font-mono text-green-400">{service.stats.memory.toFixed(1)}%</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">NET</div>
                                  <div className="text-sm font-mono text-purple-400">{formatBytes(service.stats.network.rx + service.stats.network.tx)}</div>
                                </div>
                              </>
                            )}
                            
                            <div className="text-center">
                              <div className="text-xs text-gray-400">PORT</div>
                              <div className="text-sm font-mono text-purple-400">:{service.port}</div>
                            </div>
                            
                            <div className={`px-3 py-1 rounded-full text-xs font-orbitron font-bold ${
                              service.status === 'running' ? 'bg-green-500/20 text-green-400' :
                              service.status === 'unhealthy' ? 'bg-yellow-500/20 text-yellow-400' :
                              service.status === 'error' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {service.status.toUpperCase()}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </FuturisticCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}