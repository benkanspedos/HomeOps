'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'idle' | 'connecting';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  interactive?: boolean;
  onStatusClick?: () => void;
  showLabel?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  label,
  interactive = false,
  onStatusClick,
  showLabel = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Size configurations - minimalistic approach
  const sizeConfig = {
    sm: { indicator: 'w-2 h-2', wrapper: 'w-4 h-4' },
    md: { indicator: 'w-3 h-3', wrapper: 'w-6 h-6' },
    lg: { indicator: 'w-4 h-4', wrapper: 'w-8 h-8' },
    xl: { indicator: 'w-6 h-6', wrapper: 'w-10 h-10' },
  };

  // Refined status colors - cool palette only
  const statusConfig = {
    active: {
      color: 'bg-green-500',
      glowColor: 'shadow-[0_0_8px_rgba(34,197,94,0.3)]',
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
    warning: {
      color: 'bg-yellow-500',
      glowColor: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]',
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
    },
    error: {
      color: 'bg-red-500',
      glowColor: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    info: {
      color: 'bg-blue-500',
      glowColor: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    connecting: {
      color: 'bg-blue-400',
      glowColor: 'shadow-[0_0_8px_rgba(96,165,250,0.3)]',
      textColor: 'text-blue-300',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/20',
    },
    idle: {
      color: 'bg-gray-500',
      glowColor: 'shadow-[0_0_6px_rgba(136,136,136,0.2)]',
      textColor: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
    },
  };

  // Map connecting to info for cleaner design
  const mappedStatus = status === 'connecting' ? 'info' : status;
  const config = statusConfig[mappedStatus] || statusConfig.idle;
  const sizes = sizeConfig[size];

  // Simple status labels
  const statusLabels = {
    active: 'Active',
    warning: 'Warning',
    error: 'Error',
    idle: 'Idle',
    connecting: 'Connecting',
  };

  const displayLabel = label || statusLabels[status];

  return (
    <div className="flex items-center space-x-3">
      {/* Status Indicator - Simple, Static Design */}
      <div
        className={`
          relative inline-flex items-center justify-center
          ${sizes.wrapper}
          ${interactive ? 'cursor-pointer' : ''}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={interactive ? onStatusClick : undefined}
      >
        {/* Subtle background glow - static, no animation */}
        <div
          className={`
            absolute inset-0 rounded-full
            ${config.bgColor}
            ${config.borderColor}
            border-0.5
            transition-all duration-300
            ${isHovered && interactive ? 'scale-110 opacity-80' : 'opacity-60'}
          `}
        />
        
        {/* Main status dot */}
        <motion.div
          className={`
            relative z-10 rounded-full
            ${sizes.indicator}
            ${config.color}
            ${config.glowColor}
            transition-all duration-300
          `}
          whileHover={interactive ? { scale: 1.1 } : undefined}
          whileTap={interactive ? { scale: 0.95 } : undefined}
        >
          {/* Subtle inner highlight - static */}
          <div
            className="
              absolute inset-0.5 rounded-full
              bg-gradient-to-tr from-white/30 to-transparent
              opacity-40
            "
          />
          
          {/* Connecting state indicator */}
          {status === 'connecting' && (
            <div className="absolute inset-0 rounded-full border border-blue-300/40">
              <motion.div
                className="absolute -top-0.5 -left-0.5 w-1 h-1 bg-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            </div>
          )}
        </motion.div>

        {/* Hover effect for interactive indicators */}
        {interactive && isHovered && (
          <motion.div
            className="absolute inset-0 rounded-full border border-white/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.6 }}
            exit={{ scale: 0.8, opacity: 0 }}
          />
        )}
      </div>

      {/* Status Label - Clean Typography */}
      {showLabel && displayLabel && (
        <motion.div
          className="flex flex-col justify-center"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: isHovered ? 1 : 0.8 }}
          transition={{ duration: 200 }}
        >
          <span className={`text-sm font-medium ${config.textColor} transition-colors duration-300`}>
            {displayLabel}
          </span>
        </motion.div>
      )}
    </div>
  );
};