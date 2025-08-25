import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: RedisClientType | null = null;

export const initializeRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: Connection established successfully');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis: Reconnecting...');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    // Don't throw - Redis is optional for basic functionality
    logger.warn('Continuing without Redis cache');
  }
};

export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!redisClient) return;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setEx(key, ttlSeconds, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  },

  async delete(key: string): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  },

  async exists(key: string): Promise<boolean> {
    if (!redisClient) return false;
    
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  async flush(): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.flushDb();
      logger.info('Redis cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  },

  // Helper for caching function results
  async remember<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await callback();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};

// Rate limiting helper
export const rateLimiter = {
  async checkLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (!redisClient) {
      return { allowed: true, remaining: maxRequests, resetAt: 0 };
    }

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const redisKey = `rate_limit:${key}`;

    try {
      // Remove old entries
      await redisClient.zRemRangeByScore(redisKey, '-inf', windowStart);
      
      // Count current entries
      const count = await redisClient.zCard(redisKey);
      
      if (count < maxRequests) {
        // Add current request
        await redisClient.zAdd(redisKey, { score: now, value: `${now}` });
        await redisClient.expire(redisKey, windowSeconds);
        
        return {
          allowed: true,
          remaining: maxRequests - count - 1,
          resetAt: now + windowSeconds * 1000,
        };
      }
      
      // Get oldest entry to calculate reset time
      const oldest = await redisClient.zRange(redisKey, 0, 0);
      const resetAt = oldest.length > 0 
        ? parseInt(oldest[0]) + windowSeconds * 1000
        : now + windowSeconds * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Fail open - allow request if Redis fails
      return { allowed: true, remaining: maxRequests, resetAt: 0 };
    }
  },
};