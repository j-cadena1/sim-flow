import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsManager, loginAsEngineer } from '../helpers/auth';

/**
 * Request Lifecycle E2E Tests (Simplified)
 *
 * These tests verify basic request workflow functionality without
 * creating new data. They test with existing requests in the system.
 */

test.describe('Request Workflow - Admin', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('admin can access new request form', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to new request page
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Verify form elements are present
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
  });

  test('admin can navigate to requests page', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to requests
    await page.goto('/#/requests');
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible({ timeout: 10000 });

    // Verify we can see Active Requests section
    await expect(page.getByRole('heading', { name: /^Active Requests \(\d+\)$/ })).toBeVisible();
  });
});

test.describe('Request Workflow - Manager', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('manager can access new request form', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to new request page
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Verify form is accessible
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('manager can view requests list', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to requests
    await page.goto('/#/requests');
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible({ timeout: 10000 });

    // Should see Active Requests section
    await expect(page.getByRole('heading', { name: /^Active Requests \(\d+\)$/ })).toBeVisible();
  });
});

test.describe('Request Workflow - Engineer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('engineer can access new request form', async ({ page }) => {
    await loginAsEngineer(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to new request page
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });

    // Verify form is accessible
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('engineer can view assigned requests', async ({ page }) => {
    await loginAsEngineer(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to requests
    await page.goto('/#/requests');
    await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible({ timeout: 10000 });

    // Should see Active Requests section (even if empty)
    await expect(page.getByRole('heading', { name: /^Active Requests \(\d+\)$/ })).toBeVisible();
  });
});

test.describe('Projects Workflow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  });

  test('manager can view projects page', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to projects
    await page.goto('/#/projects');
    await expect(page).toHaveURL(/\/#\/projects/);

    // Should see projects content (heading or table)
    await expect(page.locator('text=/Project|Budget|Hours/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('admin can view projects page', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to projects
    await page.goto('/#/projects');
    await expect(page).toHaveURL(/\/#\/projects/);

    // Should see projects content
    await expect(page.locator('text=/Project|Budget|Hours/i').first()).toBeVisible({ timeout: 10000 });
  });
});
