import rateLimit from 'express-rate-limit';
import { logger } from './logger';

/**
 * Rate Limiting Configuration
 * Different limits for different endpoint types to balance security and usability
 * More permissive in development/test environments for E2E testing
 *
 * DISABLE_RATE_LIMITING=true can be set for E2E tests to bypass rate limits entirely
 */

const isProduction = process.env.NODE_ENV === 'production';
const disableRateLimiting = process.env.DISABLE_RATE_LIMITING === 'true';

/**
 * Get max requests based on environment
 * Uses very high limit when DISABLE_RATE_LIMITING is set for E2E tests
 */
function getMaxRequests(productionLimit: number, devLimit: number): number {
  if (disableRateLimiting) return 100000; // Effectively unlimited for tests
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
  handler: (req, res, next, options) => {
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
  handler: (req, res, next, options) => {
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
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for sensitive operation`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
    });
    res.status(429).json(options.message);
  },
});
