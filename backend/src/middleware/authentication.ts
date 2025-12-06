import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { SESSION_COOKIE_NAME } from '../config/session';
import { validateSession, SessionUser } from '../services/sessionService';

// Extend Express Request to include user info and session ID
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

/**
 * Middleware to authenticate requests using session cookies
 * Extracts session ID from cookie and validates against database
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId) {
      logger.warn('Authentication failed: No session cookie');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await validateSession(sessionId);

    if (!user) {
      logger.warn('Authentication failed: Invalid or expired session');
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Attach user info and session ID to request
    req.user = user;
    req.sessionId = sessionId;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication - doesn't fail if no session cookie provided
 * Useful for endpoints that work both authenticated and unauthenticated
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId) {
      return next();
    }

    const user = await validateSession(sessionId);

    if (user) {
      req.user = user;
      req.sessionId = sessionId;
    }

    next();
  } catch (error) {
    // Silently fail and continue without authentication
    next();
  }
};
