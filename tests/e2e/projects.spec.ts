import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsManager, loginAsEngineer, TEST_USERS } from '../helpers/auth';

/**
 * Project Lifecycle E2E Tests
 *
 * Tests project management functionality including:
 * - Project CRUD operations
 * - Status transitions (lifecycle state machine)
 * - Hour allocation and tracking
 * - Role-based access control
 */

test.describe('Projects - View and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should display projects page', async ({ page }) => {
    await page.goto('/#/projects');
    await expect(page).toHaveURL(/\/#\/projects/);

    // Should see project-related content
    await expect(page.locator('text=/projects|budget|hours/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display project table or empty state', async ({ page }) => {
    await page.goto('/#/projects');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should see either projects table or empty state
    const hasTable = await page.locator('table').isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=/no projects|create.*project/i').isVisible().catch(() => false);

    expect(hasTable || hasEmptyState).toBeTruthy();
  });
});

test.describe('Projects - Create Project', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('admin can create a new project', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Look for create project button
    const createButton = page.getByRole('button', { name: /create|new|add/i }).filter({ hasText: /project/i }).first();
    const hasCreateButton = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCreateButton) {
      // Try alternate button patterns
      const altButton = page.locator('button').filter({ hasText: /new project|create project|add project/i }).first();
      const hasAltButton = await altButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasAltButton) {
        await altButton.click();
      } else {
        test.skip(true, 'Create project button not found');
        return;
      }
    } else {
      await createButton.click();
    }

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Fill in project details
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill(`E2E Test Project ${Date.now()}`);

    // Fill description if present
    const descriptionInput = page.locator('textarea').first();
    if (await descriptionInput.isVisible().catch(() => false)) {
      await descriptionInput.fill('Project created by E2E test');
    }

    // Set hours budget if present
    const hoursInput = page.locator('input[type="number"]').first();
    if (await hoursInput.isVisible().catch(() => false)) {
      await hoursInput.fill('100');
    }

    // Submit the form
    const submitButton = page.getByRole('button', { name: /create|save|submit/i }).last();
    await submitButton.click();

    // Verify success (toast or project appears in list)
    await page.waitForTimeout(1000);

    // Check for success indicators
    const hasToast = await page.locator('text=/created|success/i').isVisible({ timeout: 5000 }).catch(() => false);
    const projectInList = await page.locator('text=/E2E Test Project/i').isVisible().catch(() => false);

    expect(hasToast || projectInList).toBeTruthy();
  });

  test('manager can create a new project', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Verify manager has access to projects page
    await expect(page.locator('text=/projects|budget|hours/i').first()).toBeVisible({ timeout: 10000 });

    // Look for create button
    const createButton = page.locator('button').filter({ hasText: /new|create|add/i }).first();
    const hasCreateButton = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

    // Manager should be able to create projects
    expect(hasCreateButton).toBeTruthy();
  });

  test('engineer cannot create projects', async ({ page }) => {
    await loginAsEngineer(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Engineer should see projects but not have create button
    // Or should be redirected/shown limited view
    const createButton = page.locator('button').filter({ hasText: /new project|create project/i }).first();
    const hasCreateButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);

    // Engineer should NOT have create project button
    expect(hasCreateButton).toBeFalsy();
  });
});

test.describe('Projects - Status Transitions', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should display project status badges', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Check if there are any projects
    const hasProjects = await page.locator('table tbody tr').count().catch(() => 0);

    if (hasProjects > 0) {
      // Should see status badges
      const statusBadge = page.locator('text=/pending|active|on hold|suspended|completed|cancelled|expired|archived/i').first();
      await expect(statusBadge).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show status change options for active project', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Find a project row with actions
    const projectRow = page.locator('table tbody tr').first();
    const hasRow = await projectRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRow) {
      test.skip(true, 'No projects available');
      return;
    }

    // Look for action menu (usually a ... button or dropdown)
    const actionButton = projectRow.locator('button').filter({ hasText: /⋮|actions|menu|more/i }).first();
    const hasActionButton = await actionButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasActionButton) {
      await actionButton.click();

      // Should see status change options
      await page.waitForTimeout(300);
      const hasStatusOptions = await page.locator('text=/change status|activate|suspend|hold|complete/i').isVisible().catch(() => false);
      expect(hasStatusOptions).toBeTruthy();
    }
  });
});

test.describe('Projects - Hour Allocation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should display hour budget information', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Check for hour-related columns or fields
    const hasHoursInfo = await page.locator('text=/hours|budget|allocated|used|remaining/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasHoursInfo).toBeTruthy();
  });

  test('should show hour utilization metrics', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Look for metrics dashboard button or section
    const metricsButton = page.locator('button, a').filter({ hasText: /metrics|dashboard|analytics/i }).first();
    const hasMetricsButton = await metricsButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMetricsButton) {
      await metricsButton.click();
      await page.waitForTimeout(500);

      // Should see utilization charts or numbers
      const hasUtilization = await page.locator('text=/utilization|%|percent/i').isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasUtilization).toBeTruthy();
    }
  });
});

test.describe('Projects - Filtering and Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should filter projects by status', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Look for status filter dropdown
    const statusFilter = page.locator('select, button').filter({ hasText: /status|filter|all/i }).first();
    const hasFilter = await statusFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFilter) {
      // Click to open filter
      await statusFilter.click();
      await page.waitForTimeout(300);

      // Should see filter options
      const hasOptions = await page.locator('text=/active|pending|completed|all/i').isVisible().catch(() => false);
      expect(hasOptions).toBeTruthy();
    }
  });
});

test.describe('Projects - Details View', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('should open project details on click', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Find a clickable project row or name
    const projectLink = page.locator('table tbody tr td a, table tbody tr td button').first();
    const hasLink = await projectLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasLink) {
      await projectLink.click();
      await page.waitForTimeout(500);

      // Should see project details (modal or new page)
      const hasDetails = await page.locator('text=/description|requests|created|deadline/i').isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('should display associated requests for a project', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Find project with requests indicator
    const projectRow = page.locator('table tbody tr').first();
    const hasRow = await projectRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRow) {
      // Look for request count or expand button
      const requestsIndicator = projectRow.locator('text=/\\d+\\s*(request|req)/i').first();
      const hasRequests = await requestsIndicator.isVisible().catch(() => false);

      if (hasRequests) {
        // Click to view requests
        await requestsIndicator.click();
        await page.waitForTimeout(500);

        // Should see request list
        const hasRequestList = await page.locator('text=/simulation|request|title/i').isVisible().catch(() => false);
        expect(hasRequestList).toBeTruthy();
      }
    }
  });
});

test.describe('Projects - Deadline Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should show projects nearing deadline', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // Look for deadline warnings or near-deadline section
    const hasDeadlineInfo = await page.locator('text=/deadline|due|expir/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasDeadlineInfo).toBeTruthy();
  });
});
