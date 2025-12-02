import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';

// Get all users
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { role } = req.query;

    let queryText = 'SELECT id, name, email, role, avatar_url FROM users';
    const params: any[] = [];

    if (role) {
      queryText += ' WHERE role = $1';
      params.push(role);
    }

    queryText += ' ORDER BY name ASC';

    const result = await query(queryText, params);

    res.json({ users: result.rows });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get current user (for session)
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      // Return default qAdmin user
      const result = await query(
        "SELECT id, name, email, role, avatar_url FROM users WHERE email = 'qadmin@simflow.local'"
      );

      if (result.rows.length > 0) {
        return res.json({ user: result.rows[0] });
      }

      return res.status(404).json({ error: 'User not found' });
    }

    const result = await query(
      'SELECT id, name, email, role, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};
