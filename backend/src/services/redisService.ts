/**
 * Redis Service
 *
 * Provides optional Redis connectivity for multi-instance deployments.
 * Redis is used for:
 * - Distributed rate limiting (share counters across instances)
 * - WebSocket pub/sub (deliver notifications across instances)
 *
 * If REDIS_HOST is not set, the application falls back to in-memory solutions.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../middleware/logger';

let redisClient: RedisClientType | null = null;
let isConnected = false;
let connectionAttempted = false;

/**
 * Build Redis URL from environment variables
 */
function getRedisUrl(): string {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;
  return password
    ? `redis://:${password}@${host}:${port}`
    : `redis://${host}:${port}`;
}

/**
 * Check if Redis is configured via environment variables
 */
export function isRedisEnabled(): boolean {
  return !!process.env.REDIS_HOST;
}

/**
 * Check if Redis is currently connected
 */
export function isRedisConnected(): boolean {
  return isConnected;
}

/**
 * Get the Redis client instance
 * Returns null if Redis is not enabled or not connected
 */
export function getRedisClient(): RedisClientType | null {
  return isConnected ? redisClient : null;
}

/**
 * Initialize Redis connection
 * Only connects if REDIS_HOST environment variable is set
 * Handles connection errors gracefully - logs warning and continues without Redis
 */
export async function initializeRedis(): Promise<void> {
  if (connectionAttempted) {
    return; // Already attempted connection
  }
  connectionAttempted = true;

  if (!isRedisEnabled()) {
    logger.info('Redis not configured (REDIS_HOST not set) - using in-memory fallbacks');
    return;
  }

  const redisHost = process.env.REDIS_HOST;
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

  try {
    redisClient = createClient({
      url: getRedisUrl(),
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.warn('Redis reconnection failed after 5 attempts - continuing without Redis');
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        },
      },
    });

    redisClient.on('error', (err) => {
      if (isConnected) {
        logger.error('Redis connection error:', err);
        isConnected = false;
      }
    });

    redisClient.on('connect', () => {
      logger.info(`Redis connecting to ${redisHost}:${redisPort}`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('Redis connected and ready');
    });

    redisClient.on('end', () => {
      isConnected = false;
      logger.info('Redis connection closed');
    });

    await redisClient.connect();
  } catch (error) {
    logger.warn('Failed to connect to Redis - continuing with in-memory fallbacks:', error);
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Create a duplicate Redis client for pub/sub operations
 * Socket.IO Redis adapter requires separate pub and sub clients
 */
export function createPubSubClients(): {
  pubClient: RedisClientType;
  subClient: RedisClientType;
} | null {
  if (!redisClient || !isConnected) {
    return null;
  }

  const url = getRedisUrl();
  const pubClient = createClient({ url });
  const subClient = createClient({ url });

  return { pubClient: pubClient as RedisClientType, subClient: subClient as RedisClientType };
}

/**
 * Gracefully shutdown Redis connection
 */
export async function shutdownRedis(): Promise<void> {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
  redisClient = null;
  isConnected = false;
}

/**
 * Get Redis status for health checks
 */
export function getRedisStatus(): {
  enabled: boolean;
  connected: boolean;
  host?: string;
} {
  return {
    enabled: isRedisEnabled(),
    connected: isConnected,
    host: isRedisEnabled() ? process.env.REDIS_HOST : undefined,
  };
}
