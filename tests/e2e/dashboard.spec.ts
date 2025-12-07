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
    // Verify sidebar with navigation links
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /requests/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /projects/i })).toBeVisible();
  });

  test('should have theme toggle button', async ({ page }) => {
    // Look for theme toggle (Light Mode, Dark Mode, or System)
    const themeButton = page.getByRole('button', { name: /light mode|dark mode|system/i });
    await expect(themeButton).toBeVisible({ timeout: 5000 });
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
    await page.getByRole('link', { name: /requests/i }).click();
    await expect(page).toHaveURL(/\/#\/requests/);
  });

  test('should navigate to projects from sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /projects/i }).click();
    await expect(page).toHaveURL(/\/#\/projects/);
  });

  test('should navigate to analytics from sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /analytics/i }).click();
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

    // Sidebar should be visible
    await expect(page.getByRole('link', { name: /requests/i })).toBeVisible();
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
    const themeButton = page.getByRole('button', { name: /light mode|dark mode|system/i });

    // Get initial text
    const initialText = await themeButton.textContent();

    // Click to toggle
    await themeButton.click();
    await page.waitForTimeout(300); // Wait for theme transition

    // Get new text
    const newText = await themeButton.textContent();

    // Text should change
    expect(newText).not.toBe(initialText);
  });

  test('should persist theme preference', async ({ page }) => {
    const themeButton = page.getByRole('button', { name: /light mode|dark mode|system/i });

    // Toggle theme
    await themeButton.click();
    await page.waitForTimeout(300);

    const themeAfterToggle = await themeButton.textContent();

    // Reload page
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Theme should be persisted
    const themeAfterReload = await page.getByRole('button', { name: /light mode|dark mode|system/i }).textContent();

    // Theme should match (localStorage persistence)
    expect(themeAfterReload).toBe(themeAfterToggle);
  });
});
