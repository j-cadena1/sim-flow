import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { getDirectoryUsers, syncUserFromDirectory } from '../services/graphService';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  authSource: string;
  entraId: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

/**
 * Get all users with their auth source
 * Admin only
 */
export const getAllUsersManagement = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, avatar_url, auth_source, entra_id, last_sync_at, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    const users = toCamelCase<User[]>(result.rows);

    logger.info(`Retrieved ${users.length} users for management`);
    res.json({ users });
  } catch (error) {
    logger.error('Error fetching users for management:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Update user role
 * Admin only
 */
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const admin = req.user;

    // Validation
    const validRoles = ['Admin', 'Manager', 'Engineer', 'End-User'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: Admin, Manager, Engineer, End-User',
      });
    }

    // Prevent changing your own role
    if (admin?.userId === id) {
      return res.status(400).json({
        error: 'Cannot change your own role',
      });
    }

    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, avatar_url, auth_source',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = toCamelCase(result.rows[0]);
    logger.info(`User ${id} role updated to ${role} by admin ${admin?.userId}`);
    res.json({ user, message: 'User role updated successfully' });
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

/**
 * Sync user from Entra ID directory
 * Updates name and other profile info
 */
export const syncUserFromEntraID = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get user's email
    const userResult = await query(
      'SELECT email, auth_source FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { email, auth_source } = userResult.rows[0];

    if (auth_source !== 'entra_id') {
      return res.status(400).json({
        error: 'Can only sync users that were created via Entra ID SSO',
      });
    }

    // Sync from directory
    const syncedData = await syncUserFromDirectory(email);

    if (!syncedData) {
      return res.status(404).json({
        error: 'User not found in Entra ID directory',
      });
    }

    // Update user (including avatar if available)
    const avatarUpdate = syncedData.avatarUrl ? syncedData.avatarUrl : undefined;
    let result;

    if (avatarUpdate) {
      result = await query(
        `UPDATE users
         SET name = $1, avatar_url = $2, last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, email, role, avatar_url, auth_source, entra_id, last_sync_at`,
        [syncedData.name, avatarUpdate, id]
      );
    } else {
      result = await query(
        `UPDATE users
         SET name = $1, last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, name, email, role, avatar_url, auth_source, entra_id, last_sync_at`,
        [syncedData.name, id]
      );
    }

    const user = toCamelCase(result.rows[0]);
    logger.info(`Synced user ${id} from Entra ID`);
    res.json({ user, message: 'User synced successfully from Entra ID' });
  } catch (error) {
    logger.error('Error syncing user from Entra ID:', error);
    res.status(500).json({ error: 'Failed to sync user from Entra ID' });
  }
};

/**
 * Import users from Entra ID directory
 * Fetches all users from directory and allows admin to import them
 */
export const getEntraIDDirectoryUsers = async (req: Request, res: Response) => {
  try {
    const directoryUsers = await getDirectoryUsers();

    // Get existing users to mark which are already imported
    const existingUsersResult = await query(
      'SELECT email FROM users WHERE auth_source = $1',
      ['entra_id']
    );

    const existingEmails = new Set(
      existingUsersResult.rows.map((row) => row.email.toLowerCase())
    );

    // Format directory users with import status
    const usersWithStatus = directoryUsers.map((user) => ({
      entraId: user.id,
      name: user.displayName,
      email: (user.mail || user.userPrincipalName).toLowerCase(),
      jobTitle: user.jobTitle,
      department: user.department,
      isImported: existingEmails.has((user.mail || user.userPrincipalName).toLowerCase()),
    }));

    logger.info(`Retrieved ${directoryUsers.length} users from Entra ID directory`);
    res.json({ users: usersWithStatus });
  } catch (error: any) {
    logger.error('Error fetching Entra ID directory users:', error);

    if (error.response?.data?.error?.message) {
      return res.status(error.response.status || 500).json({
        error: 'Microsoft Graph API error',
        details: error.response.data.error.message,
      });
    }

    res.status(500).json({ error: 'Failed to fetch directory users' });
  }
};

/**
 * Bulk import users from Entra ID
 * Creates users from selected directory entries
 */
export const bulkImportUsers = async (req: Request, res: Response) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Users array is required' });
    }

    const imported = [];
    const errors = [];

    for (const user of users) {
      try {
        const { email, name, entraId, role = 'End-User' } = user;

        if (!email || !name) {
          errors.push({ email, error: 'Missing email or name' });
          continue;
        }

        // Check if user already exists
        const existingResult = await query(
          'SELECT id FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        if (existingResult.rows.length > 0) {
          errors.push({ email, error: 'User already exists' });
          continue;
        }

        // Create user
        const result = await query(
          `INSERT INTO users (name, email, password_hash, role, avatar_url, auth_source, entra_id, last_sync_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           RETURNING id, name, email, role, avatar_url, auth_source, entra_id`,
          [
            name,
            email.toLowerCase(),
            '', // No password for SSO users
            role,
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            'entra_id',
            entraId,
          ]
        );

        imported.push(toCamelCase(result.rows[0]));
        logger.info(`Imported user from Entra ID: ${email}`);
      } catch (err) {
        logger.error(`Error importing user ${user.email}:`, err);
        errors.push({ email: user.email, error: 'Failed to import' });
      }
    }

    res.json({
      imported,
      errors,
      message: `Successfully imported ${imported.length} user(s)`,
    });
  } catch (error) {
    logger.error('Error bulk importing users:', error);
    res.status(500).json({ error: 'Failed to bulk import users' });
  }
};

/**
 * Delete a user
 * Admin only - cannot delete yourself
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = req.user;

    // Prevent deleting yourself
    if (admin?.userId === id) {
      return res.status(400).json({
        error: 'Cannot delete your own account',
      });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User ${id} (${result.rows[0].email}) deleted by admin ${admin?.userId}`);
    res.json({ message: 'User deleted successfully', id: result.rows[0].id });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
