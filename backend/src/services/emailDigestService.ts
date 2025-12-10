/**
 * Email Digest Service
 * Scheduled jobs to send batched email notifications (hourly, daily, weekly)
 */

import * as cron from 'node-cron';
import { logger } from '../middleware/logger';
import { isEmailConfigured, sendDigestEmail } from './emailService';
import {
  getUsersWithPendingDigest,
  getUnsentNotifications,
  markNotificationsEmailed,
} from './notificationService';

// Store scheduled tasks for graceful shutdown
const digestJobs: cron.ScheduledTask[] = [];

/**
 * Initialize email digest cron jobs
 * Call this on server startup after email service is initialized
 */
export function initializeEmailDigestService(): void {
  if (!isEmailConfigured()) {
    logger.info('Email not configured, digest service not started');
    return;
  }

  // Hourly digest - runs at the top of every hour
  const hourlyJob = cron.schedule('0 * * * *', async () => {
    await runDigest('hourly');
  });
  digestJobs.push(hourlyJob);

  // Daily digest - runs at 8:00 AM
  const dailyJob = cron.schedule('0 8 * * *', async () => {
    await runDigest('daily');
  });
  digestJobs.push(dailyJob);

  // Weekly digest - runs at 8:00 AM on Monday
  const weeklyJob = cron.schedule('0 8 * * 1', async () => {
    await runDigest('weekly');
  });
  digestJobs.push(weeklyJob);

  logger.info('Email digest service initialized');
  logger.info('  - Hourly: every hour at :00');
  logger.info('  - Daily: 8:00 AM');
  logger.info('  - Weekly: Monday 8:00 AM');
}

/**
 * Stop all digest jobs (for graceful shutdown)
 */
export function stopEmailDigestService(): void {
  digestJobs.forEach((job) => job.stop());
  digestJobs.length = 0;
  logger.info('Email digest service stopped');
}

/**
 * Run a digest for a specific frequency
 */
async function runDigest(frequency: 'hourly' | 'daily' | 'weekly'): Promise<void> {
  try {
    logger.info(`Starting ${frequency} email digest job`);

    // Get users who have pending notifications for this frequency
    const users = await getUsersWithPendingDigest(frequency);

    if (users.length === 0) {
      logger.info(`No users with pending ${frequency} notifications`);
      return;
    }

    logger.info(`Processing ${frequency} digest for ${users.length} user(s)`);

    let successCount = 0;
    let failCount = 0;

    for (const { userId, email } of users) {
      try {
        const sent = await sendDigestForUser(userId, email, frequency);
        if (sent) {
          successCount++;
        }
      } catch (error) {
        failCount++;
        logger.error(`Failed to send ${frequency} digest to ${email}:`, error);
      }
    }

    logger.info(
      `${frequency} digest completed: ${successCount} sent, ${failCount} failed`
    );
  } catch (error) {
    logger.error(`Error during ${frequency} digest job:`, error);
  }
}

/**
 * Send digest email for a specific user
 */
async function sendDigestForUser(
  userId: string,
  email: string,
  frequency: string
): Promise<boolean> {
  // Get unsent notifications for this user
  const notifications = await getUnsentNotifications(userId);

  if (notifications.length === 0) {
    return false; // Nothing to send
  }

  // Send the digest email
  const success = await sendDigestEmail(email, notifications, frequency);

  if (success) {
    // Mark all notifications as emailed
    const notificationIds = notifications.map((n) => n.id);
    await markNotificationsEmailed(notificationIds);
    logger.info(`Sent ${frequency} digest with ${notifications.length} notifications to ${email}`);
  }

  return success;
}

/**
 * Manually trigger a digest (for testing or manual execution)
 */
export async function manualDigest(
  frequency: 'hourly' | 'daily' | 'weekly'
): Promise<{ sent: number; failed: number }> {
  logger.info(`Manual ${frequency} digest triggered`);

  if (!isEmailConfigured()) {
    logger.warn('Email not configured, cannot run manual digest');
    return { sent: 0, failed: 0 };
  }

  const users = await getUsersWithPendingDigest(frequency);
  let sent = 0;
  let failed = 0;

  for (const { userId, email } of users) {
    try {
      const success = await sendDigestForUser(userId, email, frequency);
      if (success) {
        sent++;
      }
    } catch {
      failed++;
    }
  }

  logger.info(`Manual ${frequency} digest completed: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}
