import { test, expect } from '@playwright/test';

test.describe('Simulation Requests', () => {
  test.beforeEach(async ({ page }) => {
    // Tests automatically start with authenticated session from global setup
    // Navigate to home page and wait for full load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load - if login page appears, the session may have expired
    const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
    const loginHeading = page.getByRole('heading', { name: 'SimRQ' });

    // Wait for either dashboard or login to appear
    await Promise.race([
      dashboardHeading.waitFor({ timeout: 15000 }),
      loginHeading.waitFor({ timeout: 15000 }),
    ]).catch(() => {
      // Neither appeared in time
    });

    // If login page is visible, skip the test
    if (await loginHeading.isVisible().catch(() => false)) {
      test.skip(true, 'Session expired - login page visible');
      return;
    }

    // Verify dashboard is visible
    await expect(dashboardHeading).toBeVisible({ timeout: 5000 });
  });

  test('should display requests list', async ({ page }) => {
    // Navigate to requests page (use .first() to get sidebar link)
    await page.getByRole('link', { name: /requests/i }).first().click();

    // Should see the requests page heading
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();
  });

  test('should view request from dashboard', async ({ page }) => {
    // Wait for Recent Activity heading to load
    await page.getByRole('heading', { name: 'Recent Activity' }).waitFor({ timeout: 10000 });

    // Wait for at least one request link to appear in Recent Activity (giving API time to respond)
    const firstRequestLink = page.locator('a[href^="/requests/"]').first();

    // Wait up to 10 seconds for requests to load
    const hasRequests = await firstRequestLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRequests) {
      test.skip(true, 'No requests in recent activity');
      return;
    }

    await firstRequestLink.click();

    // Should navigate to request detail page
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });
  });

  test('should navigate to requests and see list', async ({ page }) => {
    // Navigate to requests page (use .first() to get sidebar link)
    await page.getByRole('link', { name: /requests/i }).first().click();

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();

    // Should see Active Requests section heading (use specific selector to avoid matching "No active requests")
    await expect(page.getByRole('heading', { name: /^Active Requests \(\d+\)$/ })).toBeVisible();
  });

  test('should see request status badges', async ({ page }) => {
    // Navigate to requests page (use .first() to get sidebar link)
    await page.getByRole('link', { name: /requests/i }).first().click();

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();

    // Look for the Active Requests section heading (use specific selector)
    const activeRequestsHeading = page.getByRole('heading', { name: /^Active Requests \(\d+\)$/ });
    await expect(activeRequestsHeading).toBeVisible();

    // Extract the count from the heading to determine if we should have requests
    const headingText = await activeRequestsHeading.textContent();
    const count = parseInt(headingText?.match(/\((\d+)\)/)?.[1] || '0');

    if (count > 0) {
      // If there are requests, verify we can see status badges
      // Look for status badge spans (they have specific styling and contain status text)
      const statusBadge = page.locator('span.px-2\\.5.py-0\\.5.rounded-full').first();
      await expect(statusBadge).toBeVisible({ timeout: 5000 });

      // Also verify the badge contains valid status text
      const badgeText = await statusBadge.textContent();
      expect(badgeText).toMatch(/Manager Review|Engineering Review|In Progress|Completed|Submitted|Accepted|Discussion/);
    } else {
      // If no requests, verify the empty state message is shown
      await expect(page.getByText(/No active requests/i)).toBeVisible();
    }
  });
});
