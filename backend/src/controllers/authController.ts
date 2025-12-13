/**
 * @fileoverview Authentication Controller
 *
 * Handles user authentication including local login, SSO via Microsoft Entra ID,
 * session management, and logout operations.
 *
 * Authentication Methods:
 * 1. Local: Email/password with bcrypt hashing
 * 2. SSO: Microsoft Entra ID with PKCE flow
 *
 * Session Management:
 * - Sessions stored in database with user agent and IP tracking
 * - HTTP-only cookies for session tokens
 * - Support for multi-device session management
 * - Session revocation (single, all, or other devices)
 *
 * @module controllers/authController
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { getFrontendUrl } from '../utils/envConfig';
import {
  isSSOEnabled,
  getSSOConfig,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  extractUserInfo,
} from '../services/msalService';
import { getUserPhoto } from '../services/graphService';
import { logAudit, AuditAction, EntityType, getIpFromRequest, getUserAgentFromRequest } from '../services/auditService';
import {
  ValidationError,
  AuthenticationError,
  ErrorCode,
} from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';
import { SESSION_COOKIE_NAME, COOKIE_OPTIONS } from '../config/session';
import {
  generateSessionId,
  storeSession,
  revokeSession,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  getUserSessions,
  revokeSessionById as revokeSessionByDbId,
  validateSession,
} from '../services/sessionService';
import {
  checkLockoutStatus,
  recordLoginAttempt,
  clearFailedAttempts,
} from '../services/loginAttemptService';
import { isQAdminDisabled } from '../services/systemSettingsService';

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  avatarUrl: string;
}

/**
 * Set session cookie on response
 */
function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE_NAME, sessionId, COOKIE_OPTIONS);
}

/**
 * Clear session cookie from response
 */
function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * Authenticate user with email and password
 *
 * Creates a new session and sets HTTP-only session cookie.
 * Uses constant-time password comparison via bcrypt.
 *
 * Security Features:
 * - Account lockout after 5 failed attempts (15 minute lockout)
 * - Login attempt tracking for audit purposes
 * - Constant-time password comparison (bcrypt)
 * - Generic error messages to prevent user enumeration
 *
 * @param req.body.email - User email address
 * @param req.body.password - User password
 * @returns user - User info (id, name, email, role, avatarUrl)
 * @throws ValidationError if credentials are missing
 * @throws AuthenticationError if credentials are invalid or account is locked
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ipAddress = getIpFromRequest(req);

  // Validation
  if (!email || !password) {
    throw new ValidationError('Email and password are required', {
      fields: { email: !email, password: !password },
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if account is locked due to too many failed attempts
  const lockoutStatus = await checkLockoutStatus(normalizedEmail);
  if (lockoutStatus.isLocked) {
    const minutesRemaining = lockoutStatus.lockoutExpiresAt
      ? Math.ceil((lockoutStatus.lockoutExpiresAt.getTime() - Date.now()) / 60000)
      : 15;
    logger.warn(`Login blocked - account locked: ${normalizedEmail}`);
    throw new AuthenticationError(
      `Account temporarily locked due to too many failed attempts. Try again in ${minutesRemaining} minutes.`,
      ErrorCode.AUTH_INVALID_CREDENTIALS
    );
  }

  // Find user by email (exclude soft-deleted users)
  const result = await query(
    'SELECT id, name, email, password_hash, role, avatar_url, deleted_at FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    // Record failed attempt before throwing error
    await recordLoginAttempt(normalizedEmail, ipAddress, false);
    // Generic error message to prevent user enumeration
    logger.warn(`Failed login attempt for email: ${email}`);
    throw new AuthenticationError('Invalid email or password', ErrorCode.AUTH_INVALID_CREDENTIALS);
  }

  const user = toCamelCase<User & { deletedAt: string | null }>(result.rows[0]);

  // Check if user is deactivated
  if (user.deletedAt) {
    await recordLoginAttempt(normalizedEmail, ipAddress, false);
    logger.warn(`Login attempt for deactivated user: ${user.id} (${email})`);
    throw new AuthenticationError('This account has been deactivated. Please contact an administrator.', ErrorCode.AUTH_INVALID_CREDENTIALS);
  }

  // Check if qAdmin account is disabled
  if (normalizedEmail === 'qadmin@sim-rq.local') {
    const qAdminDisabled = await isQAdminDisabled();
    if (qAdminDisabled) {
      await recordLoginAttempt(normalizedEmail, ipAddress, false);
      logger.warn(`Login attempt for disabled qAdmin account`);
      throw new AuthenticationError(
        'Local admin account has been disabled. Please authenticate using Microsoft Entra ID SSO.',
        ErrorCode.AUTH_INVALID_CREDENTIALS
      );
    }
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    await recordLoginAttempt(normalizedEmail, ipAddress, false);
    logger.warn(`Failed login attempt for user: ${user.id} (${email})`);
    throw new AuthenticationError('Invalid email or password', ErrorCode.AUTH_INVALID_CREDENTIALS);
  }

  // Successful login - record attempt and clear any failed attempts
  await recordLoginAttempt(normalizedEmail, ipAddress, true);
  await clearFailedAttempts(normalizedEmail);

  // Generate and store session
  const sessionId = generateSessionId();
  await storeSession(
    user.id,
    sessionId,
    getUserAgentFromRequest(req),
    ipAddress
  );

  // Set session cookie
  setSessionCookie(res, sessionId);

  // Return user info (no tokens in response body)
  const userResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };

  logger.info(`User logged in: ${user.id} (${email}) - Role: ${user.role}`);

  // Log audit trail
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    action: AuditAction.LOGIN,
    entityType: EntityType.AUTH,
    ipAddress,
    userAgent: getUserAgentFromRequest(req),
    details: { role: user.role },
  });

  res.json({ user: userResponse });
});

/**
 * Verify session and return user info
 * Used by frontend to check if session is still valid on page load
 */
export const verifySession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    throw new AuthenticationError('No session', ErrorCode.AUTH_REQUIRED);
  }

  const user = await validateSession(sessionId);

  if (!user) {
    clearSessionCookie(res);
    throw new AuthenticationError('Invalid session', ErrorCode.AUTH_INVALID_TOKEN);
  }

  // Fetch full user data including avatar
  const result = await query(
    'SELECT id, name, email, role, avatar_url FROM users WHERE id = $1',
    [user.id]
  );

  if (result.rows.length === 0) {
    clearSessionCookie(res);
    throw new AuthenticationError('User not found', ErrorCode.AUTH_INVALID_TOKEN);
  }

  const fullUser = toCamelCase(result.rows[0]);

  res.json({ user: fullUser, valid: true });
});

/**
 * Logout - revoke session and clear cookie
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (sessionId) {
    await revokeSession(sessionId, 'logout');
    logger.info('User logged out, session revoked');
  }

  // Clear the cookie
  clearSessionCookie(res);

  // Log audit trail if user is authenticated
  if (req.user) {
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name,
      action: AuditAction.LOGOUT,
      entityType: EntityType.AUTH,
      ipAddress: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
    });
  }

  res.json({ success: true });
});

/**
 * Logout from all devices - revoke all sessions
 */
export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required', ErrorCode.AUTH_REQUIRED);
  }

  const revokedCount = await revokeAllUserSessions(req.user.id, 'logout_all');

  // Clear the current cookie
  clearSessionCookie(res);

  await logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    userName: req.user.name,
    action: AuditAction.LOGOUT,
    entityType: EntityType.AUTH,
    ipAddress: getIpFromRequest(req),
    userAgent: getUserAgentFromRequest(req),
    details: { allDevices: true, revokedCount },
  });

  logger.info(`User ${req.user.id} logged out from all devices (${revokedCount} sessions)`);

  res.json({ success: true, revokedCount });
});

/**
 * Logout from all other devices - revoke other sessions, keep current
 */
export const logoutOthers = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.sessionId) {
    throw new AuthenticationError('Authentication required', ErrorCode.AUTH_REQUIRED);
  }

  const revokedCount = await revokeOtherUserSessions(req.user.id, req.sessionId, 'logout_others');

  await logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    userName: req.user.name,
    action: AuditAction.LOGOUT,
    entityType: EntityType.AUTH,
    ipAddress: getIpFromRequest(req),
    userAgent: getUserAgentFromRequest(req),
    details: { otherDevices: true, revokedCount },
  });

  logger.info(`User ${req.user.id} logged out from other devices (${revokedCount} sessions)`);

  res.json({ success: true, revokedCount });
});

/**
 * Get active sessions for current user
 */
export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required', ErrorCode.AUTH_REQUIRED);
  }

  const sessions = await getUserSessions(req.user.id);

  res.json({ sessions });
});

/**
 * Revoke a specific session by ID
 */
export const revokeSessionById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required', ErrorCode.AUTH_REQUIRED);
  }

  const { sessionId } = req.params;

  const revoked = await revokeSessionByDbId(sessionId, req.user.id);

  if (!revoked) {
    throw new ValidationError('Session not found or already revoked');
  }

  logger.info(`User ${req.user.id} revoked session ${sessionId}`);

  res.json({ success: true });
});

/**
 * Check if SSO is enabled
 * Public endpoint - used by login page to show/hide SSO button
 * Also returns the configuration source so UI can hide config when using env vars
 */
export const getSSOStatus = async (req: Request, res: Response) => {
  try {
    const config = await getSSOConfig();
    const enabled = !!(config && config.enabled && config.tenantId && config.clientId && config.clientSecret);

    res.json({
      enabled,
      // Only include source if SSO is configured - helps UI decide whether to show config tab
      source: config?.source || null,
    });
  } catch (error) {
    logger.error('Error checking SSO status:', error);
    res.status(500).json({ error: 'Failed to check SSO status' });
  }
};

/**
 * Initiate SSO login
 * Returns the Entra ID authorization URL
 */
export const initiateSSO = async (req: Request, res: Response) => {
  try {
    const enabled = await isSSOEnabled();

    if (!enabled) {
      return res.status(400).json({ error: 'SSO is not enabled' });
    }

    const authUrl = await getAuthorizationUrl();

    if (!authUrl) {
      return res.status(500).json({ error: 'Failed to generate authorization URL' });
    }

    logger.info('SSO login initiated');
    res.json({ authUrl });
  } catch (error) {
    logger.error('Error initiating SSO:', error);
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
};

/**
 * Handle SSO callback
 * Exchanges authorization code for tokens and creates/updates user
 * Supports both GET (OAuth redirect) and POST (frontend submission)
 */
export const handleSSOCallback = async (req: Request, res: Response) => {
  try {
    // Support both GET (query params from OAuth redirect) and POST (body from frontend)
    const code = (req.query.code as string) || req.body.code;
    const state = (req.query.state as string) || req.body.state;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'State parameter is required' });
    }

    // Exchange code for tokens using PKCE
    const tokenResponse = await exchangeCodeForTokens(code, state);

    // Extract user info from ID token
    const userInfo = extractUserInfo(tokenResponse);

    if (!userInfo) {
      return res.status(400).json({ error: 'Failed to extract user information from token' });
    }

    // Try to fetch user's profile photo from Entra ID
    const photoUrl = await getUserPhoto(userInfo.email);
    const avatarUrl = photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userInfo.name}`;

    // Find or create user
    let userResult = await query(
      'SELECT id, name, email, role, avatar_url, deleted_at FROM users WHERE email = $1',
      [userInfo.email.toLowerCase()]
    );

    let user: User;

    if (userResult.rows.length === 0) {
      // Create new user from SSO
      // Default role for new SSO users is End-User
      const insertResult = await query(
        `INSERT INTO users (name, email, password_hash, role, avatar_url, auth_source, entra_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, role, avatar_url`,
        [
          userInfo.name,
          userInfo.email.toLowerCase(),
          null, // No password for SSO users
          'End-User',
          avatarUrl,
          'entra_id',
          userInfo.oid,
        ]
      );

      user = toCamelCase<User>(insertResult.rows[0]);
      logger.info(`Created new user from SSO: ${user.email}`);
    } else {
      // Check if user is deactivated
      if (userResult.rows[0].deleted_at) {
        logger.warn(`SSO login attempt for deactivated user: ${userInfo.email}`);
        return res.status(403).json({
          error: 'This account has been deactivated. Please contact an administrator.',
        });
      }

      // Update existing user's name and avatar if changed
      await query(
        'UPDATE users SET name = $1, avatar_url = $2, auth_source = $3, entra_id = $4 WHERE email = $5',
        [userInfo.name, avatarUrl, 'entra_id', userInfo.oid, userInfo.email.toLowerCase()]
      );

      // Fetch updated user
      userResult = await query(
        'SELECT id, name, email, role, avatar_url FROM users WHERE email = $1',
        [userInfo.email.toLowerCase()]
      );

      user = toCamelCase<User>(userResult.rows[0]);
      logger.info(`Existing user logged in via SSO: ${user.email}`);
    }

    // Generate and store session
    const sessionId = generateSessionId();
    await storeSession(
      user.id,
      sessionId,
      getUserAgentFromRequest(req),
      getIpFromRequest(req)
    );

    // Set session cookie
    setSessionCookie(res, sessionId);

    // Log audit trail for SSO login
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: AuditAction.SSO_LOGIN,
      entityType: EntityType.AUTH,
      ipAddress: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
      details: { role: user.role, entraId: userInfo.oid },
    });

    // Redirect to frontend - the session cookie is already set
    // The frontend will detect the session and load the user
    const frontendUrl = getFrontendUrl();
    res.redirect(frontendUrl);
  } catch (error) {
    logger.error('Error handling SSO callback:', error);
    // Redirect to frontend with error
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/#/login?error=sso_failed`);
  }
};
