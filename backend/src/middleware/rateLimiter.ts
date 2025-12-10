import rateLimit, { Store } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { logger } from './logger';
import { getRedisClient, isRedisConnected } from '../services/redisService';

/**
 * Rate Limiting Configuration
 * Different limits for different endpoint types to balance security and usability
 * More permissive in development/test environments for E2E testing
 *
 * DISABLE_RATE_LIMITING=true can be set for E2E tests to bypass rate limits entirely
 *
 * If Redis is available, uses RedisStore for distributed rate limiting across instances.
 * Falls back to in-memory store for single-instance deployments.
 */

const isProduction = process.env.NODE_ENV === 'production';
const disableRateLimitingEnv = process.env.DISABLE_RATE_LIMITING === 'true';

// Only allow disabling rate limiting in non-production environments
const disableRateLimiting = disableRateLimitingEnv && !isProduction;

// Log a warning if someone tries to disable rate limiting in production
if (disableRateLimitingEnv && isProduction) {
  logger.warn(
    'SECURITY: DISABLE_RATE_LIMITING is set but ignored in production environment. ' +
    'Rate limiting remains active to protect against brute force attacks.'
  );
}

/**
 * Create a rate limit store - uses Redis if available, otherwise in-memory
 */
function createStore(prefix: string): Store | undefined {
  const redisClient = getRedisClient();

  if (redisClient && isRedisConnected()) {
    logger.info(`Rate limiter "${prefix}" using Redis store`);
    return new RedisStore({
      // Use sendCommand for redis v4 compatibility
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: `rl:${prefix}:`,
    });
  }

  // Return undefined to use default MemoryStore
  return undefined;
}

// Track whether we've logged the store type
let storeTypeLogged = false;

/**
 * Log which store type is being used (once at startup)
 */
function logStoreType(): void {
  if (storeTypeLogged) return;
  storeTypeLogged = true;

  if (isRedisConnected()) {
    logger.info('Rate limiting: Using Redis store for distributed rate limiting');
  } else {
    logger.info('Rate limiting: Using in-memory store (single instance only)');
  }
}

/**
 * Get max requests based on environment
 * Uses very high limit when DISABLE_RATE_LIMITING is set for E2E tests (non-production only)
 */
function getMaxRequests(productionLimit: number, devLimit: number): number {
  if (disableRateLimiting) return 100000; // Effectively unlimited for tests (never in production)
  return isProduction ? productionLimit : devLimit;
}

/**
 * Strict rate limiter for authentication endpoints
 * Protects against brute force attacks
 * More lenient in development for E2E testing
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getMaxRequests(30, 100), // 30 attempts in production, 100 in development
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
  handler: (req, res, next, options) => {
    logStoreType();
    logger.warn(`Rate limit exceeded for auth endpoint`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json(options.message);
  },
});

/**
 * SSO rate limiter - slightly more lenient since SSO involves redirects
 */
export const ssoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getMaxRequests(20, 100), // 20 attempts in production, 100 in development
  message: {
    error: 'Too many SSO requests. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('sso'),
  handler: (req, res, next, options) => {
    logStoreType();
    logger.warn(`Rate limit exceeded for SSO endpoint`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json(options.message);
  },
});

/**
 * General API rate limiter
 * More permissive for regular API operations
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getMaxRequests(1000, 5000), // 1000 requests in production, 5000 in development
  message: {
    error: 'Too many requests from this IP. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('api'),
});

/**
 * Sensitive operations rate limiter
 * For operations like password changes, user deletion, etc.
 */
export const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getMaxRequests(30, 300), // 30 sensitive operations per hour in production, 300 in dev
  message: {
    error: 'Too many sensitive operations. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('sensitive'),
  handler: (req, res, next, options) => {
    logStoreType();
    logger.warn(`Rate limit exceeded for sensitive operation`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
    });
    res.status(429).json(options.message);
  },
});
