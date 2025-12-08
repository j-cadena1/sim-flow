/**
 * Notification Cleanup Service
 * Scheduled job to delete old read notifications based on user retention preferences
 */

import * as cron from 'node-cron';
import { cleanupOldNotifications } from './notificationService';
import { logger } from '../middleware/logger';

let cleanupJob: cron.ScheduledTask | null = null;

/**
 * Initialize notification cleanup cron job
 * Runs daily at 2:00 AM to delete old read notifications
 */
export function initializeNotificationCleanup(): void {
  // Run daily at 2:00 AM
  cleanupJob = cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('Starting notification cleanup job');
      const deletedCount = await cleanupOldNotifications();
      logger.info(`Notification cleanup completed: ${deletedCount} notifications deleted`);
    } catch (error) {
      logger.error('Error during notification cleanup:', error);
    }
  });

  logger.info('Notification cleanup job scheduled (daily at 2:00 AM)');

  // Run initial cleanup on startup (but don't block)
  setTimeout(async () => {
    try {
      logger.info('Running initial notification cleanup');
      const deletedCount = await cleanupOldNotifications();
      logger.info(`Initial cleanup completed: ${deletedCount} notifications deleted`);
    } catch (error) {
      logger.error('Error during initial notification cleanup:', error);
    }
  }, 5000); // Wait 5 seconds after startup
}

/**
 * Stop the cleanup job (for graceful shutdown)
 */
export function stopNotificationCleanup(): void {
  if (cleanupJob) {
    cleanupJob.stop();
    logger.info('Notification cleanup job stopped');
  }
}

/**
 * Manually trigger cleanup (for testing or manual execution)
 */
export async function manualCleanup(): Promise<number> {
  logger.info('Manual notification cleanup triggered');
  const deletedCount = await cleanupOldNotifications();
  logger.info(`Manual cleanup completed: ${deletedCount} notifications deleted`);
  return deletedCount;
}
