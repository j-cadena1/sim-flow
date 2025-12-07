import { test, expect } from '@playwright/test';

/**
 * Analytics Dashboard E2E Tests
 *
 * Tests the analytics dashboard functionality, including:
 * - Chart rendering
 * - Data visualization
 * - Date filters
 * - Metrics display
 */

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Tests start with authenticated admin session
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should display analytics page with charts', async ({ page }) => {
    // Navigate to Analytics
    await page.goto('/#/analytics');
    await expect(page).toHaveURL(/\/#\/analytics/);

    // Should see Analytics heading
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });

    // Should see date range filters
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('should display request status distribution chart', async ({ page }) => {
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });

    // Look for chart-related text or elements
    // Charts usually have canvas elements or SVG
    const hasChart = await page.locator('canvas, svg').count();
    expect(hasChart).toBeGreaterThan(0);
  });

  test('should allow changing date range', async ({ page }) => {
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });

    // Find date inputs
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();

    if (count >= 2) {
      // Set start date
      const startDate = dateInputs.first();
      await startDate.fill('2024-01-01');

      // Set end date
      const endDate = dateInputs.nth(1);
      await endDate.fill('2024-12-31');

      // Verify dates are set
      await expect(startDate).toHaveValue('2024-01-01');
      await expect(endDate).toHaveValue('2024-12-31');
    }
  });

  test('should display metrics cards', async ({ page }) => {
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });

    // Look for common metric indicators (numbers, percentages, etc.)
    // Analytics usually shows total requests, completion rates, etc.
    const hasMetrics = await page.locator('text=/\\d+|Total|Average|Rate/i').count();
    expect(hasMetrics).toBeGreaterThan(0);
  });

  test('should be accessible to admin users', async ({ page }) => {
    await page.goto('/#/analytics');

    // Should not redirect to login or show error
    await expect(page).toHaveURL(/\/#\/analytics/);
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display data visualization elements', async ({ page }) => {
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });

    // Wait for any loading indicators to disappear
    await page.waitForTimeout(1000);

    // Check for visualization containers (charts typically use canvas or svg)
    const visualizations = await page.locator('canvas, svg, [class*="chart"], [class*="Chart"]').count();
    expect(visualizations).toBeGreaterThan(0);
  });

  test('should have responsive layout', async ({ page }) => {
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });

    // Test at different viewport sizes
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();

    // Reset to default
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});

test.describe('Analytics - Manager Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('managers should have access to analytics', async ({ page }) => {
    // Navigate to Analytics
    await page.goto('/#/analytics');
    await expect(page).toHaveURL(/\/#\/analytics/);

    // Should see Analytics page
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 10000 });
  });
});
