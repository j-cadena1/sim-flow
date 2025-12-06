import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { authenticate } from './authentication';

export type UserRole = 'Admin' | 'Manager' | 'Engineer' | 'End-User';

// Only the local qAdmin account can configure SSO
const QADMIN_EMAIL = 'qadmin@simflow.local';

/**
 * Middleware to require specific user roles for accessing endpoints
 * @param allowedRoles - Array of roles that are allowed to access the endpoint
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return [
    authenticate,
    (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;

      // Check if user is authenticated (should be guaranteed by authenticate middleware)
      if (!user) {
        logger.warn('Unauthorized access attempt - missing user');
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user has required role
      if (!allowedRoles.includes(user.role as UserRole)) {
        logger.warn(`Forbidden access attempt by ${user.role} (${user.userId}) - requires ${allowedRoles.join(', ')}`);
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: user.role
        });
      }

      next();
    }
  ];
};

/**
 * Middleware to check if user owns the resource or has admin/manager privileges
 * Used for endpoints like "update my own request" or "view my own data"
 */
export const requireOwnershipOrRole = (ownershipCheck: (req: Request) => Promise<string | null>, allowedRoles: UserRole[]) => {
  return [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admins and specified roles can always proceed
      if (allowedRoles.includes(user.role as UserRole)) {
        return next();
      }

      // Check ownership
      try {
        const ownerId = await ownershipCheck(req);

        if (ownerId === user.userId) {
          return next();
        }

        logger.warn(`Forbidden access attempt by ${user.userId} - not resource owner`);
        return res.status(403).json({ error: 'You can only access your own resources' });
      } catch (error) {
        logger.error('Ownership check failed:', error);
        return res.status(500).json({ error: 'Authorization check failed' });
      }
    }
  ];
};

/**
 * Middleware to require the local qAdmin account
 * Used for SSO configuration which should only be managed by qAdmin
 */
export const requireQAdmin = () => {
  return [
    authenticate,
    (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;

      if (!user) {
        logger.warn('Unauthorized access attempt - missing user');
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (user.email !== QADMIN_EMAIL) {
        logger.warn(`SSO config access denied for ${user.email} - only qAdmin can configure SSO`);
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only the local qAdmin account can configure SSO settings'
        });
      }

      next();
    }
  ];
};
