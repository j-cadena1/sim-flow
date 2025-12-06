import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for login form to be visible
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });

    await page.locator('#email').fill('qadmin@simflow.local');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/#\/?$/);
  });

  test('should navigate to Requests', async ({ page }) => {
    await page.getByRole('link', { name: /requests/i }).click();
    await expect(page).toHaveURL(/\/#\/requests/);
    // Look for the main page heading specifically
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
  });

  test('should navigate to Projects', async ({ page }) => {
    await page.getByRole('link', { name: /projects/i }).click();
    await expect(page).toHaveURL(/\/#\/projects/);
  });

  test('should navigate to Analytics', async ({ page }) => {
    await page.getByRole('link', { name: /analytics/i }).click();
    await expect(page).toHaveURL(/\/#\/analytics/);
  });

  test('should navigate to Settings (Admin only)', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/#\/settings/);
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('should toggle dark/light mode', async ({ page }) => {
    // Find the theme toggle button (text is "Light Mode", "Dark Mode", or "System")
    const themeButton = page.getByRole('button', { name: /Light Mode|Dark Mode|System/i });

    // Get the initial button text
    const initialText = await themeButton.textContent();

    // Click to toggle theme
    await themeButton.click();

    // Wait a moment for theme to apply
    await page.waitForTimeout(500);

    // Get the new button text - it should have changed
    const newText = await themeButton.textContent();
    expect(newText).not.toBe(initialText);
  });
});
