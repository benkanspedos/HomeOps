'use client';

import { ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FuturisticCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'purple' | 'green' | 'pink' | 'yellow';
  interactive?: boolean;
  dataStream?: boolean;
  scanLine?: boolean;
  circuitPattern?: boolean;
  title?: string;
  subtitle?: string;
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  easterEgg?: boolean;
}

// Whimsical Easter Egg Messages
const easterEggMessages = [
  "SYSTEM OPTIMAL... OR IS IT?",
  "HELLO HUMAN, I SEE YOU",
  "CLICK ME AGAIN, I DARE YOU",
  "42 IS THE ANSWER",
  "HACK THE PLANET!",
  "YOU FOUND THE SECRET",
  "INITIATING DANCE MODE...",
  "ERROR 418: I'M A TEAPOT",
  "WELCOME TO THE MATRIX",
  "BEEP BOOP BEEP"
];

export const FuturisticCard: React.FC<FuturisticCardProps> = ({
  children,
  className = '',
  glowColor = 'cyan',
  interactive = true,
  dataStream = false,
  scanLine = false,
  circuitPattern = false,
  title,
  subtitle,
  corner = 'top-left',
  easterEgg = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [secretMessage, setSecretMessage] = useState('');
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number}>>([]);

  // Glow color mapping
  const glowColors = {
    cyan: 'shadow-[0_0_30px_rgba(0,255,255,0.5)]',
    purple: 'shadow-[0_0_30px_rgba(191,0,255,0.5)]',
    green: 'shadow-[0_0_30px_rgba(0,255,136,0.5)]',
    pink: 'shadow-[0_0_30px_rgba(255,0,170,0.5)]',
    yellow: 'shadow-[0_0_30px_rgba(255,234,0,0.5)]',
  };

  const borderColors = {
    cyan: 'border-cyan-500/20',
    purple: 'border-purple-500/20',
    green: 'border-green-500/20',
    pink: 'border-pink-500/20',
    yellow: 'border-yellow-500/20',
  };

  // Easter egg handling
  useEffect(() => {
    if (easterEgg && clicks >= 3) {
      const randomMessage = easterEggMessages[Math.floor(Math.random() * easterEggMessages.length)];
      setSecretMessage(randomMessage);
      setTimeout(() => setSecretMessage(''), 3000);
      setClicks(0);
      
      // Create particle explosion
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 1000);
    }
  }, [clicks, easterEgg]);

  const cornerDecorations = {
    'top-left': 'before:top-0 before:left-0 after:top-0 after:left-0',
    'top-right': 'before:top-0 before:right-0 after:top-0 after:right-0',
    'bottom-left': 'before:bottom-0 before:left-0 after:bottom-0 after:left-0',
    'bottom-right': 'before:bottom-0 before:right-0 after:bottom-0 after:right-0',
  };

  return (
    <motion.div
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/40
        backdrop-blur-xl
        border ${borderColors[glowColor]}
        rounded-xl
        transition-all duration-500
        ${interactive ? 'cursor-pointer' : ''}
        ${isHovered && interactive ? glowColors[glowColor] : ''}
        ${dataStream ? 'data-stream-bg' : ''}
        ${scanLine ? 'scan-line' : ''}
        ${circuitPattern ? 'circuit-pattern' : ''}
        ${className}
        
        before:content-[''] before:absolute
        before:w-8 before:h-8
        before:border-t-2 before:border-l-2
        before:border-${glowColor}-400
        before:transition-all before:duration-300
        ${cornerDecorations[corner]}
        
        after:content-[''] after:absolute
        after:w-8 after:h-8
        after:border-b-2 after:border-r-2
        after:border-${glowColor}-400
        after:transition-all after:duration-300
        after:translate-x-[calc(100%-2rem)]
        after:translate-y-[calc(100%-2rem)]
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => easterEgg && setClicks(c => c + 1)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={interactive ? { scale: 1.02 } : {}}
      whileTap={interactive ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Animated border gradient */}
      <div className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-[-2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-xl animate-pulse" />
        <div className="absolute inset-0 bg-slate-900 rounded-xl" />
      </div>

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Header */}
        {(title || subtitle) && (
          <div className="px-6 py-4 border-b border-white/10">
            {title && (
              <h3 className="text-lg font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-400 mt-1 font-mono">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Main content */}
        <div className="relative">
          {children}
        </div>

        {/* Easter Egg Message */}
        <AnimatePresence>
          {secretMessage && (
            <motion.div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <div className="bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold px-6 py-3 rounded-full text-sm font-mono whitespace-nowrap">
                {secretMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Particle Effects */}
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 bg-cyan-400 rounded-full"
              style={{
                left: '50%',
                top: '50%',
                boxShadow: '0 0 10px rgba(0, 255, 255, 0.8)',
              }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: particle.x * 3,
                y: particle.y * 3,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Holographic shimmer effect */}
      {isHovered && interactive && (
        <motion.div
          className="absolute inset-0 opacity-20 pointer-events-none"
          initial={{ backgroundPosition: '0% 0%' }}
          animate={{ backgroundPosition: '100% 100%' }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{
            background: 'linear-gradient(45deg, transparent 30%, rgba(0, 255, 255, 0.5) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
          }}
        />
      )}

      {/* Corner accent lights */}
      {isHovered && (
        <>
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-radial from-cyan-500/20 to-transparent -translate-x-16 -translate-y-16 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-radial from-purple-500/20 to-transparent translate-x-16 translate-y-16 pointer-events-none" />
        </>
      )}
    </motion.div>
  );
};