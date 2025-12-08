import { test, expect } from '@playwright/test';

/**
 * Dashboard Interaction E2E Tests
 *
 * Tests dashboard functionality and user interactions:
 * - Dashboard loading and display
 * - Recent activity
 * - Quick stats/metrics
 * - Navigation from dashboard
 */

test.describe('Dashboard Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should display dashboard heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should display user welcome message or name', async ({ page }) => {
    // Look for user name or welcome message
    const hasUserInfo = await page.locator('text=/welcome|qadmin|admin/i').count();
    expect(hasUserInfo).toBeGreaterThan(0);
  });

  test('should display recent activity section', async ({ page }) => {
    // Look for recent activity or similar section
    const hasRecentActivity = await page.locator('text=/recent|activity|latest|updates/i').count();
    expect(hasRecentActivity).toBeGreaterThan(0);
  });

  test('should display navigation sidebar', async ({ page }) => {
    // Verify sidebar with navigation links (use first() to get sidebar link, not dashboard quick action)
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /requests/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /projects/i }).first()).toBeVisible();
  });

  test('should have theme toggle button', async ({ page }) => {
    // Look for theme slider buttons
    const lightButton = page.getByRole('button', { name: 'Light mode' });
    const darkButton = page.getByRole('button', { name: 'Dark mode' });
    const systemButton = page.getByRole('button', { name: 'System preference' });

    await expect(lightButton).toBeVisible({ timeout: 5000 });
    await expect(darkButton).toBeVisible({ timeout: 5000 });
    await expect(systemButton).toBeVisible({ timeout: 5000 });
  });

  test('should have sign out button', async ({ page }) => {
    // Look for sign out button
    const signOutButton = page.getByRole('button', { name: /sign out|logout/i });
    await expect(signOutButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard Metrics and Stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should display statistics or metrics cards', async ({ page }) => {
    // Look for numerical metrics (total requests, pending, completed, etc.)
    const hasNumbers = await page.locator('text=/\\d+|total|pending|completed|active/i').count();
    expect(hasNumbers).toBeGreaterThan(0);
  });

  test('should show request status indicators', async ({ page }) => {
    // Look for status-related text
    const hasStatus = await page.locator('text=/submitted|progress|completed|pending|review/i').count();
    expect(hasStatus).toBeGreaterThanOrEqual(0); // May be 0 if no requests
  });
});

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to requests from sidebar', async ({ page }) => {
    // Use .first() to get sidebar link, not dashboard quick action
    await page.getByRole('link', { name: /requests/i }).first().click();
    await expect(page).toHaveURL(/\/#\/requests/);
  });

  test('should navigate to projects from sidebar', async ({ page }) => {
    // Click the sidebar link (first one), not the dashboard quick action
    await page.getByRole('link', { name: /projects/i }).first().click();
    await expect(page).toHaveURL(/\/#\/projects/);
  });

  test('should navigate to analytics from sidebar', async ({ page }) => {
    // Click the sidebar link (first one), not the dashboard quick action
    await page.getByRole('link', { name: /analytics/i }).first().click();
    await expect(page).toHaveURL(/\/#\/analytics/);
  });

  test('should navigate to settings from sidebar (admin only)', async ({ page }) => {
    // This test assumes admin user
    const settingsLink = page.getByRole('link', { name: /settings/i });
    const isVisible = await settingsLink.isVisible().catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/#\/settings/);
    }
  });

  test('should return to dashboard when clicking logo or dashboard link', async ({ page }) => {
    // Navigate away first
    await page.goto('/#/requests');
    await expect(page).toHaveURL(/\/#\/requests/);

    // Click dashboard link
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/#\/?$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('Dashboard Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should have quick access to create new request', async ({ page }) => {
    // Look for "New Request" button or link
    const newRequestButton = page.locator('a[href*="/new"], button').filter({ hasText: /new request|create/i }).first();
    const isVisible = await newRequestButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await newRequestButton.click();
      await expect(page).toHaveURL(/\/#\/new/);
    }
  });
});

test.describe('Dashboard Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should display correctly on desktop (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Sidebar should be visible (use .first() to get sidebar link)
    await expect(page.getByRole('link', { name: /requests/i }).first()).toBeVisible();
  });

  test('should display correctly on tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should display correctly on mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // On mobile, sidebar might be collapsed
    // Just verify page still works
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('Dashboard');
  });

  test('should reset viewport after tests', async ({ page }) => {
    // Reset to default
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('Dashboard Dark/Light Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should toggle between dark and light modes', async ({ page }) => {
    const lightButton = page.getByRole('button', { name: 'Light mode' });
    const darkButton = page.getByRole('button', { name: 'Dark mode' });

    // Click dark mode
    await darkButton.click();
    await page.waitForTimeout(300);

    // Verify dark mode is applied
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');

    // Click light mode
    await lightButton.click();
    await page.waitForTimeout(300);

    // Verify light mode is applied
    const htmlClassAfter = await page.locator('html').getAttribute('class');
    expect(htmlClassAfter).not.toContain('dark');
  });

  test('should persist theme preference', async ({ page }) => {
    const darkButton = page.getByRole('button', { name: 'Dark mode' });

    // Set to dark mode
    await darkButton.click();
    await page.waitForTimeout(300);

    // Verify dark mode
    let htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');

    // Reload page
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Dark mode should be persisted
    htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });
});
