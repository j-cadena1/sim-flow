import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { SESSION_COOKIE_NAME } from '../config/session';
import { validateSession, SessionUser } from '../services/sessionService';
import { logSecurityEvent, AuditAction, getIpFromRequest, getUserAgentFromRequest } from '../services/auditService';

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
      // Log security event for missing session
      logSecurityEvent(
        AuditAction.AUTH_FAILURE,
        { reason: 'No session cookie', path: req.path, method: req.method },
        getIpFromRequest(req),
        getUserAgentFromRequest(req)
      ).catch(() => {}); // Non-blocking
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await validateSession(sessionId);

    if (!user) {
      logger.warn('Authentication failed: Invalid or expired session');
      // Log security event for invalid session
      logSecurityEvent(
        AuditAction.AUTH_FAILURE,
        { reason: 'Invalid or expired session', path: req.path, method: req.method },
        getIpFromRequest(req),
        getUserAgentFromRequest(req)
      ).catch(() => {}); // Non-blocking
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
 *
 * SECURITY: Fails closed on database/unexpected errors to prevent
 * accidental unauthenticated access during outages
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId) {
      // No session cookie is expected for unauthenticated users - continue
      return next();
    }

    const user = await validateSession(sessionId);

    if (user) {
      req.user = user;
      req.sessionId = sessionId;
    }
    // If user is null, session was invalid/expired - continue without auth
    // This is expected behavior, not an error

    next();
  } catch (error) {
    // Database or unexpected errors should fail closed, not allow unauthenticated access
    logger.error('Optional authentication error (failing closed):', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
};
