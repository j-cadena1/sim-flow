import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright E2E Test Configuration for SimRQ
 * Run with: npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Global setup runs once before all tests to authenticate and save session state
  globalSetup: path.resolve(__dirname, 'tests/global-setup.ts'),
  // Can now run tests in parallel since we're not hitting the login endpoint repeatedly
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
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

  // Separate projects for authenticated and unauthenticated tests
  projects: [
    {
      name: 'authenticated',
      testMatch: /.*\/(navigation|requests|health|analytics|dashboard|forms|notifications)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // These tests use the saved auth state from global setup
        storageState: 'tests/.auth/admin.json',
      },
    },
    {
      name: 'auth-tests',
      testMatch: /.*\/(auth|roles|lifecycle|lifecycle-enforcement)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Auth, role, and lifecycle tests need to start without authentication
        // to switch between different user contexts
        storageState: { cookies: [], origins: [] },
      },
    },
  ],

  // Expect the Docker containers to be running
  // In CI, you would start them with docker compose up -d first
});
