import { test, expect } from '@playwright/test';

test.describe('Health Checks', () => {
  test('frontend should be accessible', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('backend health endpoint should return healthy', async ({ request, baseURL }) => {
    // Test the backend health endpoint through the proxy
    // Works in both dev (Vite proxy) and prod (nginx proxy)
    const response = await request.get(`${baseURL}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('backend ready endpoint should confirm database connection', async ({ request, baseURL }) => {
    // Test the backend ready endpoint which verifies database connectivity
    const response = await request.get(`${baseURL}/ready`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });

  test('API should be accessible through frontend proxy', async ({ request, baseURL }) => {
    // Test that the API is accessible through the frontend proxy
    // This verifies the reverse proxy setup is working correctly
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: 'invalid@test.com', password: 'wrong' },
    });

    // We expect 401 (invalid credentials), not 502/503 (proxy error)
    // This confirms the backend is reachable through the frontend proxy
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});
