import { test, expect } from '@playwright/test';

test.describe('Simulation Requests', () => {
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

  test('should display requests list', async ({ page }) => {
    // Navigate to requests page
    await page.getByRole('link', { name: /requests/i }).click();

    // Should see the requests page heading
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
  });

  test('should view request from dashboard', async ({ page }) => {
    // Click on a request in Recent Activity on dashboard
    await page.getByText('Test Project for Engineering Discussion').click();

    // Should see request details - look for status or priority labels
    await expect(page.getByText(/status|priority/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to requests and see list', async ({ page }) => {
    // Navigate to requests page
    await page.getByRole('link', { name: /requests/i }).click();

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();

    // Should see Active Requests section
    await expect(page.getByText(/Active Requests/i)).toBeVisible();
  });

  test('should see request status badges', async ({ page }) => {
    // Navigate to requests page
    await page.getByRole('link', { name: /requests/i }).click();

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();

    // Look for the Active Requests section which confirms data has loaded
    await expect(page.getByText(/Active Requests/i)).toBeVisible();

    // Page should contain request cards/items
    await expect(page.locator('article, [role="article"], .request-card, .cursor-pointer').first()).toBeVisible({ timeout: 5000 });
  });
});
