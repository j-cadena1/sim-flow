import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Sim-Flow
 * Run with: npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Run serially to avoid rate limiting on login endpoint
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    // Frontend URL - defaults to Docker Compose exposed port
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Only test with Chromium for now to keep tests fast
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Expect the Docker containers to be running
  // In CI, you would start them with docker compose up -d first
});
