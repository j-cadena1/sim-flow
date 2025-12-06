import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should display login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should see the login form - Sim-Flow heading
    await expect(page.getByRole('heading', { name: 'Sim-Flow' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for form to appear
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });

    // Fill in wrong credentials
    await page.locator('#email').fill('wrong@email.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should show error message - wait for it to appear after the request completes
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for form to appear
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });

    // Fill in valid credentials
    await page.locator('#email').fill('qadmin@simflow.local');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should redirect to dashboard - look for the dashboard heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // User name should be visible in sidebar
    await expect(page.getByText('qAdmin')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });

    await page.locator('#email').fill('qadmin@simflow.local');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Wait for dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Find and click Sign Out button (in sidebar)
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Should redirect back to login
    await expect(page.getByRole('heading', { name: 'Sim-Flow' })).toBeVisible({ timeout: 10000 });
  });
});
