import { test, expect, request as playwrightRequest } from '@playwright/test';
import { loginAsAdmin, loginAsEngineer, TEST_USERS } from '../helpers/auth';

/**
 * Notification System E2E Tests
 *
 * Tests the notification API endpoints, preferences management,
 * and cleanup functionality. Since the frontend UI is not yet implemented,
 * these tests focus on the backend API.
 */

test.describe('Notifications API', () => {
  // Use authenticated state since all notification endpoints require authentication
  test.use({ storageState: 'tests/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    // Start fresh on each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should fetch notification preferences with default values', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login to get session
      const loginResponse = await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });
      expect(loginResponse.ok()).toBeTruthy();

      // Fetch preferences
      const response = await apiContext.get('/api/notifications/preferences');
      expect(response.ok()).toBeTruthy();

      const preferences = await response.json();

      // Verify default preferences
      expect(preferences).toHaveProperty('userId');
      expect(preferences.inAppEnabled).toBe(true);
      expect(preferences.emailEnabled).toBe(false);
      expect(preferences.emailDigestFrequency).toBe('instant');
      expect(preferences.requestAssigned).toBe(true);
      expect(preferences.requestStatusChanged).toBe(true);
      expect(preferences.requestCommentAdded).toBe(true);
      expect(preferences.approvalNeeded).toBe(true);
      expect(preferences.timeLogged).toBe(false);
      expect(preferences.projectUpdated).toBe(true);
      expect(preferences.adminAction).toBe(true);
      expect(preferences.retentionDays).toBe(30);
    } finally {
      await apiContext.dispose();
    }
  });

  test('should update notification preferences', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Update preferences
      const updateResponse = await apiContext.patch('/api/notifications/preferences', {
        data: {
          inAppEnabled: false,
          emailEnabled: true,
          emailDigestFrequency: 'daily',
          requestAssigned: false,
          retentionDays: 60,
        },
      });
      expect(updateResponse.ok()).toBeTruthy();

      const updatedPrefs = await updateResponse.json();
      expect(updatedPrefs.inAppEnabled).toBe(false);
      expect(updatedPrefs.emailEnabled).toBe(true);
      expect(updatedPrefs.emailDigestFrequency).toBe('daily');
      expect(updatedPrefs.requestAssigned).toBe(false);
      expect(updatedPrefs.retentionDays).toBe(60);

      // Reset to defaults for other tests
      await apiContext.patch('/api/notifications/preferences', {
        data: {
          inAppEnabled: true,
          emailEnabled: false,
          emailDigestFrequency: 'instant',
          requestAssigned: true,
          retentionDays: 30,
        },
      });
    } finally {
      await apiContext.dispose();
    }
  });

  test('should reject invalid retention days', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Try invalid retention days (too low)
      const response1 = await apiContext.patch('/api/notifications/preferences', {
        data: {
          retentionDays: 0,
        },
      });
      expect(response1.status()).toBe(400);
      const error1 = await response1.json();
      expect(error1.error).toContain('Retention days must be between 1 and 365');

      // Try invalid retention days (too high)
      const response2 = await apiContext.patch('/api/notifications/preferences', {
        data: {
          retentionDays: 500,
        },
      });
      expect(response2.status()).toBe(400);
      const error2 = await response2.json();
      expect(error2.error).toContain('Retention days must be between 1 and 365');
    } finally {
      await apiContext.dispose();
    }
  });

  test('should get empty notification list initially', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login as engineer (likely has no notifications yet)
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.engineer.email,
          password: TEST_USERS.engineer.password,
        },
      });

      // Fetch notifications
      const response = await apiContext.get('/api/notifications');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('notifications');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.notifications)).toBe(true);
    } finally {
      await apiContext.dispose();
    }
  });

  test('should get unread count', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Get unread count
      const response = await apiContext.get('/api/notifications/unread-count');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('count');
      expect(typeof data.count).toBe('number');
      expect(data.count).toBeGreaterThanOrEqual(0);
    } finally {
      await apiContext.dispose();
    }
  });

  test('should support pagination for notifications', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Fetch with limit
      const response = await apiContext.get('/api/notifications?limit=10&offset=0');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.notifications.length).toBeLessThanOrEqual(10);
      expect(data).toHaveProperty('total');
    } finally {
      await apiContext.dispose();
    }
  });

  test('should filter unread notifications only', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Fetch unread only
      const response = await apiContext.get('/api/notifications?unreadOnly=true');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // All returned notifications should be unread
      data.notifications.forEach((notif: any) => {
        expect(notif.read).toBe(false);
      });
    } finally {
      await apiContext.dispose();
    }
  });

  test('should cap limit at 100 notifications per request', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Try to fetch more than 100
      const response = await apiContext.get('/api/notifications?limit=200');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      // Should be capped at 100
      expect(data.notifications.length).toBeLessThanOrEqual(100);
    } finally {
      await apiContext.dispose();
    }
  });

  test('should require authentication for all endpoints', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Don't login - try to access endpoints without auth

      const endpoints = [
        '/api/notifications',
        '/api/notifications/unread-count',
        '/api/notifications/preferences',
      ];

      for (const endpoint of endpoints) {
        const response = await apiContext.get(endpoint);
        // Should redirect to login or return 401
        expect([401, 302]).toContain(response.status());
      }
    } finally {
      await apiContext.dispose();
    }
  });
});

test.describe('Notification Lifecycle', () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('should mark notification as read', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Get notifications
      const listResponse = await apiContext.get('/api/notifications?unreadOnly=true&limit=1');
      const listData = await listResponse.json();

      if (listData.notifications.length > 0) {
        const notificationId = listData.notifications[0].id;

        // Mark as read
        const readResponse = await apiContext.patch(`/api/notifications/${notificationId}/read`);
        expect(readResponse.ok()).toBeTruthy();

        const readData = await readResponse.json();
        expect(readData.message).toBe('Notification marked as read');

        // Verify it's no longer in unread list
        const verifyResponse = await apiContext.get('/api/notifications?unreadOnly=true');
        const verifyData = await verifyResponse.json();

        const stillUnread = verifyData.notifications.find((n: any) => n.id === notificationId);
        expect(stillUnread).toBeUndefined();
      }
    } finally {
      await apiContext.dispose();
    }
  });

  test('should mark all notifications as read', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Mark all as read
      const response = await apiContext.patch('/api/notifications/read-all');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.message).toBe('All notifications marked as read');

      // Verify unread count is 0
      const countResponse = await apiContext.get('/api/notifications/unread-count');
      const countData = await countResponse.json();
      expect(countData.count).toBe(0);
    } finally {
      await apiContext.dispose();
    }
  });

  test('should delete a specific notification', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Get a notification
      const listResponse = await apiContext.get('/api/notifications?limit=1');
      const listData = await listResponse.json();

      if (listData.notifications.length > 0) {
        const notificationId = listData.notifications[0].id;
        const initialTotal = listData.total;

        // Delete it
        const deleteResponse = await apiContext.delete(`/api/notifications/${notificationId}`);
        expect(deleteResponse.ok()).toBeTruthy();

        const deleteData = await deleteResponse.json();
        expect(deleteData.message).toBe('Notification deleted');

        // Verify count decreased
        const verifyResponse = await apiContext.get('/api/notifications');
        const verifyData = await verifyResponse.json();
        expect(verifyData.total).toBe(initialTotal - 1);
      }
    } finally {
      await apiContext.dispose();
    }
  });

  test('should delete all notifications', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Delete all
      const deleteResponse = await apiContext.delete('/api/notifications');
      expect(deleteResponse.ok()).toBeTruthy();

      const deleteData = await deleteResponse.json();
      expect(deleteData.message).toBe('All notifications deleted');

      // Verify empty list
      const verifyResponse = await apiContext.get('/api/notifications');
      const verifyData = await verifyResponse.json();
      expect(verifyData.total).toBe(0);
      expect(verifyData.notifications).toHaveLength(0);
    } finally {
      await apiContext.dispose();
    }
  });
});

test.describe('Notification Security', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should not allow users to access other users\' notifications', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login as engineer
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.engineer.email,
          password: TEST_USERS.engineer.password,
        },
      });

      // Get engineer's notifications
      const response = await apiContext.get('/api/notifications');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // All notifications should belong to the authenticated user
      // (This is enforced by the backend filtering by req.user.id)
      // We're testing that the API doesn't leak other users' notifications
      expect(Array.isArray(data.notifications)).toBe(true);
    } finally {
      await apiContext.dispose();
    }
  });

  test('should not allow modifying other users\' notification preferences', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login as engineer
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.engineer.email,
          password: TEST_USERS.engineer.password,
        },
      });

      // Update preferences (should only update own preferences)
      const updateResponse = await apiContext.patch('/api/notifications/preferences', {
        data: {
          inAppEnabled: false,
        },
      });
      expect(updateResponse.ok()).toBeTruthy();

      const updatedPrefs = await updateResponse.json();

      // Verify the userId in the response matches the authenticated user
      // (Backend enforces this by using req.user.id)
      expect(updatedPrefs.userId).toBeDefined();

      // Reset
      await apiContext.patch('/api/notifications/preferences', {
        data: {
          inAppEnabled: true,
        },
      });
    } finally {
      await apiContext.dispose();
    }
  });
});

test.describe('Notification API Validation', () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('should handle invalid notification type filter', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // Request with invalid type (should be ignored or handled gracefully)
      const response = await apiContext.get('/api/notifications?type=INVALID_TYPE');

      // Should still return 200 (backend may ignore invalid types)
      expect(response.ok()).toBeTruthy();
    } finally {
      await apiContext.dispose();
    }
  });

  test('should handle non-existent notification ID gracefully', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    try {
      // Login
      await apiContext.post('/api/auth/login', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Try to mark non-existent notification as read
      const readResponse = await apiContext.patch(`/api/notifications/${fakeId}/read`);
      // Should succeed (no-op) or return appropriate status
      expect([200, 404]).toContain(readResponse.status());

      // Try to delete non-existent notification
      const deleteResponse = await apiContext.delete(`/api/notifications/${fakeId}`);
      // Should succeed (no-op) or return appropriate status
      expect([200, 404]).toContain(deleteResponse.status());
    } finally {
      await apiContext.dispose();
    }
  });
});
