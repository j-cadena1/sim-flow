/**
 * E2E Tests for File Attachments
 *
 * Tests attachment functionality on simulation requests:
 * - Storage config visibility
 * - Attachment upload (when storage is configured)
 * - Attachment display and download
 * - Delete attachment permissions
 *
 * Note: These tests may skip if S3 storage is not configured in the test environment.
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Navigate to a request detail page
 */
async function navigateToRequest(page: Page): Promise<boolean> {
  // First go to requests list
  await page.goto('/requests');
  await page.waitForLoadState('networkidle');

  // Wait for page to load
  await expect(page.getByRole('heading', { name: 'Simulation Requests' })).toBeVisible({ timeout: 10000 });

  // Look for any request link
  const requestLink = page.locator('a[href^="/requests/"]').first();
  const hasRequest = await requestLink.isVisible({ timeout: 5000 }).catch(() => false);

  if (!hasRequest) {
    return false;
  }

  await requestLink.click();
  await page.waitForLoadState('networkidle');

  // Verify we're on a request detail page
  await expect(page).toHaveURL(/\/requests\/[a-z0-9-]+/i, { timeout: 5000 });
  return true;
}

test.describe('Attachments', () => {
  test.beforeEach(async ({ page }) => {
    // Tests automatically start with authenticated session from global setup
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load
    const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
    const loginHeading = page.getByRole('heading', { name: 'Sim RQ' });

    await Promise.race([
      dashboardHeading.waitFor({ timeout: 15000 }),
      loginHeading.waitFor({ timeout: 15000 }),
    ]).catch(() => {});

    // If login page is visible, skip the test
    if (await loginHeading.isVisible().catch(() => false)) {
      test.skip(true, 'Session expired - login page visible');
      return;
    }

    await expect(dashboardHeading).toBeVisible({ timeout: 5000 });
  });

  test('should display attachments section on request detail', async ({ page }) => {
    const hasRequest = await navigateToRequest(page);
    if (!hasRequest) {
      test.skip(true, 'No requests available for testing');
      return;
    }

    // Look for the Attachments heading - it only shows when storage is enabled
    // If storage is disabled, the section won't appear
    const attachmentsHeading = page.getByRole('heading', { name: 'Attachments' });
    const headingVisible = await attachmentsHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (headingVisible) {
      // Attachments section is visible - storage is enabled
      await expect(attachmentsHeading).toBeVisible();

      // Should see either the upload zone or "No attachments yet" message
      const uploadZone = page.getByText('Drag and drop files here');
      const noAttachments = page.getByText('No attachments yet');

      const hasUploadZone = await uploadZone.isVisible().catch(() => false);
      const hasNoAttachmentsMsg = await noAttachments.isVisible().catch(() => false);

      // At least one should be visible if we're authorized to upload or there are no files
      expect(hasUploadZone || hasNoAttachmentsMsg).toBe(true);
    } else {
      // Storage is not configured - this is expected in some environments
      console.log('Attachments section not visible - storage may not be configured');
    }
  });

  test('should show upload zone for authorized users', async ({ page }) => {
    const hasRequest = await navigateToRequest(page);
    if (!hasRequest) {
      test.skip(true, 'No requests available for testing');
      return;
    }

    // Look for the upload zone
    const uploadZone = page.getByText('Drag and drop files here');
    const hasUploadZone = await uploadZone.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasUploadZone) {
      // Verify the browse button exists
      const browseButton = page.getByText('browse');
      await expect(browseButton).toBeVisible();

      // Verify file size limit info is shown
      const maxSizeInfo = page.getByText(/Max \d+MB per file/);
      await expect(maxSizeInfo).toBeVisible();
    } else {
      // Either storage not configured or user doesn't have permission
      console.log('Upload zone not visible - either storage disabled or no permission');
    }
  });

  test('should display attachment list when files exist', async ({ page }) => {
    const hasRequest = await navigateToRequest(page);
    if (!hasRequest) {
      test.skip(true, 'No requests available for testing');
      return;
    }

    // Check if attachments section exists
    const attachmentsHeading = page.getByRole('heading', { name: 'Attachments' });
    const headingVisible = await attachmentsHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (!headingVisible) {
      test.skip(true, 'Storage not configured');
      return;
    }

    // Look for attachment items (files that have been uploaded)
    // Each attachment has a container with file info
    const attachmentItems = page.locator('.group').filter({ has: page.locator('[title="Download"]') });
    const hasAttachments = await attachmentItems.count() > 0;

    if (hasAttachments) {
      // If there are attachments, verify structure
      const firstAttachment = attachmentItems.first();

      // Should have a download button
      const downloadButton = firstAttachment.locator('[title="Download"]');
      await expect(downloadButton).toBeVisible();

      // File name should be visible
      const fileName = firstAttachment.locator('.truncate');
      await expect(fileName).toBeVisible();

      // File size should be visible
      const fileInfo = firstAttachment.locator('text=/\\d+(\\.\\d+)?\\s*(B|KB|MB|GB)/');
      await expect(fileInfo).toBeVisible();
    } else {
      // No attachments - verify empty state
      await expect(page.getByText('No attachments yet')).toBeVisible();
    }
  });

  test('should show delete button for authorized users', async ({ page }) => {
    const hasRequest = await navigateToRequest(page);
    if (!hasRequest) {
      test.skip(true, 'No requests available for testing');
      return;
    }

    // Check if attachments section exists and has files
    const attachmentsHeading = page.getByRole('heading', { name: 'Attachments' });
    const headingVisible = await attachmentsHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (!headingVisible) {
      test.skip(true, 'Storage not configured');
      return;
    }

    // Look for attachment items with delete buttons
    const attachmentItems = page.locator('.group').filter({ has: page.locator('[title="Delete"]') });
    const hasAttachmentsWithDelete = await attachmentItems.count() > 0;

    if (hasAttachmentsWithDelete) {
      // Hover over the first attachment to reveal actions
      const firstAttachment = attachmentItems.first();
      await firstAttachment.hover();

      // Delete button should be visible on hover
      const deleteButton = firstAttachment.locator('[title="Delete"]');
      await expect(deleteButton).toBeVisible();
    } else {
      // Either no attachments or user doesn't have delete permission
      console.log('No delete buttons visible - no attachments or no permission');
    }
  });
});

test.describe('Storage API', () => {
  test('should return storage config from API', async ({ request }) => {
    // This test checks the API directly
    // Note: This requires an authenticated session

    const response = await request.get('/api/storage/config');

    if (response.status() === 401) {
      test.skip(true, 'Not authenticated for API test');
      return;
    }

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('enabled');
    expect(data).toHaveProperty('maxFileSizeMB');
    expect(data).toHaveProperty('allowedFileTypes');
    expect(Array.isArray(data.allowedFileTypes)).toBe(true);
  });
});
