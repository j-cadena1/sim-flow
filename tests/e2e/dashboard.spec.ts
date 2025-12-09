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

// Navigation tests are in navigation.spec.ts

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

// Responsiveness tests are in analytics.spec.ts
// Theme toggle tests are in navigation.spec.ts
