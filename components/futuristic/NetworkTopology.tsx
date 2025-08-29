'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { Server, Database, Globe, Shield, Cpu, HardDrive } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  type: 'server' | 'database' | 'network' | 'security' | 'compute' | 'storage';
  status: 'active' | 'warning' | 'error' | 'idle';
  x: number;
  y: number;
  connections: string[];
  stats?: {
    cpu: number;
    memory: number;
    network: number;
  };
}

interface Connection {
  from: string;
  to: string;
  status: 'active' | 'idle' | 'error';
  throughput?: number;
  latency?: number;
}

interface NetworkTopologyProps {
  nodes: Node[];
  connections?: Connection[];
  animated?: boolean;
  interactive?: boolean;
  realTime?: boolean;
  showStats?: boolean;
  onNodeClick?: (node: Node) => void;
  className?: string;
}

// Sample data for demo
const sampleNodes: Node[] = [
  { id: 'web', name: 'Web Server', type: 'server', status: 'active', x: 20, y: 30, connections: ['db', 'cache'], stats: { cpu: 45, memory: 60, network: 30 } },
  { id: 'api', name: 'API Gateway', type: 'server', status: 'active', x: 50, y: 20, connections: ['web', 'db', 'auth'], stats: { cpu: 65, memory: 55, network: 80 } },
  { id: 'db', name: 'Database', type: 'database', status: 'warning', x: 80, y: 40, connections: ['backup'], stats: { cpu: 30, memory: 85, network: 45 } },
  { id: 'cache', name: 'Redis Cache', type: 'database', status: 'active', x: 35, y: 60, connections: ['web'], stats: { cpu: 15, memory: 40, network: 20 } },
  { id: 'auth', name: 'Auth Service', type: 'security', status: 'active', x: 65, y: 70, connections: ['api'], stats: { cpu: 25, memory: 35, network: 15 } },
  { id: 'backup', name: 'Backup Storage', type: 'storage', status: 'idle', x: 85, y: 75, connections: [], stats: { cpu: 5, memory: 20, network: 10 } },
];

const sampleConnections: Connection[] = [
  { from: 'web', to: 'api', status: 'active', throughput: 1250, latency: 2 },
  { from: 'api', to: 'db', status: 'active', throughput: 850, latency: 5 },
  { from: 'web', to: 'cache', status: 'active', throughput: 420, latency: 1 },
  { from: 'api', to: 'auth', status: 'active', throughput: 320, latency: 3 },
  { from: 'db', to: 'backup', status: 'idle', throughput: 0, latency: 0 },
];

// Icon mapping
const iconMap = {
  server: Server,
  database: Database,
  network: Globe,
  security: Shield,
  compute: Cpu,
  storage: HardDrive,
};

// Status color mapping
const statusColors = {
  active: { bg: 'bg-green-400', border: 'border-green-400', glow: 'shadow-green-400/50' },
  warning: { bg: 'bg-yellow-400', border: 'border-yellow-400', glow: 'shadow-yellow-400/50' },
  error: { bg: 'bg-red-400', border: 'border-red-400', glow: 'shadow-red-400/50' },
  idle: { bg: 'bg-gray-400', border: 'border-gray-400', glow: 'shadow-gray-400/30' },
};

// Connection status colors
const connectionColors = {
  active: '#00ff88',
  idle: '#6b7280',
  error: '#ff0055',
};

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  nodes = sampleNodes,
  connections = sampleConnections,
  animated = true,
  interactive = true,
  realTime = false,
  showStats = true,
  onNodeClick,
  className = '',
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dataFlow, setDataFlow] = useState<{[key: string]: number}>({});
  const [secretNodes, setSecretNodes] = useState<string[]>([]);

  // Generate data flow animation
  useEffect(() => {
    if (realTime) {
      const interval = setInterval(() => {
        const newFlow: {[key: string]: number} = {};
        connections.forEach(conn => {
          newFlow[`${conn.from}-${conn.to}`] = Math.random();
        });
        setDataFlow(newFlow);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [connections, realTime]);

  // Easter egg - find hidden nodes
  const handleNodeClick = (node: Node) => {
    if (interactive) {
      setSelectedNode(node.id === selectedNode ? null : node.id);
      onNodeClick?.(node);

      // Easter egg: clicking nodes in sequence reveals secret
      const clickSequence = ['web', 'api', 'db', 'auth'];
      const currentIndex = secretNodes.length;
      
      if (node.id === clickSequence[currentIndex]) {
        const newSecretNodes = [...secretNodes, node.id];
        setSecretNodes(newSecretNodes);
        
        if (newSecretNodes.length === clickSequence.length) {
          // Show secret message
          setTimeout(() => {
            alert('🎉 KONAMI CODE ACHIEVED! You found the network master sequence!');
            setSecretNodes([]);
          }, 500);
        }
      } else {
        setSecretNodes([]);
      }
    }
  };

  // Calculate connection paths
  const getConnectionPath = (from: Node, to: Node) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const controlPointOffset = Math.sqrt(dx * dx + dy * dy) * 0.3;
    
    return `M ${from.x} ${from.y} Q ${from.x + dx/2} ${from.y + dy/2 - controlPointOffset} ${to.x} ${to.y}`;
  };

  // Create node map for easy lookup
  const nodeMap = useMemo(() => {
    const map: {[key: string]: Node} = {};
    nodes.forEach(node => map[node.id] = node);
    return map;
  }, [nodes]);

  return (
    <div className={`relative w-full h-96 bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden ${className}`}>
      {/* Background grid */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Matrix rain effect for activated nodes */}
      {secretNodes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-green-400 text-xs font-mono"
              style={{
                left: `${Math.random() * 100}%`,
                fontFamily: 'monospace',
              }}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 400, opacity: [0, 1, 0] }}
              transition={{
                duration: 3,
                delay: i * 0.2,
                repeat: secretNodes.length >= 3 ? Infinity : 0,
              }}
            >
              {Math.random().toString(36).substr(2, 1)}
            </motion.div>
          ))}
        </div>
      )}

      {/* Main topology SVG */}
      <svg width="100%" height="100%" className="relative z-20">
        {/* Connection lines */}
        {connections.map((conn, index) => {
          const fromNode = nodeMap[conn.from];
          const toNode = nodeMap[conn.to];
          if (!fromNode || !toNode) return null;

          const pathId = `${conn.from}-${conn.to}`;
          const flowProgress = dataFlow[pathId] || 0;

          return (
            <g key={pathId}>
              {/* Main connection line */}
              <motion.path
                d={getConnectionPath(fromNode, toNode)}
                stroke={connectionColors[conn.status]}
                strokeWidth="2"
                fill="none"
                opacity="0.6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: animated ? 1 : 1 }}
                transition={{ duration: 1, delay: index * 0.2 }}
              />

              {/* Data flow animation */}
              {realTime && conn.status === 'active' && (
                <motion.circle
                  r="3"
                  fill="#00ffff"
                  opacity="0.8"
                  filter="url(#glow)"
                  initial={{ offsetDistance: '0%' }}
                  animate={{ offsetDistance: '100%' }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    offsetPath: `path('${getConnectionPath(fromNode, toNode)}')`,
                  }}
                />
              )}

              {/* Throughput indicator */}
              {showStats && conn.throughput && conn.throughput > 0 && (
                <motion.text
                  x={(fromNode.x + toNode.x) / 2}
                  y={(fromNode.y + toNode.y) / 2 - 10}
                  fill="#00ffff"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredNode === conn.from || hoveredNode === conn.to ? 1 : 0.7 }}
                >
                  {conn.throughput} kb/s
                </motion.text>
              )}
            </g>
          );
        })}

        {/* Glow filter definition */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Nodes */}
      {nodes.map((node, index) => {
        const Icon = iconMap[node.type];
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const isSecret = secretNodes.includes(node.id);
        const statusColor = statusColors[node.status];

        return (
          <motion.div
            key={node.id}
            className={`
              absolute z-30 cursor-pointer
              w-16 h-16 -translate-x-8 -translate-y-8
              bg-slate-800/90 backdrop-blur-sm
              border-2 ${statusColor.border}
              rounded-xl
              flex items-center justify-center
              transition-all duration-300
              ${isHovered ? 'scale-110 shadow-2xl' : ''}
              ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}
              ${isSecret ? 'animate-pulse' : ''}
            `}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              boxShadow: isHovered ? `0 0 30px ${statusColor.glow}` : `0 0 15px ${statusColor.glow}`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={interactive ? { scale: 1.2 } : {}}
            whileTap={interactive ? { scale: 0.95 } : {}}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => handleNodeClick(node)}
          >
            {/* Node icon */}
            <Icon className={`w-6 h-6 ${statusColor.bg.replace('bg-', 'text-')}`} />

            {/* Status indicator */}
            <div
              className={`absolute -top-1 -right-1 w-3 h-3 ${statusColor.bg} rounded-full`}
              style={{
                boxShadow: `0 0 10px ${statusColor.glow}`,
              }}
            />

            {/* Node tooltip */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50"
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm font-mono backdrop-blur-sm min-w-max">
                    <div className="text-cyan-400 font-semibold">{node.name}</div>
                    <div className="text-gray-300 capitalize">{node.type} • {node.status}</div>
                    {showStats && node.stats && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">CPU:</span>
                          <span className={node.stats.cpu > 80 ? 'text-red-400' : 'text-green-400'}>
                            {node.stats.cpu}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">MEM:</span>
                          <span className={node.stats.memory > 80 ? 'text-red-400' : 'text-green-400'}>
                            {node.stats.memory}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">NET:</span>
                          <span className="text-cyan-400">{node.stats.network}%</span>
                        </div>
                      </div>
                    )}
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Secret activation effect */}
            {isSecret && (
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-green-400"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.5, 1],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
              />
            )}
          </motion.div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-xs font-mono">
        <div className="text-cyan-400 font-semibold mb-2">Network Status</div>
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span className="text-gray-300">Active</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
            <span className="text-gray-300">Warning</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
            <span className="text-gray-300">Error</span>
          </div>
        </div>
      </div>

      {/* Real-time indicator */}
      {realTime && (
        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-800/90 backdrop-blur-sm border border-green-500/30 rounded-lg px-3 py-2">
          <motion.div
            className="w-2 h-2 bg-green-400 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
          <span className="text-green-400 text-xs font-mono">LIVE</span>
        </div>
      )}

      {/* Easter egg progress indicator */}
      {secretNodes.length > 0 && secretNodes.length < 4 && (
        <motion.div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-900/50 border border-green-400/30 rounded-lg px-4 py-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="text-green-400 text-xs font-mono">
            SEQUENCE: {secretNodes.length}/4 - Keep going!
          </div>
        </motion.div>
      )}
    </div>
  );
};