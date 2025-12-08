import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsManager, loginAsEngineer, TEST_USERS, logout } from '../helpers/auth';

/**
 * Role-Based Access Control E2E Tests
 *
 * Tests that verify each role can authenticate and has appropriate
 * access to features based on their permission level.
 */

test.describe('Role-Based Access Control', () => {
  // These tests need to start without auth state to test different user logins
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test.describe('Admin Role', () => {
    test('should login as admin and access all features', async ({ page }) => {
      await loginAsAdmin(page);

      // Should see Dashboard
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Should have access to Settings (admin-only)
      await page.getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/\/#\/settings/);
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

      // Verify we're on the Settings page (admin-specific access confirmed)
    });

    test('should display admin user info correctly', async ({ page }) => {
      await loginAsAdmin(page);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Check user name is displayed (might be in sidebar or header)
      const userName = TEST_USERS.admin.name;
      await expect(page.getByText(userName)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Manager Role', () => {
    test('should login as manager and access dashboard', async ({ page }) => {
      await loginAsManager(page);

      // Should see Dashboard
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Manager should see their name
      const userName = TEST_USERS.manager.name;
      await expect(page.getByText(userName)).toBeVisible({ timeout: 10000 });
    });

    test('manager can access Settings but sees limited tabs', async ({ page }) => {
      await loginAsManager(page);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Settings link IS visible to all users (for Sessions and Notification preferences)
      const settingsLink = page.getByRole('link', { name: /settings/i });
      await expect(settingsLink).toBeVisible();

      // Click to navigate to settings
      await settingsLink.click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 5000 });

      // Manager should see Sessions and Notifications tabs but NOT admin tabs
      await expect(page.getByRole('button', { name: /sessions/i })).toBeVisible();
      // Use getByText for Notifications tab to avoid conflict with notification bell icon
      await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

      // Admin-only tabs should NOT be visible
      await expect(page.getByText('User Management')).not.toBeVisible();
      await expect(page.getByText('Audit Log')).not.toBeVisible();
    });

    test('should have access to Projects as manager', async ({ page }) => {
      await loginAsManager(page);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Navigate to Projects (click sidebar link, not dashboard quick action)
      await page.getByRole('link', { name: /projects/i }).first().click();
      await expect(page).toHaveURL(/\/#\/projects/);
    });

    test('should have access to Requests as manager', async ({ page }) => {
      await loginAsManager(page);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Navigate to Requests (use .first() to get sidebar link)
      await page.getByRole('link', { name: /requests/i }).first().click();
      await expect(page).toHaveURL(/\/#\/requests/);
      await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
    });
  });

  test.describe('Engineer Role', () => {
    test('should login as engineer and access dashboard', async ({ page }) => {
      await loginAsEngineer(page);

      // Should see Dashboard
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Engineer should see their name
      const userName = TEST_USERS.engineer.name;
      await expect(page.getByText(userName)).toBeVisible({ timeout: 10000 });
    });

    test('engineer can access Settings but sees limited tabs', async ({ page }) => {
      await loginAsEngineer(page);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Settings link IS visible to all users (for Sessions and Notification preferences)
      const settingsLink = page.getByRole('link', { name: /settings/i });
      await expect(settingsLink).toBeVisible();

      // Click to navigate to settings
      await settingsLink.click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 5000 });

      // Engineer should see Sessions and Notifications tabs but NOT admin tabs
      await expect(page.getByRole('button', { name: /sessions/i })).toBeVisible();
      // Use getByText for Notifications tab to avoid conflict with notification bell icon
      await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

      // Admin-only tabs should NOT be visible
      await expect(page.getByText('User Management')).not.toBeVisible();
      await expect(page.getByText('Audit Log')).not.toBeVisible();
    });

    test('should have access to assigned requests as engineer', async ({ page }) => {
      await loginAsEngineer(page);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Navigate to Requests (use .first() to get sidebar link)
      await page.getByRole('link', { name: /requests/i }).first().click();
      await expect(page).toHaveURL(/\/#\/requests/);
      await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
    });
  });

  test.describe('User Role', () => {
    test('should login as user and access dashboard', async ({ page }) => {
      // Use authenticateUser directly for user role
      const { authenticateUser } = await import('../helpers/auth');
      await authenticateUser(page, TEST_USERS.user);

      // Should see Dashboard
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // User should see their name
      const userName = TEST_USERS.user.name;
      await expect(page.getByText(userName)).toBeVisible({ timeout: 10000 });
    });

    test('user can access Settings but sees limited tabs', async ({ page }) => {
      const { authenticateUser } = await import('../helpers/auth');
      await authenticateUser(page, TEST_USERS.user);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Settings link IS visible to all users (for Sessions and Notification preferences)
      const settingsLink = page.getByRole('link', { name: /settings/i });
      await expect(settingsLink).toBeVisible();

      // Click to navigate to settings
      await settingsLink.click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 5000 });

      // End-User should see Sessions and Notifications tabs but NOT admin tabs
      await expect(page.getByRole('button', { name: /sessions/i })).toBeVisible();
      // Use getByText for Notifications tab to avoid conflict with notification bell icon
      await expect(page.getByText('Notifications', { exact: true })).toBeVisible();

      // Admin-only tabs should NOT be visible
      await expect(page.getByText('User Management')).not.toBeVisible();
      await expect(page.getByText('Audit Log')).not.toBeVisible();
    });

    test('should have access to Requests as user', async ({ page }) => {
      const { authenticateUser } = await import('../helpers/auth');
      await authenticateUser(page, TEST_USERS.user);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Navigate to Requests (use .first() to get sidebar link)
      await page.getByRole('link', { name: /requests/i }).first().click();
      await expect(page).toHaveURL(/\/#\/requests/);
      await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('should allow logout and re-login with different user', async ({ page }) => {
      // Login as admin
      await loginAsAdmin(page);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(TEST_USERS.admin.name)).toBeVisible({ timeout: 10000 });

      // Logout
      await logout(page);

      // Should be back at login page
      await expect(page.getByRole('heading', { name: 'SimRQ' })).toBeVisible({ timeout: 10000 });

      // Login as manager
      await loginAsManager(page);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(TEST_USERS.manager.name)).toBeVisible({ timeout: 10000 });
    });
  });
});
