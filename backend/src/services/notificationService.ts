/**
 * Notification Service
 * Handles creation, retrieval, and management of user notifications
 */

import pool from '../db';
import { toCamelCase, toSnakeCase } from '../utils/caseConverter';
import {
  Notification,
  NotificationPreferences,
  CreateNotificationParams,
  NotificationQueryParams,
  UpdatePreferencesParams,
  NotificationType,
} from '../types/notifications';

/**
 * Create a new notification for a user
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<Notification> {
  const {
    userId,
    type,
    title,
    message,
    link,
    entityType,
    entityId,
    triggeredBy,
  } = params;

  const result = await pool.query(
    `INSERT INTO notifications (
      user_id, type, title, message, link, entity_type, entity_id, triggered_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [userId, type, title, message, link, entityType, entityId, triggeredBy]
  );

  return toCamelCase(result.rows[0]) as Notification;
}

/**
 * Create notifications for multiple users at once
 */
export async function createNotificationForMultipleUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return;

  const { type, title, message, link, entityType, entityId, triggeredBy } = params;

  // Build bulk insert query
  const values = userIds.map((userId, index) => {
    const offset = index * 8;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
  }).join(', ');

  const params_array = userIds.flatMap(userId => [
    userId,
    type,
    title,
    message,
    link,
    entityType,
    entityId,
    triggeredBy,
  ]);

  await pool.query(
    `INSERT INTO notifications (
      user_id, type, title, message, link, entity_type, entity_id, triggered_by
    ) VALUES ${values}`,
    params_array
  );
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  queryParams: NotificationQueryParams
): Promise<{ notifications: Notification[]; total: number }> {
  const { userId, unreadOnly = false, limit = 50, offset = 0, type } = queryParams;

  let whereClause = 'WHERE n.user_id = $1';
  const params: any[] = [userId];
  let paramCount = 1;

  if (unreadOnly) {
    paramCount++;
    whereClause += ` AND n.read = $${paramCount}`;
    params.push(false);
  }

  if (type) {
    paramCount++;
    whereClause += ` AND n.type = $${paramCount}`;
    params.push(type);
  }

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM notifications n ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get notifications with triggeredBy user info
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT
      n.*,
      u.name as triggered_by_name
    FROM notifications n
    LEFT JOIN users u ON n.triggered_by = u.id
    ${whereClause}
    ORDER BY n.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    params
  );

  const notifications = result.rows.map((row: any) => toCamelCase(row)) as Notification[];

  return { notifications, total };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
    [userId]
  );

  return parseInt(result.rows[0].count);
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
    [userId]
  );
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM notifications WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Get notification preferences for a user
 */
export async function getPreferences(userId: string): Promise<NotificationPreferences | null> {
  const result = await pool.query(
    `SELECT * FROM notification_preferences WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    // Create default preferences if they don't exist
    return createDefaultPreferences(userId);
  }

  return toCamelCase(result.rows[0]) as NotificationPreferences;
}

/**
 * Create default notification preferences for a user
 */
export async function createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await pool.query(
    `INSERT INTO notification_preferences (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO UPDATE SET user_id = $1
    RETURNING *`,
    [userId]
  );

  return toCamelCase(result.rows[0]) as NotificationPreferences;
}

/**
 * Update notification preferences for a user
 */
export async function updatePreferences(
  userId: string,
  updates: UpdatePreferencesParams
): Promise<NotificationPreferences> {
  // Ensure preferences exist
  await createDefaultPreferences(userId);

  const snakeCaseUpdates = toSnakeCase(updates) as Record<string, any>;
  const keys = Object.keys(snakeCaseUpdates);
  const values = Object.values(snakeCaseUpdates);

  if (keys.length === 0) {
    return (await getPreferences(userId))!;
  }

  const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');

  const result = await pool.query(
    `UPDATE notification_preferences
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
    RETURNING *`,
    [userId, ...values]
  );

  return toCamelCase(result.rows[0]) as NotificationPreferences;
}

/**
 * Check if user should receive a specific notification type
 */
export async function shouldNotify(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const prefs = await getPreferences(userId);
  if (!prefs || !prefs.inAppEnabled) return false;

  // Map notification type to preference field
  const typeMap: Record<string, keyof NotificationPreferences> = {
    REQUEST_ASSIGNED: 'requestAssigned',
    REQUEST_STATUS_CHANGED: 'requestStatusChanged',
    REQUEST_COMMENT_ADDED: 'requestCommentAdded',
    APPROVAL_NEEDED: 'approvalNeeded',
    APPROVAL_REVIEWED: 'approvalNeeded',
    TIME_LOGGED: 'timeLogged',
    PROJECT_UPDATED: 'projectUpdated',
    ADMIN_ACTION: 'adminAction',
    TITLE_CHANGE_REQUESTED: 'approvalNeeded',
    TITLE_CHANGE_REVIEWED: 'approvalNeeded',
    DISCUSSION_REQUESTED: 'approvalNeeded',
    DISCUSSION_REVIEWED: 'approvalNeeded',
  };

  const prefField = typeMap[type];
  if (!prefField) return true; // Default to allowing if unmapped

  return prefs[prefField] as boolean;
}

/**
 * Delete old read notifications based on retention policy
 * Called by cron job
 */
export async function cleanupOldNotifications(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM notifications
    WHERE id IN (
      SELECT n.id
      FROM notifications n
      JOIN notification_preferences np ON n.user_id = np.user_id
      WHERE n.read = true
      AND n.created_at < NOW() - (np.retention_days || ' days')::INTERVAL
    )
    RETURNING id`
  );

  return result.rowCount || 0;
}
