/**
 * @fileoverview System Settings Service
 *
 * Manages system-wide configuration settings stored in the database.
 * Currently handles qAdmin account disable/enable functionality.
 */

import { query } from '../db';
import { logger } from '../middleware/logger';

/**
 * Get a system setting value
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const result = await query(
      'SELECT value FROM system_settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].value;
  } catch (error) {
    logger.error(`Error getting system setting ${key}:`, error);
    throw error;
  }
}

/**
 * Set a system setting value
 */
export async function setSystemSetting(
  key: string,
  value: string,
  updatedBy: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO system_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
      [key, value, updatedBy]
    );

    logger.info(`System setting updated: ${key} = ${value} by user ${updatedBy}`);
  } catch (error) {
    logger.error(`Error setting system setting ${key}:`, error);
    throw error;
  }
}

/**
 * Check if qAdmin account is disabled
 */
export async function isQAdminDisabled(): Promise<boolean> {
  const value = await getSystemSetting('qadmin_disabled');
  return value === 'true';
}

/**
 * Count active Entra ID admins
 */
export async function countEntraIdAdmins(): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE role = 'Admin'
         AND auth_source = 'entra_id'
         AND deleted_at IS NULL`
    );

    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Error counting Entra ID admins:', error);
    throw error;
  }
}

/**
 * Disable qAdmin account
 * Requires at least one active Entra ID admin to exist
 */
export async function disableQAdmin(userId: string): Promise<void> {
  // Verify at least one Entra ID admin exists
  const entraIdAdminCount = await countEntraIdAdmins();

  if (entraIdAdminCount === 0) {
    throw new Error(
      'Cannot disable qAdmin account: At least one Entra ID admin must exist before disabling the local admin account'
    );
  }

  await setSystemSetting('qadmin_disabled', 'true', userId);
  logger.warn(`qAdmin account disabled by user ${userId}. ${entraIdAdminCount} Entra ID admin(s) available.`);
}

/**
 * Enable qAdmin account
 */
export async function enableQAdmin(userId: string): Promise<void> {
  await setSystemSetting('qadmin_disabled', 'false', userId);
  logger.info(`qAdmin account enabled by user ${userId}`);
}
