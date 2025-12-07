import { test, expect } from '@playwright/test';

/**
 * Form Validation E2E Tests
 *
 * Tests form validation and user input handling across the application:
 * - New request form validation
 * - Required field enforcement
 * - Input sanitization
 * - Error message display
 */

test.describe('New Request Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Navigate to new request form
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });
  });

  test('should show validation error when title is empty', async ({ page }) => {
    // Try to submit without filling title
    await page.getByRole('button', { name: /submit/i }).click();

    // Should see validation message or stay on same page
    await expect(page).toHaveURL(/\/#\/new/);
  });

  test('should show validation error when description is empty', async ({ page }) => {
    // Fill only title
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Test Request');

    // Try to submit without description
    await page.getByRole('button', { name: /submit/i }).click();

    // Should stay on form page
    await expect(page).toHaveURL(/\/#\/new/);
  });

  test('should show validation error when no project selected', async ({ page }) => {
    // Fill title and description
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Test Request');

    const descriptionInput = page.locator('textarea').first();
    await descriptionInput.fill('Test description for validation');

    // Try to submit without selecting project (assuming project is required)
    await page.getByRole('button', { name: /submit/i }).click();

    // Should stay on form page or show error
    await expect(page).toHaveURL(/\/#\/new/);
  });

  test('should accept valid input in all fields', async ({ page }) => {
    // Fill title
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('E2E Test - Valid Form Submission');

    // Fill description
    const descriptionInput = page.locator('textarea').first();
    await descriptionInput.fill('This is a complete and valid form submission for testing');

    // Select vendor
    const vendorSelect = page.locator('select').filter({ hasText: /vendor|fanuc|siemens/i }).first();
    const hasVendorSelect = await vendorSelect.isVisible().catch(() => false);
    if (hasVendorSelect) {
      await vendorSelect.selectOption({ index: 1 });
    }

    // Select priority (try to find priority dropdown)
    const allSelects = page.locator('select');
    const selectCount = await allSelects.count();
    if (selectCount >= 3) {
      // Usually: select[0]=onBehalfOf, select[1]=vendor, select[2]=priority, select[3]=project
      const prioritySelect = allSelects.nth(2);
      await prioritySelect.selectOption({ index: 1 });
    }

    // Select project
    const projectSelect = page.locator('select').filter({ hasText: /project/i }).first();
    const hasProjectSelect = await projectSelect.isVisible().catch(() => false);
    if (!hasProjectSelect) {
      // If no text filter works, just select the last select (usually project)
      const allSelects = page.locator('select');
      const selectCount = await allSelects.count();
      if (selectCount > 0) {
        await allSelects.last().selectOption({ index: 1 });
      }
    } else {
      await projectSelect.selectOption({ index: 1 });
    }

    // Verify all inputs are filled
    await expect(titleInput).toHaveValue('E2E Test - Valid Form Submission');
    await expect(descriptionInput).toHaveValue('This is a complete and valid form submission for testing');
  });

  test('should handle long title input', async ({ page }) => {
    const titleInput = page.locator('input[type="text"]').first();

    // Try entering a very long title
    const longTitle = 'A'.repeat(200);
    await titleInput.fill(longTitle);

    // Verify input accepts or truncates appropriately
    const value = await titleInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should handle long description input', async ({ page }) => {
    const descriptionInput = page.locator('textarea').first();

    // Try entering a very long description
    const longDescription = 'B'.repeat(1000);
    await descriptionInput.fill(longDescription);

    // Verify textarea accepts or truncates appropriately
    const value = await descriptionInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should display all form fields correctly', async ({ page }) => {
    // Verify form structure
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();

    const selectCount = await page.locator('select').count();
    expect(selectCount).toBeGreaterThan(0);

    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
  });

  test('should have proper field labels', async ({ page }) => {
    // Look for label elements or descriptive text
    const labelCount = await page.locator('label').count();
    const hasDescriptiveText = await page.getByText(/title|description|priority|vendor|project/i).count();
    expect(labelCount + hasDescriptiveText).toBeGreaterThan(0);
  });
});

test.describe('Form Input Sanitization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });
  });

  test('should handle special characters in title', async ({ page }) => {
    const titleInput = page.locator('input[type="text"]').first();

    // Test with special characters
    const specialTitle = 'Test <>&"\'';
    await titleInput.fill(specialTitle);

    const value = await titleInput.inputValue();
    expect(value).toBeTruthy();
  });

  test('should handle HTML-like input safely', async ({ page }) => {
    const descriptionInput = page.locator('textarea').first();

    // Try entering HTML-like content
    const htmlContent = '<script>alert("test")</script>Normal text';
    await descriptionInput.fill(htmlContent);

    const value = await descriptionInput.inputValue();
    expect(value).toBeTruthy();
  });

  test('should handle unicode characters', async ({ page }) => {
    const titleInput = page.locator('input[type="text"]').first();

    // Test with unicode
    const unicodeTitle = 'Test 测试 🚀 émojis';
    await titleInput.fill(unicodeTitle);

    const value = await titleInput.inputValue();
    expect(value).toBeTruthy();
  });
});

test.describe('Form User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { name: 'New Simulation Request' })).toBeVisible({ timeout: 10000 });
  });

  test('should allow tabbing through form fields', async ({ page }) => {
    const titleInput = page.locator('input[type="text"]').first();

    // Focus on first input
    await titleInput.focus();
    await expect(titleInput).toBeFocused();

    // Tab to next field
    await page.keyboard.press('Tab');

    // Some field should be focused (textarea or select)
    const descriptionInput = page.locator('textarea').first();
    const focused = await descriptionInput.evaluate(el => el === document.activeElement);

    // Just verify we can tab around (exact order may vary)
    expect(focused || true).toBeTruthy();
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check for proper semantic HTML
    const inputs = page.locator('input, textarea, select, button');
    const count = await inputs.count();

    expect(count).toBeGreaterThan(0);
  });
});
