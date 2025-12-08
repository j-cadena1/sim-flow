/**
 * Unit Tests for Notification Service
 *
 * Tests core notification business logic without requiring a running database.
 * These tests use mocks to isolate the service layer.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as notificationService from '../notificationService';

// Mock the database pool
vi.mock('../../db', () => ({
  default: {
    query: vi.fn(),
  },
}));

// Mock the case converter utilities
vi.mock('../../utils/caseConverter', () => ({
  toCamelCase: vi.fn((obj: any) => obj),
  toSnakeCase: vi.fn((obj: any) => obj),
}));

import pool from '../../db';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotification', () => {
    test('should create a notification with all parameters', async () => {
      const mockNotification = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: 'user-123',
        type: 'REQUEST_ASSIGNED',
        title: 'New Request Assigned',
        message: 'You have been assigned to a new request',
        link: '/requests/456',
        read: false,
        created_at: new Date(),
        entity_type: 'Request',
        entity_id: '456',
        triggered_by: 'manager-123',
      };

      (pool.query as any).mockResolvedValue({
        rows: [mockNotification],
      });

      const result = await notificationService.createNotification({
        userId: 'user-123',
        type: 'REQUEST_ASSIGNED',
        title: 'New Request Assigned',
        message: 'You have been assigned to a new request',
        link: '/requests/456',
        entityType: 'Request',
        entityId: '456',
        triggeredBy: 'manager-123',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'user-123',
          'REQUEST_ASSIGNED',
          'New Request Assigned',
          'You have been assigned to a new request',
          '/requests/456',
          'Request',
          '456',
          'manager-123',
        ])
      );

      expect(result).toEqual(mockNotification);
    });

    test('should create a notification with minimal parameters', async () => {
      const mockNotification = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        user_id: 'user-123',
        type: 'ADMIN_ACTION',
        title: 'Admin Notice',
        message: 'Your account has been updated',
        read: false,
        created_at: new Date(),
      };

      (pool.query as any).mockResolvedValue({
        rows: [mockNotification],
      });

      const result = await notificationService.createNotification({
        userId: 'user-123',
        type: 'ADMIN_ACTION',
        title: 'Admin Notice',
        message: 'Your account has been updated',
      });

      expect(result).toEqual(mockNotification);
    });
  });

  describe('createNotificationForMultipleUsers', () => {
    test('should create notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      (pool.query as any).mockResolvedValue({ rows: [] });

      await notificationService.createNotificationForMultipleUsers(userIds, {
        type: 'PROJECT_UPDATED',
        title: 'Project Status Changed',
        message: 'Project X has been updated',
        link: '/projects/789',
        entityType: 'Project',
        entityId: '789',
        triggeredBy: 'admin-123',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'user-1',
          'PROJECT_UPDATED',
          'Project Status Changed',
          'Project X has been updated',
          '/projects/789',
          'Project',
          '789',
          'admin-123',
          'user-2',
          'PROJECT_UPDATED',
          'Project Status Changed',
          'Project X has been updated',
          '/projects/789',
          'Project',
          '789',
          'admin-123',
          'user-3',
          'PROJECT_UPDATED',
          'Project Status Changed',
          'Project X has been updated',
          '/projects/789',
          'Project',
          '789',
          'admin-123',
        ])
      );
    });

    test('should handle empty user list gracefully', async () => {
      await notificationService.createNotificationForMultipleUsers([], {
        type: 'PROJECT_UPDATED',
        title: 'Test',
        message: 'Test',
      });

      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    test('should fetch notifications with default parameters', async () => {
      const mockNotifications = [
        {
          id: '1',
          user_id: 'user-123',
          type: 'REQUEST_ASSIGNED',
          title: 'Test',
          message: 'Test message',
          read: false,
          created_at: new Date(),
          triggered_by_name: 'John Doe',
        },
      ];

      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockNotifications });

      const result = await notificationService.getNotifications({
        userId: 'user-123',
      });

      expect(result.total).toBe(1);
      expect(result.notifications).toEqual(mockNotifications);
    });

    test('should filter by unread only', async () => {
      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications({
        userId: 'user-123',
        unreadOnly: true,
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('n.read = $2'),
        expect.arrayContaining(['user-123', false])
      );
    });

    test('should filter by notification type', async () => {
      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications({
        userId: 'user-123',
        type: 'REQUEST_ASSIGNED',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('n.type = $2'),
        expect.arrayContaining(['user-123', 'REQUEST_ASSIGNED'])
      );
    });

    test('should support pagination', async () => {
      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications({
        userId: 'user-123',
        limit: 20,
        offset: 40,
      });

      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([20, 40])
      );
    });
  });

  describe('getUnreadCount', () => {
    test('should return unread count', async () => {
      (pool.query as any).mockResolvedValue({
        rows: [{ count: '7' }],
      });

      const count = await notificationService.getUnreadCount('user-123');

      expect(count).toBe(7);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['user-123']
      );
    });
  });

  describe('markAsRead', () => {
    test('should mark notification as read', async () => {
      (pool.query as any).mockResolvedValue({ rows: [] });

      await notificationService.markAsRead('notif-123', 'user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET read = true'),
        ['notif-123', 'user-123']
      );
    });
  });

  describe('markAllAsRead', () => {
    test('should mark all notifications as read for user', async () => {
      (pool.query as any).mockResolvedValue({ rows: [] });

      await notificationService.markAllAsRead('user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET read = true WHERE user_id = $1'),
        ['user-123']
      );
    });
  });

  describe('deleteNotification', () => {
    test('should delete a specific notification', async () => {
      (pool.query as any).mockResolvedValue({ rows: [] });

      await notificationService.deleteNotification('notif-123', 'user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications WHERE id = $1 AND user_id = $2'),
        ['notif-123', 'user-123']
      );
    });
  });

  describe('deleteAllNotifications', () => {
    test('should delete all notifications for user', async () => {
      (pool.query as any).mockResolvedValue({ rows: [] });

      await notificationService.deleteAllNotifications('user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications WHERE user_id = $1'),
        ['user-123']
      );
    });
  });

  describe('getPreferences', () => {
    test('should return existing preferences', async () => {
      const mockPrefs = {
        user_id: 'user-123',
        in_app_enabled: true,
        email_enabled: false,
        email_digest_frequency: 'instant',
        request_assigned: true,
        request_status_changed: true,
        request_comment_added: true,
        approval_needed: true,
        time_logged: false,
        project_updated: true,
        admin_action: true,
        retention_days: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (pool.query as any).mockResolvedValue({
        rows: [mockPrefs],
      });

      const result = await notificationService.getPreferences('user-123');

      expect(result).toEqual(mockPrefs);
    });

    test('should create default preferences if none exist', async () => {
      const mockDefaultPrefs = {
        user_id: 'user-123',
        in_app_enabled: true,
        email_enabled: false,
        retention_days: 30,
      };

      (pool.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockDefaultPrefs] });

      const result = await notificationService.getPreferences('user-123');

      expect(result).toEqual(mockDefaultPrefs);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notification_preferences'),
        ['user-123']
      );
    });
  });

  describe('updatePreferences', () => {
    test('should update notification preferences', async () => {
      const mockUpdatedPrefs = {
        user_id: 'user-123',
        in_app_enabled: false,
        email_enabled: true,
        retention_days: 60,
      };

      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [mockUpdatedPrefs] });

      const result = await notificationService.updatePreferences('user-123', {
        inAppEnabled: false,
        emailEnabled: true,
        retentionDays: 60,
      });

      expect(result).toEqual(mockUpdatedPrefs);
    });

    test('should handle empty updates', async () => {
      const mockPrefs = {
        user_id: 'user-123',
        in_app_enabled: true,
      };

      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [mockPrefs] });

      const result = await notificationService.updatePreferences('user-123', {});

      expect(result).toEqual(mockPrefs);
    });
  });

  describe('shouldNotify', () => {
    test('should return false if in-app notifications disabled', async () => {
      // Mock getPreferences returning disabled in_app
      // The mock toCamelCase returns the object as-is, so we need camelCase keys
      (pool.query as any).mockResolvedValue({
        rows: [{ inAppEnabled: false }],
      });

      const result = await notificationService.shouldNotify('user-123', 'REQUEST_ASSIGNED');

      expect(result).toBe(false);
    });

    test('should check specific preference field', async () => {
      // shouldNotify calls getPreferences, which returns camelCase after transformation
      // Since we mock toCamelCase to return the object as-is, we need to provide camelCase keys
      const mockPrefs = {
        inAppEnabled: true,
        requestAssigned: true,
        requestStatusChanged: false,
      };

      (pool.query as any).mockResolvedValue({
        rows: [mockPrefs],
      });

      const result1 = await notificationService.shouldNotify('user-123', 'REQUEST_ASSIGNED');
      expect(result1).toBe(true);

      // Reset mock for second call
      (pool.query as any).mockResolvedValue({
        rows: [mockPrefs],
      });

      const result2 = await notificationService.shouldNotify('user-123', 'REQUEST_STATUS_CHANGED');
      expect(result2).toBe(false);
    });

    test('should default to true for unmapped notification types', async () => {
      // Provide camelCase since mock toCamelCase returns object as-is
      (pool.query as any).mockResolvedValue({
        rows: [{ inAppEnabled: true }],
      });

      const result = await notificationService.shouldNotify('user-123', 'UNMAPPED_TYPE' as any);

      expect(result).toBe(true);
    });
  });

  describe('cleanupOldNotifications', () => {
    test('should delete old read notifications based on retention policy', async () => {
      (pool.query as any).mockResolvedValue({
        rowCount: 15,
      });

      const deletedCount = await notificationService.cleanupOldNotifications();

      expect(deletedCount).toBe(15);
      // The query doesn't take any parameters
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications')
      );
    });

    test('should return 0 if no notifications deleted', async () => {
      (pool.query as any).mockResolvedValue({
        rowCount: 0,
      });

      const deletedCount = await notificationService.cleanupOldNotifications();

      expect(deletedCount).toBe(0);
    });
  });
});
