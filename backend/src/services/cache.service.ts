import Redis from 'ioredis';
import { Logger } from '../utils/logger';

export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private isConnected: boolean = false;
  private readonly defaultTTL: number = 300; // 5 minutes default

  constructor() {
    this.logger = new Logger('CacheService');
    
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6380');
    const redisPassword = process.env.REDIS_PASSWORD || '';
    
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.info(`Connected to Redis at ${redisHost}:${redisPort}`);
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      this.logger.error('Redis connection error', error);
    });
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache set');
      return false;
    }

    try {
      const ttl = ttlSeconds || this.defaultTTL;
      const serialized = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      this.logger.debug(`Cached key: ${key} with TTL: ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set cache for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const value = await this.redis.get(key);
      
      if (!value) {
        return null;
      }
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache delete');
      return false;
    }

    try {
      await this.redis.del(key);
      this.logger.debug(`Deleted cache key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache delete pattern');
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
      
      this.logger.debug(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to delete cache pattern: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key: ${key}`, error);
      return false;
    }
  }

  /**
   * Set TTL for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to set TTL for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async flush(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.flushdb();
      this.logger.warn('Flushed all cache');
      return true;
    } catch (error) {
      this.logger.error('Failed to flush cache', error);
      return false;
    }
  }

  /**
   * DNS-specific cache methods
   */

  /**
   * Cache DNS status with specific TTL
   */
  async cacheDNSStatus(status: any): Promise<boolean> {
    const ttl = parseInt(process.env.DNS_CACHE_TTL || '30');
    return this.set('dns:status', status, ttl);
  }

  /**
   * Get cached DNS status
   */
  async getCachedDNSStatus(): Promise<any | null> {
    return this.get('dns:status');
  }

  /**
   * Cache domain list with 5 minute TTL
   */
  async cacheDomainList(listType: string, domains: any[]): Promise<boolean> {
    return this.set(`dns:domains:${listType}`, domains, 300);
  }

  /**
   * Get cached domain list
   */
  async getCachedDomainList(listType: string): Promise<any[] | null> {
    return this.get(`dns:domains:${listType}`);
  }

  /**
   * Invalidate all DNS-related cache
   */
  async invalidateDNSCache(): Promise<void> {
    await this.deletePattern('dns:*');
  }

  /**
   * Cache with tags for grouped invalidation
   */
  async setWithTag(key: string, value: any, tag: string, ttlSeconds?: number): Promise<boolean> {
    const success = await this.set(key, value, ttlSeconds);
    
    if (success) {
      // Add key to tag set
      await this.redis.sadd(`tag:${tag}`, key);
      // Set expiry on tag set
      await this.redis.expire(`tag:${tag}`, ttlSeconds || this.defaultTTL);
    }
    
    return success;
  }

  /**
   * Delete all keys with a specific tag
   */
  async deleteByTag(tag: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      pipeline.del(`tag:${tag}`);
      await pipeline.exec();
      
      this.logger.debug(`Deleted ${keys.length} cache keys with tag: ${tag}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to delete keys by tag: ${tag}`, error);
      return 0;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<any> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.redis.info();
      return info;
    } catch (error) {
      this.logger.error('Failed to get Redis info', error);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.isConnected = false;
    this.logger.info('Disconnected from Redis');
  }
}