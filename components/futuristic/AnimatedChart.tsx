'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';

interface DataPoint {
  name: string;
  value: number;
  timestamp?: number;
}

interface AnimatedChartProps {
  data: DataPoint[];
  type?: 'line' | 'bar' | 'area' | 'neural';
  height?: number;
  color?: 'cyan' | 'purple' | 'green' | 'pink' | 'yellow';
  glowEffect?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  interactive?: boolean;
  realTime?: boolean;
  neuralNetwork?: boolean;
  title?: string;
  subtitle?: string;
}

export const AnimatedChart: React.FC<AnimatedChartProps> = ({
  data,
  type = 'line',
  height = 200,
  color = 'cyan',
  glowEffect = true,
  showGrid = true,
  showLabels = true,
  interactive = true,
  realTime = false,
  neuralNetwork = false,
  title,
  subtitle,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Color configurations
  const colorConfig = {
    cyan: {
      primary: '#00ffff',
      secondary: '#00cccc',
      glow: 'rgba(0, 255, 255, 0.8)',
      gradient: 'from-cyan-500/50 to-cyan-400/20',
    },
    purple: {
      primary: '#bf00ff',
      secondary: '#9900cc',
      glow: 'rgba(191, 0, 255, 0.8)',
      gradient: 'from-purple-500/50 to-purple-400/20',
    },
    green: {
      primary: '#00ff88',
      secondary: '#00cc6a',
      glow: 'rgba(0, 255, 136, 0.8)',
      gradient: 'from-green-500/50 to-green-400/20',
    },
    pink: {
      primary: '#ff00aa',
      secondary: '#cc0088',
      glow: 'rgba(255, 0, 170, 0.8)',
      gradient: 'from-pink-500/50 to-pink-400/20',
    },
    yellow: {
      primary: '#ffea00',
      secondary: '#ccbb00',
      glow: 'rgba(255, 234, 0, 0.8)',
      gradient: 'from-yellow-500/50 to-yellow-400/20',
    },
  };

  const colors = colorConfig[color];

  // Normalize data for chart
  const normalizedData = useMemo(() => {
    if (data.length === 0) return [];
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return data.map((point, index) => ({
      ...point,
      normalizedValue: ((point.value - minValue) / range),
      x: (index / (data.length - 1)) * 100,
      y: (1 - ((point.value - minValue) / range)) * 100,
    }));
  }, [data]);

  // Generate SVG path for line chart
  const generatePath = (points: typeof normalizedData, type: 'line' | 'area' = 'line') => {
    if (points.length === 0) return '';
    
    const pathCommands = points.map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${point.x} ${point.y}`;
    }).join(' ');

    if (type === 'area') {
      return `${pathCommands} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
    }
    
    return pathCommands;
  };

  // Animation effect
  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setAnimationProgress(1);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Real-time data simulation
  useEffect(() => {
    if (realTime) {
      const interval = setInterval(() => {
        setAnimationProgress(p => (p + 0.1) % 1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [realTime]);

  const svgPath = generatePath(normalizedData);
  const areaPath = generatePath(normalizedData, 'area');

  return (
    <motion.div
      className="relative w-full bg-slate-900/50 rounded-xl p-6 backdrop-blur-sm border border-white/10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h3 className="text-lg font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-400 font-mono">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div 
        className="relative"
        style={{ height: `${height}px` }}
      >
        {/* Neural Network Background */}
        {neuralNetwork && (
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Neural connections */}
              {normalizedData.map((point, i) => {
                if (i === normalizedData.length - 1) return null;
                const nextPoint = normalizedData[i + 1];
                return (
                  <motion.line
                    key={`neural-${i}`}
                    x1={`${point.x}%`}
                    y1={`${point.y}%`}
                    x2={`${nextPoint.x}%`}
                    y2={`${nextPoint.y}%`}
                    stroke={colors.secondary}
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: animationProgress }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Grid */}
        {showGrid && (
          <div className="absolute inset-0">
            <svg width="100%" height="100%">
              {/* Horizontal grid lines */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={`h-${y}`}
                  x1="0%"
                  y1={`${y}%`}
                  x2="100%"
                  y2={`${y}%`}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
              ))}
              {/* Vertical grid lines */}
              {[0, 25, 50, 75, 100].map((x) => (
                <line
                  key={`v-${x}`}
                  x1={`${x}%`}
                  y1="0%"
                  x2={`${x}%`}
                  y2="100%"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
              ))}
            </svg>
          </div>
        )}

        {/* Main Chart SVG */}
        <svg width="100%" height="100%" className="relative z-10 overflow-visible">
          {/* Area fill for area and line charts */}
          {(type === 'area' || type === 'line') && normalizedData.length > 0 && (
            <motion.path
              d={areaPath}
              fill={`url(#gradient-${color})`}
              stroke="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: type === 'area' ? 0.3 : 0.1 }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          )}

          {/* Line stroke */}
          {(type === 'line' || type === 'area') && normalizedData.length > 0 && (
            <motion.path
              d={svgPath}
              fill="none"
              stroke={colors.primary}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={glowEffect ? `url(#glow-${color})` : undefined}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            />
          )}

          {/* Data points */}
          {normalizedData.map((point, index) => (
            <motion.circle
              key={index}
              cx={`${point.x}%`}
              cy={`${point.y}%`}
              r={hoveredPoint === index ? "8" : "5"}
              fill={colors.primary}
              filter={glowEffect ? `url(#glow-${color})` : undefined}
              className={interactive ? 'cursor-pointer' : ''}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={interactive ? { scale: 1.5 } : {}}
              onMouseEnter={() => interactive && setHoveredPoint(index)}
              onMouseLeave={() => interactive && setHoveredPoint(null)}
            />
          ))}

          {/* Bar chart bars */}
          {type === 'bar' && normalizedData.map((point, index) => (
            <motion.rect
              key={index}
              x={`${point.x - 2}%`}
              y={`${point.y}%`}
              width="4%"
              height={`${100 - point.y}%`}
              fill={`url(#gradient-${color})`}
              rx="2"
              className={interactive ? 'cursor-pointer' : ''}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
              style={{ transformOrigin: 'bottom' }}
              onMouseEnter={() => interactive && setHoveredPoint(index)}
              onMouseLeave={() => interactive && setHoveredPoint(null)}
            />
          ))}

          {/* Gradient and glow definitions */}
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.8" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.1" />
            </linearGradient>
            <filter id={`glow-${color}`}>
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Hover tooltip */}
        {hoveredPoint !== null && interactive && normalizedData[hoveredPoint] && (
          <motion.div
            className="absolute z-50 bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm font-mono backdrop-blur-sm"
            style={{
              left: `${normalizedData[hoveredPoint].x}%`,
              top: `${normalizedData[hoveredPoint].y}%`,
              transform: 'translate(-50%, -120%)',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-cyan-400 font-semibold">
              {normalizedData[hoveredPoint].name}
            </div>
            <div className="text-white">
              {normalizedData[hoveredPoint].value.toLocaleString()}
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
          </motion.div>
        )}

        {/* Real-time pulse indicator */}
        {realTime && (
          <motion.div
            className="absolute top-2 right-2 w-3 h-3 bg-green-400 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between mt-4 text-xs text-gray-400 font-mono">
          {normalizedData.map((point, index) => {
            if (index % Math.ceil(normalizedData.length / 5) !== 0 && index !== normalizedData.length - 1) return null;
            return (
              <div key={index} className="text-center">
                {point.name}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};