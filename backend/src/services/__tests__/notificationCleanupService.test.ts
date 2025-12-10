/**
 * Unit Tests for Notification Cleanup Service
 *
 * Tests the scheduled cleanup job functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScheduledTask } from 'node-cron';

// Mock node-cron
vi.mock('node-cron', () => ({
  schedule: vi.fn((_cronExpr, _callback) => ({
    stop: vi.fn(),
    start: vi.fn(),
  })),
}));

// Mock the notification service
vi.mock('../notificationService', () => ({
  cleanupOldNotifications: vi.fn(),
}));

// Mock the logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import * as cron from 'node-cron';
import { cleanupOldNotifications } from '../notificationService';
import { logger } from '../../middleware/logger';
import {
  initializeNotificationCleanup,
  stopNotificationCleanup,
  manualCleanup,
} from '../notificationCleanupService';

describe('NotificationCleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initializeNotificationCleanup', () => {
    test('should schedule a cron job', () => {
      initializeNotificationCleanup();

      expect(cron.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith(
        'Notification cleanup job scheduled (daily at 2:00 AM)'
      );
    });

    test('should schedule initial cleanup after 5 seconds', async () => {
      vi.useFakeTimers();

      vi.mocked(cleanupOldNotifications).mockResolvedValue(0);

      initializeNotificationCleanup();

      // Fast-forward time by 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // The initial cleanup should have run and logged
      expect(logger.info).toHaveBeenCalledWith('Running initial notification cleanup');
    });
  });

  describe('stopNotificationCleanup', () => {
    test('should stop the cleanup job', () => {
      const mockJob = {
        stop: vi.fn(),
      };

      vi.mocked(cron.schedule).mockReturnValue(mockJob as unknown as ScheduledTask);

      initializeNotificationCleanup();
      stopNotificationCleanup();

      expect(mockJob.stop).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Notification cleanup job stopped');
    });

    test('should handle case when job is not initialized', () => {
      // Call stopNotificationCleanup without first calling initializeNotificationCleanup
      // Since the previous test initialized a job, we need to stop it first
      // and then the second call should handle the null case gracefully

      // Clear all mocks so we can track fresh calls
      vi.clearAllMocks();

      // After the previous test, cleanupJob is set. Stop it.
      stopNotificationCleanup();

      // Clear again to track only the next call
      vi.clearAllMocks();

      // Now call stop again when cleanupJob should be null after stop
      // This should not throw and should not log "job stopped" since job is already null
      expect(() => stopNotificationCleanup()).not.toThrow();

      // Verify the "stopped" message was not logged since job was already null
      expect(logger.info).not.toHaveBeenCalledWith('Notification cleanup job stopped');
    });
  });

  describe('manualCleanup', () => {
    test('should trigger cleanup and return count', async () => {
      vi.mocked(cleanupOldNotifications).mockResolvedValue(25);

      const result = await manualCleanup();

      expect(result).toBe(25);
      expect(logger.info).toHaveBeenCalledWith('Manual notification cleanup triggered');
      expect(logger.info).toHaveBeenCalledWith('Manual cleanup completed: 25 notifications deleted');
      expect(cleanupOldNotifications).toHaveBeenCalled();
    });

    test('should handle cleanup with no deletions', async () => {
      vi.mocked(cleanupOldNotifications).mockResolvedValue(0);

      const result = await manualCleanup();

      expect(result).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Manual cleanup completed: 0 notifications deleted');
    });
  });

  describe('scheduled cleanup execution', () => {
    test('should execute cleanup on schedule', async () => {
      vi.useFakeTimers();
      let cronCallback: (() => Promise<void>) | null = null;

      vi.mocked(cron.schedule).mockImplementation((_expr: string, callback: () => void) => {
        cronCallback = callback as () => Promise<void>;
        return { stop: vi.fn() } as unknown as ScheduledTask;
      });

      vi.mocked(cleanupOldNotifications).mockResolvedValue(10);

      initializeNotificationCleanup();

      // Execute the cron callback
      await cronCallback!();

      expect(logger.info).toHaveBeenCalledWith('Starting notification cleanup job');
      expect(cleanupOldNotifications).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Notification cleanup completed: 10 notifications deleted'
      );
    });

    test('should handle errors during scheduled cleanup', async () => {
      vi.useFakeTimers();
      let cronCallback: (() => Promise<void>) | null = null;

      vi.mocked(cron.schedule).mockImplementation((_expr: string, callback: () => void) => {
        cronCallback = callback as () => Promise<void>;
        return { stop: vi.fn() } as unknown as ScheduledTask;
      });

      const mockError = new Error('Database connection failed');
      vi.mocked(cleanupOldNotifications).mockRejectedValue(mockError);

      initializeNotificationCleanup();

      // Execute the cron callback
      await cronCallback!();

      expect(logger.error).toHaveBeenCalledWith('Error during notification cleanup:', mockError);
    });
  });

  describe('initial cleanup on startup', () => {
    test('should run initial cleanup after 5 seconds', async () => {
      vi.useFakeTimers();

      vi.mocked(cleanupOldNotifications).mockResolvedValue(5);

      initializeNotificationCleanup();

      // Fast-forward 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      expect(logger.info).toHaveBeenCalledWith('Running initial notification cleanup');
      expect(cleanupOldNotifications).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Initial cleanup completed: 5 notifications deleted');
    });

    test('should handle errors during initial cleanup', async () => {
      vi.useFakeTimers();

      const mockError = new Error('Initial cleanup failed');
      vi.mocked(cleanupOldNotifications).mockRejectedValue(mockError);

      initializeNotificationCleanup();

      // Fast-forward 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      expect(logger.error).toHaveBeenCalledWith('Error during initial notification cleanup:', mockError);
    });
  });
});
