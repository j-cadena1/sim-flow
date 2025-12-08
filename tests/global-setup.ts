import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup for Playwright E2E Tests
 *
 * This runs once before all tests to authenticate and save the session state.
 * All tests will then reuse this authenticated state, avoiding:
 * - Repeated login API calls that hit rate limits
 * - Slower test execution
 * - Test flakiness from authentication failures
 *
 * The saved auth state is stored in tests/.auth/admin.json and reused across all tests.
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const url = baseURL || process.env.BASE_URL || 'http://localhost:8080';
  const authFile = 'tests/.auth/admin.json';

  console.log(`🔐 Setting up global authentication for ${url}...`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    await page.goto(url);

    // Call the login API directly to get session cookies
    const response = await page.request.post(`${url}/api/auth/login`, {
      data: {
        email: 'qadmin@simflow.local',
        password: 'admin123',
      },
    });

    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
    }

    // Navigate to home to ensure session is active
    await page.goto(`${url}/`);
    await page.waitForLoadState('networkidle');

    // Verify we're actually logged in by checking for the Dashboard heading
    try {
      await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });
      console.log('✅ Authentication successful - session saved to', authFile);
    } catch (error) {
      console.warn('⚠️  Dashboard not visible after login, but continuing...');
    }

    // Save the authentication state (cookies + localStorage)
    await page.context().storageState({ path: authFile });
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
