import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import {
  isSSOEnabled,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  extractUserInfo,
} from '../services/msalService';
import { getUserPhoto } from '../services/graphService';

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'sim-flow-secret-key-change-in-production';
const JWT_EXPIRATION = '24h';

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  avatarUrl: string;
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await query(
      'SELECT id, name, email, password_hash, role, avatar_url FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      // Generic error message to prevent user enumeration
      logger.warn(`Failed login attempt for email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = toCamelCase<User>(result.rows[0]);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for user: ${user.id} (${email})`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Return user info and token (exclude password hash)
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    logger.info(`User logged in: ${user.id} (${email}) - Role: ${user.role}`);

    res.json({
      user: userResponse,
      token,
    });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const verifyToken = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      name: string;
    };

    // Optionally verify user still exists in database
    const result = await query(
      'SELECT id, name, email, role, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = toCamelCase(result.rows[0]);

    res.json({ user, valid: true });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token', valid: false });
    }
    logger.error('Error verifying token:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
};

/**
 * Check if SSO is enabled
 * Public endpoint - used by login page to show/hide SSO button
 */
export const getSSOStatus = async (req: Request, res: Response) => {
  try {
    const enabled = await isSSOEnabled();
    res.json({ enabled });
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
 */
export const handleSSOCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

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
      'SELECT id, name, email, role, avatar_url FROM users WHERE email = $1',
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
          '', // No password for SSO users
          'End-User',
          avatarUrl,
          'entra_id',
          userInfo.oid,
        ]
      );

      user = toCamelCase<User>(insertResult.rows[0]);
      logger.info(`Created new user from SSO: ${user.email}`);
    } else {
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

    // Generate JWT token (exclude password hash from response)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Return user info and token (create response without password hash)
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    res.json({
      user: userResponse,
      token,
      method: 'sso',
    });
  } catch (error) {
    logger.error('Error handling SSO callback:', error);
    res.status(500).json({ error: 'SSO login failed' });
  }
};
