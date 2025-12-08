import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Tests automatically start with authenticated session from global setup
    // Just navigate to home page to begin
    await page.goto('/');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/#\/?$/);
  });

  test('should navigate to Requests', async ({ page }) => {
    // Use .first() to get sidebar link, not dashboard quick action
    await page.getByRole('link', { name: /requests/i }).first().click();
    await expect(page).toHaveURL(/\/#\/requests/);
    // Look for the main page heading specifically
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
  });

  test('should navigate to Projects', async ({ page }) => {
    // Click the sidebar link (first one), not the dashboard quick action
    await page.getByRole('link', { name: /projects/i }).first().click();
    await expect(page).toHaveURL(/\/#\/projects/);
  });

  test('should navigate to Analytics', async ({ page }) => {
    // Click the sidebar link (first one), not the dashboard quick action
    await page.getByRole('link', { name: /analytics/i }).first().click();
    await expect(page).toHaveURL(/\/#\/analytics/);
  });

  test('should navigate to Settings (Admin only)', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/#\/settings/);
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('should toggle dark/light mode', async ({ page }) => {
    // Find the theme slider buttons by their titles
    const lightButton = page.getByRole('button', { name: 'Light mode' });
    const darkButton = page.getByRole('button', { name: 'Dark mode' });
    const systemButton = page.getByRole('button', { name: 'System preference' });

    // All three buttons should be visible
    await expect(lightButton).toBeVisible();
    await expect(darkButton).toBeVisible();
    await expect(systemButton).toBeVisible();

    // Click dark mode
    await darkButton.click();
    await page.waitForTimeout(300);

    // Verify dark mode is applied (html element should have 'dark' class)
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');

    // Click light mode
    await lightButton.click();
    await page.waitForTimeout(300);

    // Verify light mode is applied (html should not have 'dark' class)
    const htmlClassAfter = await page.locator('html').getAttribute('class');
    expect(htmlClassAfter).not.toContain('dark');
  });
});
