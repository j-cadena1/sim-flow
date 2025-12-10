import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScheduledTask } from 'node-cron';

// Mock dependencies
vi.mock('node-cron', () => ({
  schedule: vi.fn(() => ({
    stop: vi.fn(),
  })),
}));

vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../emailService', () => ({
  isEmailConfigured: vi.fn(),
  sendDigestEmail: vi.fn(),
}));

vi.mock('../notificationService', () => ({
  getUsersWithPendingDigest: vi.fn(),
  getUnsentNotifications: vi.fn(),
  markNotificationsEmailed: vi.fn(),
}));

describe('emailDigestService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('initializeEmailDigestService', () => {
    it('does not schedule jobs when email is not configured', async () => {
      const cron = await import('node-cron');
      const { isEmailConfigured } = await import('../emailService');
      vi.mocked(isEmailConfigured).mockReturnValue(false);

      const { initializeEmailDigestService } = await import('../emailDigestService');
      initializeEmailDigestService();

      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('schedules three cron jobs when email is configured', async () => {
      const cron = await import('node-cron');
      const { isEmailConfigured } = await import('../emailService');
      vi.mocked(isEmailConfigured).mockReturnValue(true);

      const { initializeEmailDigestService } = await import('../emailDigestService');
      initializeEmailDigestService();

      // Should schedule hourly, daily, and weekly jobs
      expect(cron.schedule).toHaveBeenCalledTimes(3);
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 8 * * 1', expect.any(Function));
    });
  });

  describe('stopEmailDigestService', () => {
    it('stops all scheduled jobs', async () => {
      const mockStop = vi.fn();
      const cron = await import('node-cron');
      vi.mocked(cron.schedule).mockReturnValue({ stop: mockStop } as unknown as ScheduledTask);

      const { isEmailConfigured } = await import('../emailService');
      vi.mocked(isEmailConfigured).mockReturnValue(true);

      const { initializeEmailDigestService, stopEmailDigestService } = await import(
        '../emailDigestService'
      );

      initializeEmailDigestService();
      stopEmailDigestService();

      // Should have called stop on all 3 jobs
      expect(mockStop).toHaveBeenCalledTimes(3);
    });
  });

  describe('manualDigest', () => {
    it('returns zeros when email is not configured', async () => {
      const { isEmailConfigured } = await import('../emailService');
      vi.mocked(isEmailConfigured).mockReturnValue(false);

      const { manualDigest } = await import('../emailDigestService');
      const result = await manualDigest('daily');

      expect(result).toEqual({ sent: 0, failed: 0 });
    });

    it('processes users with pending notifications', async () => {
      const { isEmailConfigured, sendDigestEmail } = await import('../emailService');
      const { getUsersWithPendingDigest, getUnsentNotifications, markNotificationsEmailed } =
        await import('../notificationService');

      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getUsersWithPendingDigest).mockResolvedValue([
        { userId: 'user-1', email: 'user1@example.com' },
        { userId: 'user-2', email: 'user2@example.com' },
      ]);
      vi.mocked(getUnsentNotifications).mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'REQUEST_ASSIGNED',
          title: 'Test',
          message: 'Test message',
          read: false,
          createdAt: new Date(),
        },
      ]);
      vi.mocked(sendDigestEmail).mockResolvedValue(true);
      vi.mocked(markNotificationsEmailed).mockResolvedValue(undefined);

      const { manualDigest } = await import('../emailDigestService');
      const result = await manualDigest('daily');

      expect(getUsersWithPendingDigest).toHaveBeenCalledWith('daily');
      expect(getUnsentNotifications).toHaveBeenCalledTimes(2);
      expect(sendDigestEmail).toHaveBeenCalledTimes(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('counts failures correctly', async () => {
      const { isEmailConfigured, sendDigestEmail } = await import('../emailService');
      const { getUsersWithPendingDigest, getUnsentNotifications } = await import(
        '../notificationService'
      );

      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getUsersWithPendingDigest).mockResolvedValue([
        { userId: 'user-1', email: 'user1@example.com' },
        { userId: 'user-2', email: 'user2@example.com' },
      ]);
      vi.mocked(getUnsentNotifications).mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'REQUEST_ASSIGNED',
          title: 'Test',
          message: 'Test message',
          read: false,
          createdAt: new Date(),
        },
      ]);

      // First succeeds, second fails
      vi.mocked(sendDigestEmail)
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('SMTP error'));

      const { manualDigest } = await import('../emailDigestService');
      const result = await manualDigest('hourly');

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('skips users with no unsent notifications', async () => {
      const { isEmailConfigured, sendDigestEmail } = await import('../emailService');
      const { getUsersWithPendingDigest, getUnsentNotifications } = await import(
        '../notificationService'
      );

      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getUsersWithPendingDigest).mockResolvedValue([
        { userId: 'user-1', email: 'user1@example.com' },
      ]);
      vi.mocked(getUnsentNotifications).mockResolvedValue([]);

      const { manualDigest } = await import('../emailDigestService');
      const result = await manualDigest('weekly');

      expect(sendDigestEmail).not.toHaveBeenCalled();
      expect(result.sent).toBe(0);
    });
  });
});
