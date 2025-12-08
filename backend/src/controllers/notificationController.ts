/**
 * Notification Controller
 * Handles HTTP requests for notification management
 */

import { Request, Response } from 'express';
import * as notificationService from '../services/notificationService';
import { NotificationType } from '../types/notifications';

/**
 * GET /api/notifications
 * Get user's notifications with pagination
 */
export async function getNotificationsController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as NotificationType | undefined;

    const result = await notificationService.getNotifications({
      userId,
      unreadOnly,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      type,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
export async function getUnreadCountController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
export async function markAsReadController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    await notificationService.markAsRead(notificationId, userId);

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
export async function markAllAsReadController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    await notificationService.markAllAsRead(userId);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export async function deleteNotificationController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    await notificationService.deleteNotification(notificationId, userId);

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
}

/**
 * DELETE /api/notifications
 * Delete all notifications for user
 */
export async function deleteAllNotificationsController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    await notificationService.deleteAllNotifications(userId);

    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ error: 'Failed to delete all notifications' });
  }
}

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
export async function getPreferencesController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const preferences = await notificationService.getPreferences(userId);

    if (!preferences) {
      return res.status(404).json({ error: 'Preferences not found' }) as any;
    }

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences
 */
export async function updatePreferencesController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const updates = req.body;

    // Validate retention days if provided
    if (updates.retentionDays !== undefined) {
      const days = parseInt(updates.retentionDays);
      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({
          error: 'Retention days must be between 1 and 365',
        }) as any;
      }
      updates.retentionDays = days;
    }

    const preferences = await notificationService.updatePreferences(userId, updates);

    res.json(preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
}
