import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsManager, loginAsEngineer, TEST_USERS, authenticateUser } from '../helpers/auth';

/**
 * Request CRUD E2E Tests
 *
 * Tests the full request lifecycle including:
 * - Creating new requests
 * - Viewing request details
 * - Editing requests
 * - Status transitions
 * - Comments and time tracking
 */

test.describe('Request Creation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should display new request form', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Verify all form fields are present
    await expect(page.locator('input[type="text"]').first()).toBeVisible(); // Title
    await expect(page.locator('textarea').first()).toBeVisible(); // Description
    await expect(page.locator('select').first()).toBeVisible(); // Project or vendor
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
  });

  test('admin can create request with all fields', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Fill title
    const titleInput = page.locator('input[type="text"]').first();
    const requestTitle = `E2E Test Request ${Date.now()}`;
    await titleInput.fill(requestTitle);

    // Fill description
    const descriptionInput = page.locator('textarea').first();
    await descriptionInput.fill('This is a test request created by E2E automation. It should be cleaned up after testing.');

    // Select vendor (if dropdown exists)
    const vendorSelect = page.locator('select').filter({ hasText: /fanuc|siemens|vendor/i }).first();
    if (await vendorSelect.isVisible().catch(() => false)) {
      const options = await vendorSelect.locator('option').count();
      if (options > 1) {
        await vendorSelect.selectOption({ index: 1 });
      }
    }

    // Select priority
    const prioritySelect = page.locator('select').filter({ hasText: /low|medium|high|priority/i }).first();
    if (await prioritySelect.isVisible().catch(() => false)) {
      await prioritySelect.selectOption('High');
    }

    // Wait for projects to load and select one
    await page.waitForTimeout(1000);
    const projectSelect = page.locator('select').last();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions <= 1) {
      test.skip(true, 'No active projects available for request creation');
      return;
    }

    await projectSelect.selectOption({ index: 1 });

    // Submit the form
    await page.getByRole('button', { name: /submit/i }).click();

    // Wait for navigation or success message
    await page.waitForTimeout(1500);

    // Should redirect to requests page or show success toast
    const redirected = await page.url().includes('/requests');
    const hasSuccessToast = await page.locator('text=/success|submitted|created/i').isVisible().catch(() => false);

    expect(redirected || hasSuccessToast).toBeTruthy();
  });

  test('manager can create request', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Verify form is accessible
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
  });

  test('engineer can create request', async ({ page }) => {
    await loginAsEngineer(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Engineers should be able to create requests
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('end user can create request', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // End users should be able to create requests
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('admin can create request on behalf of another user', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Admin should see "on behalf of" dropdown
    const onBehalfDropdown = page.locator('select').filter({ hasText: /myself|behalf/i }).first();
    const hasOnBehalf = await onBehalfDropdown.isVisible({ timeout: 5000 }).catch(() => false);

    // This feature is admin-only
    expect(hasOnBehalf).toBeTruthy();

    // Wait for users to load
    await page.waitForTimeout(1000);

    const options = await onBehalfDropdown.locator('option').count();
    // Should have at least "Create as myself" plus other users
    expect(options).toBeGreaterThan(1);
  });
});

test.describe('Request Validation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });
  });

  test('should require title', async ({ page }) => {
    // Leave title empty
    const descriptionInput = page.locator('textarea').first();
    await descriptionInput.fill('Test description');

    // Try to submit
    await page.getByRole('button', { name: /submit/i }).click();

    // Should show validation error or stay on page
    const stillOnForm = await page.url().includes('/new');
    const hasError = await page.locator('text=/required|title.*empty|please.*title/i').isVisible().catch(() => false);

    expect(stillOnForm || hasError).toBeTruthy();
  });

  test('should require description', async ({ page }) => {
    // Fill title only
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Test Title');

    // Leave description empty and try to submit
    await page.getByRole('button', { name: /submit/i }).click();

    // Should show validation error or stay on page
    const stillOnForm = await page.url().includes('/new');
    expect(stillOnForm).toBeTruthy();
  });

  test('should require project selection', async ({ page }) => {
    // Fill title and description
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Test Title');

    const descriptionInput = page.locator('textarea').first();
    await descriptionInput.fill('Test description');

    // Don't select a project and try to submit
    await page.getByRole('button', { name: /submit/i }).click();

    // Should show validation error or stay on page
    const stillOnForm = await page.url().includes('/new');
    const hasError = await page.locator('text=/select.*project|project.*required/i').isVisible().catch(() => false);

    expect(stillOnForm || hasError).toBeTruthy();
  });
});

test.describe('Request Details View', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should display request details', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible({ timeout: 10000 });

    // Find and click on a request
    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();

    // Should navigate to request detail page
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Should see request details
    await expect(page.locator('text=/status|priority|description|created/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display request status and allow status change for managers', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await page.waitForLoadState('networkidle');

    // Find a request link
    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Manager should see status badge
    const statusBadge = page.locator('text=/submitted|manager review|engineering|in progress|completed/i').first();
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Request Comments', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should display comments section on request detail', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await page.waitForLoadState('networkidle');

    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Should see comments section
    const hasComments = await page.locator('text=/comment|discussion|message/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasComments).toBeTruthy();
  });

  test('should allow adding a comment', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await page.waitForLoadState('networkidle');

    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Find comment input
    const commentInput = page.locator('textarea').filter({ hasText: '' }).last();
    const hasCommentInput = await commentInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasCommentInput) {
      await commentInput.fill('E2E Test Comment - Please ignore');

      // Find submit button for comment
      const submitButton = page.locator('button').filter({ hasText: /add|post|send|submit/i }).last();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();

        // Verify comment was added
        await page.waitForTimeout(1000);
        const commentVisible = await page.locator('text=/E2E Test Comment/i').isVisible().catch(() => false);
        expect(commentVisible).toBeTruthy();
      }
    }
  });
});

test.describe('Request Time Tracking', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should display time tracking section', async ({ page }) => {
    await loginAsEngineer(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await page.waitForLoadState('networkidle');

    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Should see time tracking section
    const hasTimeTracking = await page.locator('text=/time|hours|log|track/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasTimeTracking).toBeTruthy();
  });
});

test.describe('Request Status Transitions', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('manager can approve request to engineering review', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await page.waitForLoadState('networkidle');

    // Look for a request in "Submitted" or "Manager Review" status
    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Look for approve button
    const approveButton = page.locator('button').filter({ hasText: /approve|accept|forward/i }).first();
    const hasApprove = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasApprove) {
      // Click approve
      await approveButton.click();
      await page.waitForTimeout(1000);

      // Status should change
      const newStatus = await page.locator('text=/engineering review|approved/i').isVisible().catch(() => false);
      expect(newStatus).toBeTruthy();
    }
  });

  test('manager can deny request', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/requests');
    await page.waitForLoadState('networkidle');

    const requestLink = page.locator('a[href*="/requests/"]').first();
    const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRequest) {
      test.skip(true, 'No requests available');
      return;
    }

    await requestLink.click();
    await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 10000 });

    // Look for deny button
    const denyButton = page.locator('button').filter({ hasText: /deny|reject|decline/i }).first();
    const hasDeny = await denyButton.isVisible({ timeout: 3000 }).catch(() => false);

    // If deny button exists, verify it's clickable (but don't actually deny)
    if (hasDeny) {
      await expect(denyButton).toBeEnabled();
    }
  });
});
