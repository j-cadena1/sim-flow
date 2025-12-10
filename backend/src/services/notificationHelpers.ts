/**
 * Notification Helper Functions
 * High-level functions that combine notification creation with real-time delivery
 */

import {
  createNotification,
  createNotificationForMultipleUsers,
  shouldNotify,
  shouldEmailNotify,
  markNotificationsEmailed,
  getUserEmail,
} from './notificationService';
import { notifyUser, notifyMultipleUsers } from './websocketService';
import { sendInstantNotificationEmail, isEmailConfigured } from './emailService';
import { CreateNotificationParams, Notification } from '../types/notifications';
import { logger } from '../middleware/logger';

/**
 * Create a notification and deliver it via WebSocket
 * Also sends instant email if user has that preference enabled
 * Checks user preferences before creating
 */
export async function sendNotification(params: CreateNotificationParams): Promise<void> {
  // Check if user wants this type of notification
  const shouldSend = await shouldNotify(params.userId, params.type);
  if (!shouldSend) {
    return; // User has disabled this notification type
  }

  // Create notification in database
  const notification = await createNotification(params);

  // Send real-time notification via WebSocket
  notifyUser(params.userId, notification);

  // Check if user wants instant email notifications (non-blocking)
  if (isEmailConfigured()) {
    sendInstantEmailIfEnabled(params.userId, notification).catch((error) => {
      logger.error('Error sending instant email notification:', error);
    });
  }
}

/**
 * Send instant email notification if user has it enabled
 * This is a helper function that runs asynchronously
 */
async function sendInstantEmailIfEnabled(userId: string, notification: Notification): Promise<void> {
  try {
    const { shouldEmail, isInstant } = await shouldEmailNotify(userId, notification.type);

    if (!shouldEmail || !isInstant) {
      return;
    }

    const email = await getUserEmail(userId);
    if (!email) {
      return;
    }

    const success = await sendInstantNotificationEmail(email, notification);

    if (success) {
      await markNotificationsEmailed([notification.id]);
    }
  } catch (error) {
    logger.error(`Failed to send instant email for notification ${notification.id}:`, error);
  }
}

/**
 * Create and send notifications to multiple users
 */
export async function sendNotificationToMultipleUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return;

  // Filter users based on their preferences
  const filteredUserIds = await Promise.all(
    userIds.map(async (userId) => {
      const should = await shouldNotify(userId, params.type);
      return should ? userId : null;
    })
  );

  const validUserIds = filteredUserIds.filter((id): id is string => id !== null);

  if (validUserIds.length === 0) return;

  // Create notifications in database (bulk insert)
  await createNotificationForMultipleUsers(validUserIds, params);

  // Send real-time notifications via WebSocket
  // Note: We create a notification object for each user
  // In a production scenario with thousands of users, you might want to optimize this
  const sampleNotification = {
    id: '', // Will be different for each user
    userId: '',
    ...params,
    read: false,
    createdAt: new Date(),
  };

  notifyMultipleUsers(validUserIds, sampleNotification);
}
