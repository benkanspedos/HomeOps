'use client';

import { motion } from 'framer-motion';
import { ReactNode, useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface MinimalisticCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: LucideIcon;
  variant?: 'default' | 'primary' | 'accent';
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

export const MinimalisticCard: React.FC<MinimalisticCardProps> = ({
  title,
  subtitle,
  children,
  icon: Icon,
  variant = 'default',
  interactive = false,
  className = '',
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Variant configurations - cool palette only
  const variantConfig = {
    default: {
      background: 'bg-gray-900/40',
      border: 'border-gray-600/15',
      titleColor: 'text-gray-300',
      subtitleColor: 'text-gray-500',
      iconColor: 'text-gray-400',
      hoverBorder: 'hover:border-gray-400/25',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]',
    },
    primary: {
      background: 'bg-slate-900/40',
      border: 'border-blue-500/15',
      titleColor: 'text-blue-200',
      subtitleColor: 'text-blue-300/60',
      iconColor: 'text-blue-400',
      hoverBorder: 'hover:border-blue-400/30',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]',
    },
    accent: {
      background: 'bg-slate-900/40',
      border: 'border-silver-500/15',
      titleColor: 'text-silver-200',
      subtitleColor: 'text-silver-300/60',
      iconColor: 'text-silver-400',
      hoverBorder: 'hover:border-silver-400/30',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(192,192,192,0.1)]',
    },
  };

  const config = variantConfig[variant];

  return (
    <motion.div
      className={`
        relative group
        ${config.background}
        backdrop-filter backdrop-blur-sm
        border-0.5 ${config.border}
        ${config.hoverBorder}
        ${config.hoverShadow}
        rounded-xl
        transition-all duration-300 ease-out
        ${interactive ? 'cursor-pointer' : ''}
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={interactive ? onClick : undefined}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-xl pointer-events-none" />
      
      {/* Header Section */}
      {(title || subtitle || Icon) && (
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {Icon && (
                <div className={`${config.iconColor} transition-colors duration-300`}>
                  <Icon size={20} strokeWidth={1.5} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <motion.h3
                  className={`
                    font-medium text-sm tracking-wide
                    ${config.titleColor}
                    transition-colors duration-300
                  `}
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: isHovered ? 1 : 0.9 }}
                >
                  {title}
                </motion.h3>
                {subtitle && (
                  <motion.p
                    className={`
                      text-xs mt-1 font-light
                      ${config.subtitleColor}
                      transition-colors duration-300
                    `}
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: isHovered ? 0.8 : 0.6 }}
                  >
                    {subtitle}
                  </motion.p>
                )}
              </div>
            </div>
          </div>
          
          {/* Subtle divider */}
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gray-600/20 to-transparent" />
        </div>
      )}

      {/* Content Section */}
      <div className="px-6 pb-6">
        {children}
      </div>

      {/* Interactive indicator */}
      {interactive && isHovered && (
        <motion.div
          className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* Corner accent - very subtle */}
      <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden rounded-tr-xl">
        <div className="absolute top-0 right-0 w-6 h-6 bg-gradient-to-br from-white/[0.03] to-transparent transform rotate-45 translate-x-3 -translate-y-3" />
      </div>
    </motion.div>
  );
};

// Specialized metric card for dashboard metrics
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'primary' | 'accent';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = 'neutral',
  variant = 'default',
  className = '',
}) => {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400',
  };

  const trendColor = trendColors[trend];

  return (
    <MinimalisticCard
      title={title}
      subtitle={subtitle}
      icon={Icon}
      variant={variant}
      className={className}
    >
      <div className="space-y-3">
        {/* Main value */}
        <motion.div
          className={`text-2xl font-light tracking-tight ${trendColor}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {value}
        </motion.div>
        
        {/* Additional content can be added here */}
      </div>
    </MinimalisticCard>
  );
};