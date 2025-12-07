import { test, expect } from '@playwright/test';

test.describe('Simulation Requests', () => {
  test.beforeEach(async ({ page }) => {
    // Tests automatically start with authenticated session from global setup
    // Just navigate to home page to begin
    await page.goto('/');

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
    // Look for Recent Activity section and click the first request link
    const recentActivity = page.locator('text=Recent Activity').locator('..');
    const firstRequestLink = recentActivity.locator('a[href^="/requests/"]').first();

    // If no requests in recent activity, skip this test
    const hasRequests = await firstRequestLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRequests) {
      test.skip(true, 'No requests in recent activity');
      return;
    }

    await firstRequestLink.click();

    // Should navigate to request detail page
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });
  });

  test('should navigate to requests and see list', async ({ page }) => {
    // Navigate to requests page
    await page.getByRole('link', { name: /requests/i }).click();

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible();

    // Should see Active Requests section heading (use specific selector to avoid matching "No active requests")
    await expect(page.getByRole('heading', { name: /^Active Requests \(\d+\)$/ })).toBeVisible();
  });

  test('should see request status badges', async ({ page }) => {
    // Navigate to requests page
    await page.getByRole('link', { name: /requests/i }).click();

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
      expect(badgeText).toMatch(/Feasibility Review|Resource Allocation|Engineering Review|In Progress|Completed|Submitted|Accepted|Discussion/);
    } else {
      // If no requests, verify the empty state message is shown
      await expect(page.getByText(/No active requests/i)).toBeVisible();
    }
  });
});
