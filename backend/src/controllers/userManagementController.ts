import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { getDirectoryUsers, syncUserFromDirectory } from '../services/graphService';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';
import { sendNotification } from '../services/notificationHelpers';

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
  deletedAt: string | null;
}

// Protected system account - cannot be modified or deleted
const PROTECTED_EMAIL = 'qadmin@simflow.local';

/**
 * Check if a user is a protected system account
 */
const isProtectedUser = (email: string): boolean => {
  return email.toLowerCase() === PROTECTED_EMAIL.toLowerCase();
};

interface DeletedUserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  deletedAt: string;
}

/**
 * Get all users with their auth source
 * Admin only - includes both active and deactivated users
 */
export const getAllUsersManagement = async (req: Request, res: Response) => {
  try {
    const includeDeactivated = req.query.includeDeactivated === 'true';

    let sql = `SELECT id, name, email, role, avatar_url, auth_source, entra_id, last_sync_at, created_at, deleted_at
       FROM users`;

    if (!includeDeactivated) {
      sql += ` WHERE deleted_at IS NULL`;
    }

    sql += ` ORDER BY deleted_at NULLS FIRST, created_at DESC`;

    const result = await query(sql);

    const users = toCamelCase<User[]>(result.rows);

    logger.info(`Retrieved ${users.length} users for management (includeDeactivated: ${includeDeactivated})`);
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

    // Check if target user is protected
    const targetUserResult = await query('SELECT email FROM users WHERE id = $1', [id]);
    if (targetUserResult.rows.length > 0 && isProtectedUser(targetUserResult.rows[0].email)) {
      return res.status(403).json({
        error: 'Cannot modify the system administrator account',
      });
    }

    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, avatar_url, auth_source',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = toCamelCase<{ email: string; name: string }>(result.rows[0]);
    logger.info(`User ${id} role updated to ${role} by admin ${admin?.userId}`);

    // Log audit trail
    await logRequestAudit(
      req,
      AuditAction.UPDATE_USER_ROLE,
      EntityType.USER,
      id,
      { role, targetUserEmail: user.email, targetUserName: user.name }
    );

    // Notify the user about their role change
    await sendNotification({
      userId: id,
      type: 'ADMIN_ACTION',
      title: 'Role Updated',
      message: `Your role has been changed to ${role} by an administrator`,
      link: '/settings',
      entityType: 'User',
      entityId: id,
      triggeredBy: admin?.userId,
    }).catch(err => logger.error('Failed to send role change notification:', err));

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
  } catch (error) {
    logger.error('Error fetching Entra ID directory users:', error);

    interface GraphApiError {
      response?: {
        status?: number;
        data?: {
          error?: {
            message?: string;
          };
        };
      };
    }

    const graphError = error as GraphApiError;
    if (graphError.response?.data?.error?.message) {
      return res.status(graphError.response.status || 500).json({
        error: 'Microsoft Graph API error',
        details: graphError.response.data.error.message,
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
 * Deactivate a user (soft delete)
 * User cannot login but all their data is preserved
 * Admin only - cannot deactivate yourself
 */
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = req.user;

    // Prevent deactivating yourself
    if (admin?.userId === id) {
      return res.status(400).json({
        error: 'Cannot deactivate your own account',
      });
    }

    // Check if user exists and is not already deactivated
    const checkResult = await query(
      'SELECT id, email, name, deleted_at FROM users WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is protected
    if (isProtectedUser(checkResult.rows[0].email)) {
      return res.status(403).json({
        error: 'Cannot deactivate the system administrator account',
      });
    }

    if (checkResult.rows[0].deleted_at) {
      return res.status(400).json({ error: 'User is already deactivated' });
    }

    const result = await query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 RETURNING id, email, name',
      [id]
    );

    logger.info(`User ${id} (${result.rows[0].email}) deactivated by admin ${admin?.userId}`);

    // Log audit trail
    await logRequestAudit(
      req,
      AuditAction.DEACTIVATE_USER,
      EntityType.USER,
      id,
      {
        deactivatedUserEmail: result.rows[0].email,
        deactivatedUserName: result.rows[0].name
      }
    );

    res.json({
      message: 'User deactivated successfully. They can no longer login but their data is preserved.',
      id: result.rows[0].id
    });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

/**
 * Restore a deactivated user
 * Admin only
 */
export const restoreUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = req.user;

    // Check if user exists and is deactivated
    const checkResult = await query(
      'SELECT id, email, name, deleted_at FROM users WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!checkResult.rows[0].deleted_at) {
      return res.status(400).json({ error: 'User is not deactivated' });
    }

    const result = await query(
      'UPDATE users SET deleted_at = NULL WHERE id = $1 RETURNING id, email, name',
      [id]
    );

    logger.info(`User ${id} (${result.rows[0].email}) restored by admin ${admin?.userId}`);

    // Log audit trail
    await logRequestAudit(
      req,
      AuditAction.RESTORE_USER,
      EntityType.USER,
      id,
      {
        restoredUserEmail: result.rows[0].email,
        restoredUserName: result.rows[0].name
      }
    );

    res.json({
      message: 'User restored successfully. They can now login again.',
      id: result.rows[0].id
    });
  } catch (error) {
    logger.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  }
};

/**
 * Permanently delete a user (hard delete)
 * Archives user info to deleted_users table for historical reference
 * Then removes user from users table
 * Admin only - cannot delete yourself
 * Requires confirmation (user email must match)
 */
export const permanentlyDeleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmEmail, reason } = req.body;
    const admin = req.user;

    // Prevent deleting yourself
    if (admin?.userId === id) {
      return res.status(400).json({
        error: 'Cannot delete your own account',
      });
    }

    // Get user details
    const userResult = await query(
      'SELECT id, email, name, role, created_at, entra_id FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if target user is protected
    if (isProtectedUser(user.email)) {
      return res.status(403).json({
        error: 'Cannot delete the system administrator account',
      });
    }

    // Require confirmation by typing email
    if (!confirmEmail || confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({
        error: 'Please confirm by typing the user\'s email address',
        requiredEmail: user.email
      });
    }

    // Archive user info to deleted_users table
    await query(
      `INSERT INTO deleted_users (id, email, name, role, deleted_by, deletion_reason, original_created_at, sso_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         deleted_at = NOW(),
         deleted_by = $5,
         deletion_reason = $6`,
      [user.id, user.email, user.name, user.role, admin?.userId, reason || null, user.created_at, user.entra_id]
    );

    // Delete the user (foreign key SET NULL constraints will preserve related data)
    await query('DELETE FROM users WHERE id = $1', [id]);

    logger.info(`User ${id} (${user.email}) permanently deleted by admin ${admin?.userId}. Reason: ${reason || 'Not specified'}`);

    // Log audit trail (permanent delete)
    await logRequestAudit(
      req,
      AuditAction.DELETE_USER,
      EntityType.USER,
      id,
      {
        deletedUserEmail: user.email,
        deletedUserName: user.name,
        reason: reason || 'Not specified',
        permanentDelete: true
      }
    );

    res.json({
      message: 'User permanently deleted. Their identity is archived for historical reference.',
      id: user.id
    });
  } catch (error) {
    logger.error('Error permanently deleting user:', error);
    res.status(500).json({ error: 'Failed to permanently delete user' });
  }
};

/**
 * Get deleted user info by ID
 * Used for tooltips showing original user info on anonymized records
 */
export const getDeletedUserInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, email, name, role, deleted_at FROM deleted_users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deleted user not found' });
    }

    const deletedUser = toCamelCase<DeletedUserInfo>(result.rows[0]);
    res.json({ deletedUser });
  } catch (error) {
    logger.error('Error fetching deleted user info:', error);
    res.status(500).json({ error: 'Failed to fetch deleted user info' });
  }
};

/**
 * Batch lookup deleted users by IDs or names
 * More efficient for loading multiple deleted user references at once
 * Supports both ID lookup (when available) and name lookup (for historical records)
 */
export const batchGetDeletedUsers = async (req: Request, res: Response) => {
  try {
    const { ids, names } = req.body;

    // Must provide either ids or names array
    if ((!Array.isArray(ids) || ids.length === 0) && (!Array.isArray(names) || names.length === 0)) {
      return res.status(400).json({ error: 'ids or names array is required' });
    }

    const usersMap: Record<string, DeletedUserInfo> = {};

    // Lookup by IDs if provided
    if (Array.isArray(ids) && ids.length > 0) {
      const limitedIds = ids.slice(0, 100);
      const result = await query(
        `SELECT id, email, name, role, deleted_at, deleted_by, deletion_reason, original_created_at
         FROM deleted_users WHERE id = ANY($1)`,
        [limitedIds]
      );

      const deletedUsers = toCamelCase<DeletedUserInfo[]>(result.rows);
      deletedUsers.forEach(user => {
        usersMap[user.id] = user;
      });
    }

    // Lookup by names if provided (for historical records where we only have the name)
    if (Array.isArray(names) && names.length > 0) {
      const limitedNames = names.slice(0, 100);
      const result = await query(
        `SELECT du.id, du.email, du.name, du.role, du.deleted_at, du.deleted_by, du.deletion_reason, du.original_created_at,
                u.name as deleted_by_name
         FROM deleted_users du
         LEFT JOIN users u ON du.deleted_by = u.id
         WHERE du.name = ANY($1)`,
        [limitedNames]
      );

      interface ExtendedDeletedUserInfo extends DeletedUserInfo {
        deletedBy?: string;
        deletedByName?: string;
        deletionReason?: string;
        originalCreatedAt?: string;
      }

      const deletedUsers = toCamelCase<ExtendedDeletedUserInfo[]>(result.rows);
      deletedUsers.forEach(user => {
        // Key by name for name lookups (since that's what the frontend will use)
        usersMap[user.name] = user;
      });
    }

    res.json({ users: usersMap });
  } catch (error) {
    logger.error('Error batch fetching deleted users:', error);
    res.status(500).json({ error: 'Failed to fetch deleted users' });
  }
};

/**
 * Validate password strength
 * Requires: minimum 12 characters, uppercase, lowercase, number, special character
 * Returns error message or null if valid
 */
const validatePasswordStrength = (password: string): string | null => {
  if (password.length < 12) {
    return 'Password must be at least 12 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)';
  }
  // Check for common weak patterns
  const commonPatterns = ['password', 'qwerty', '123456', 'admin', 'simflow'];
  const lowerPassword = password.toLowerCase();
  for (const pattern of commonPatterns) {
    if (lowerPassword.includes(pattern)) {
      return 'Password contains common weak patterns';
    }
  }
  return null;
};

/**
 * Change password for qAdmin local account
 * Admin only - allows qAdmin or any Admin role user to change the qAdmin password
 *
 * Password requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - No common weak patterns (password, qwerty, 123456, admin, simflow)
 */
export const changeQAdminPassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = req.user;

    // Validate password strength
    if (!newPassword) {
      return res.status(400).json({
        error: 'New password is required',
      });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({
        error: strengthError,
      });
    }

    // Get qAdmin user
    const userResult = await query(
      'SELECT id, email, password_hash, auth_source FROM users WHERE email = $1',
      [PROTECTED_EMAIL]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'System administrator account not found' });
    }

    const qAdminUser = userResult.rows[0];

    // Verify this is a local account (not SSO)
    if (qAdminUser.auth_source !== 'local') {
      return res.status(400).json({
        error: 'Cannot change password for SSO accounts',
      });
    }

    // If user is qAdmin themselves, require current password verification
    const isQAdminThemselves = admin?.email.toLowerCase() === PROTECTED_EMAIL.toLowerCase();
    if (isQAdminThemselves) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'Current password is required',
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, qAdminUser.password_hash);
      if (!isCurrentPasswordValid) {
        logger.warn(`Failed password change attempt for qAdmin by qAdmin (incorrect current password)`);
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }
    // If user is a different Admin, they can change it without knowing current password

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [hashedPassword, PROTECTED_EMAIL]
    );

    logger.info(`qAdmin password changed by ${admin?.email} (Admin role: ${admin?.role})`);

    // Log audit trail
    await logRequestAudit(
      req,
      AuditAction.CHANGE_QADMIN_PASSWORD,
      EntityType.USER,
      qAdminUser.id,
      {
        changedBy: admin?.email,
        changedByRole: admin?.role,
        isSelfChange: isQAdminThemselves
      }
    );

    res.json({ message: 'System administrator password updated successfully' });
  } catch (error) {
    logger.error('Error changing qAdmin password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};
