'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface StatusOrbProps {
  status: 'active' | 'warning' | 'error' | 'idle' | 'connecting';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  showRipples?: boolean;
  pulseIntensity?: 'low' | 'medium' | 'high';
  interactive?: boolean;
  onStatusClick?: () => void;
}

// Whimsical status messages
const statusMessages = {
  active: ['All systems go!', 'Running like butter', 'Smooth operator', 'Living the dream'],
  warning: ['Houston, we have a problem', 'Yellow alert!', 'Caution advised', 'Proceed carefully'],
  error: ['Red alert! Red alert!', 'Something went boom', 'Error 404: Status not found', 'Oopsie daisy!'],
  idle: ['Just chillin\'', 'Taking a nap', 'Zen mode activated', 'Waiting patiently'],
  connecting: ['Dialing in...', 'Making friends', 'Establishing link', 'Saying hello'],
};

export const StatusOrb: React.FC<StatusOrbProps> = ({
  status,
  size = 'md',
  label,
  showRipples = true,
  pulseIntensity = 'medium',
  interactive = false,
  onStatusClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [funMessage, setFunMessage] = useState('');

  // Size configurations
  const sizeConfig = {
    sm: { orb: 'w-3 h-3', ripple: 'w-8 h-8' },
    md: { orb: 'w-4 h-4', ripple: 'w-12 h-12' },
    lg: { orb: 'w-6 h-6', ripple: 'w-16 h-16' },
    xl: { orb: 'w-8 h-8', ripple: 'w-20 h-20' },
  };

  // Status color configurations
  const statusConfig = {
    active: {
      color: 'bg-green-400',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.8)]',
      rippleColor: 'bg-green-400',
      textColor: 'text-green-400',
    },
    warning: {
      color: 'bg-yellow-400',
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.8)]',
      rippleColor: 'bg-yellow-400',
      textColor: 'text-yellow-400',
    },
    error: {
      color: 'bg-red-400',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.8)]',
      rippleColor: 'bg-red-400',
      textColor: 'text-red-400',
    },
    idle: {
      color: 'bg-gray-500',
      glow: 'shadow-[0_0_10px_rgba(107,114,128,0.5)]',
      rippleColor: 'bg-gray-500',
      textColor: 'text-gray-400',
    },
    connecting: {
      color: 'bg-cyan-400',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.8)]',
      rippleColor: 'bg-cyan-400',
      textColor: 'text-cyan-400',
    },
  };

  // Pulse animation variants
  const pulseVariants = {
    low: { scale: [1, 1.1, 1], duration: 3 },
    medium: { scale: [1, 1.2, 1], duration: 2 },
    high: { scale: [1, 1.4, 1], duration: 1.5 },
  };

  // Handle clicking for fun messages
  useEffect(() => {
    if (clickCount >= 3) {
      const messages = statusMessages[status];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setFunMessage(randomMessage);
      setTimeout(() => setFunMessage(''), 2000);
      setClickCount(0);
    }
  }, [clickCount, status]);

  const handleClick = () => {
    if (interactive) {
      setClickCount(c => c + 1);
      onStatusClick?.();
    }
  };

  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <div 
      className={`relative inline-flex items-center ${interactive ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Ripple effects */}
      {showRipples && (
        <div className={`absolute ${sizes.ripple} -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2`}>
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className={`absolute inset-0 rounded-full ${config.rippleColor} opacity-20`}
              animate={{
                scale: [0.5, 2],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Main orb */}
      <motion.div
        className={`
          relative z-10 rounded-full
          ${sizes.orb}
          ${config.color}
          ${config.glow}
          transition-all duration-300
        `}
        animate={pulseVariants[pulseIntensity]}
        transition={{
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        whileHover={interactive ? { scale: 1.2 } : {}}
        whileTap={interactive ? { scale: 0.9 } : {}}
      >
        {/* Inner shine effect */}
        <motion.div
          className="absolute inset-0 rounded-full bg-white opacity-30"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 60%)',
          }}
        />

        {/* Connecting animation for connecting status */}
        {status === 'connecting' && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-cyan-400"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div className="absolute top-0 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          </motion.div>
        )}
      </motion.div>

      {/* Label */}
      {label && (
        <motion.span
          className={`ml-3 text-sm font-mono ${config.textColor} transition-colors duration-300`}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: isHovered ? 1 : 0.7 }}
        >
          {label}
        </motion.span>
      )}

      {/* Fun message popup */}
      {funMessage && (
        <motion.div
          className="absolute top-[-50px] left-1/2 transform -translate-x-1/2 z-50"
          initial={{ opacity: 0, scale: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <div className={`
            px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap
            bg-gradient-to-r ${config.color} text-black
            shadow-lg
          `}>
            {funMessage}
            <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-current`} />
          </div>
        </motion.div>
      )}

      {/* Interaction indicator */}
      {interactive && isHovered && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white opacity-50"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0.3 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </div>
  );
};