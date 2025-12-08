/**
 * Notification Helper Functions
 * High-level functions that combine notification creation with real-time delivery
 */

import {
  createNotification,
  createNotificationForMultipleUsers,
  shouldNotify,
} from './notificationService';
import { notifyUser, notifyMultipleUsers } from './websocketService';
import { CreateNotificationParams } from '../types/notifications';

/**
 * Create a notification and deliver it via WebSocket
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
