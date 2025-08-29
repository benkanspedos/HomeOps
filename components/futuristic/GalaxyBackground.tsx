'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: 'small' | 'medium' | 'large';
  opacity: number;
  animationDelay: number;
  animationDuration: number;
}

interface GalaxyBackgroundProps {
  density?: 'minimal' | 'low' | 'medium';
  animated?: boolean;
}

export const GalaxyBackground: React.FC<GalaxyBackgroundProps> = ({
  density = 'low',
  animated = true,
}) => {
  const [stars, setStars] = useState<Star[]>([]);

  // Star counts based on density
  const starCounts = {
    minimal: 15,
    low: 25,
    medium: 40,
  };

  useEffect(() => {
    const generateStars = (): Star[] => {
      const starCount = starCounts[density];
      const generatedStars: Star[] = [];

      for (let i = 0; i < starCount; i++) {
        // Distribute stars more naturally (avoid perfect grid)
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        // Weight towards smaller stars for realism
        const sizeRandom = Math.random();
        let size: 'small' | 'medium' | 'large';
        if (sizeRandom < 0.7) size = 'small';
        else if (sizeRandom < 0.9) size = 'medium';
        else size = 'large';

        generatedStars.push({
          id: i,
          x,
          y,
          size,
          opacity: 0.2 + Math.random() * 0.6, // 0.2 to 0.8
          animationDelay: Math.random() * 10, // 0 to 10 seconds
          animationDuration: 15 + Math.random() * 20, // 15 to 35 seconds
        });
      }

      return generatedStars;
    };

    setStars(generateStars());
  }, [density]);

  // Star size configurations
  const starSizeConfig = {
    small: {
      width: '1px',
      height: '1px',
      glow: '0 0 2px rgba(229, 229, 229, 0.3)',
    },
    medium: {
      width: '2px',
      height: '2px',
      glow: '0 0 4px rgba(229, 229, 229, 0.4)',
    },
    large: {
      width: '3px',
      height: '3px',
      glow: '0 0 6px rgba(147, 197, 253, 0.3)',
    },
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950" />
      
      {/* Subtle nebula effect - very faint */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-950/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-indigo-950/10 rounded-full blur-3xl" />
      </div>

      {/* Stars */}
      <div className="absolute inset-0">
        {stars.map((star) => {
          const config = starSizeConfig[star.size];
          
          return (
            <motion.div
              key={star.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: config.width,
                height: config.height,
                backgroundColor: star.size === 'large' ? '#93c5fd' : '#e5e5e5',
                boxShadow: config.glow,
                opacity: star.opacity,
              }}
              animate={
                animated
                  ? {
                      opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
                      scale: [0.8, 1, 0.8],
                    }
                  : undefined
              }
              transition={
                animated
                  ? {
                      duration: star.animationDuration,
                      delay: star.animationDelay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Subtle scan line effect - very minimal */}
      {animated && (
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent"
          animate={{
            top: ['0%', '100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Very subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(136, 136, 136, 0.1) 0.5px, transparent 0.5px),
              linear-gradient(90deg, rgba(136, 136, 136, 0.1) 0.5px, transparent 0.5px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>
    </div>
  );
};