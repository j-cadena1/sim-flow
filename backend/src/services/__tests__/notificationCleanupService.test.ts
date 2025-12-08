/**
 * Unit Tests for Notification Cleanup Service
 *
 * Tests the scheduled cleanup job functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  schedule: vi.fn((cronExpr, callback) => ({
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

    test('should schedule initial cleanup after 5 seconds', () => {
      vi.useFakeTimers();

      initializeNotificationCleanup();

      // Fast-forward time by 5 seconds
      vi.advanceTimersByTime(5000);

      // The setTimeout callback should have been queued
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe('stopNotificationCleanup', () => {
    test('should stop the cleanup job', () => {
      const mockJob = {
        stop: vi.fn(),
      };

      (cron.schedule as any).mockReturnValue(mockJob);

      initializeNotificationCleanup();
      stopNotificationCleanup();

      expect(mockJob.stop).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Notification cleanup job stopped');
    });

    test('should handle case when job is not initialized', () => {
      stopNotificationCleanup();

      // Should not throw an error
      expect(logger.info).not.toHaveBeenCalledWith('Notification cleanup job stopped');
    });
  });

  describe('manualCleanup', () => {
    test('should trigger cleanup and return count', async () => {
      (cleanupOldNotifications as any).mockResolvedValue(25);

      const result = await manualCleanup();

      expect(result).toBe(25);
      expect(logger.info).toHaveBeenCalledWith('Manual notification cleanup triggered');
      expect(logger.info).toHaveBeenCalledWith('Manual cleanup completed: 25 notifications deleted');
      expect(cleanupOldNotifications).toHaveBeenCalled();
    });

    test('should handle cleanup with no deletions', async () => {
      (cleanupOldNotifications as any).mockResolvedValue(0);

      const result = await manualCleanup();

      expect(result).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Manual cleanup completed: 0 notifications deleted');
    });
  });

  describe('scheduled cleanup execution', () => {
    test('should execute cleanup on schedule', async () => {
      vi.useFakeTimers();
      let cronCallback: any;

      (cron.schedule as any).mockImplementation((expr: string, callback: any) => {
        cronCallback = callback;
        return { stop: vi.fn() };
      });

      (cleanupOldNotifications as any).mockResolvedValue(10);

      initializeNotificationCleanup();

      // Execute the cron callback
      await cronCallback();

      expect(logger.info).toHaveBeenCalledWith('Starting notification cleanup job');
      expect(cleanupOldNotifications).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Notification cleanup completed: 10 notifications deleted'
      );
    });

    test('should handle errors during scheduled cleanup', async () => {
      vi.useFakeTimers();
      let cronCallback: any;

      (cron.schedule as any).mockImplementation((expr: string, callback: any) => {
        cronCallback = callback;
        return { stop: vi.fn() };
      });

      const mockError = new Error('Database connection failed');
      (cleanupOldNotifications as any).mockRejectedValue(mockError);

      initializeNotificationCleanup();

      // Execute the cron callback
      await cronCallback();

      expect(logger.error).toHaveBeenCalledWith('Error during notification cleanup:', mockError);
    });
  });

  describe('initial cleanup on startup', () => {
    test('should run initial cleanup after 5 seconds', async () => {
      vi.useFakeTimers();

      (cleanupOldNotifications as any).mockResolvedValue(5);

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
      (cleanupOldNotifications as any).mockRejectedValue(mockError);

      initializeNotificationCleanup();

      // Fast-forward 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      expect(logger.error).toHaveBeenCalledWith('Error during initial notification cleanup:', mockError);
    });
  });
});
