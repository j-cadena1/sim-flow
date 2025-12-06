import { test, expect } from '@playwright/test';

// Backend API URL - defaults to Docker Compose exposed port
const API_URL = process.env.API_URL || 'http://localhost:3001';

test.describe('Health Checks', () => {
  test('frontend should be accessible', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('backend health endpoint should return healthy', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('backend ready endpoint should return ready', async ({ request }) => {
    const response = await request.get(`${API_URL}/ready`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });

  test('metrics endpoint should return Prometheus metrics', async ({ request }) => {
    const response = await request.get(`${API_URL}/metrics`);
    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    expect(text).toContain('process_uptime_seconds');
    expect(text).toContain('http_requests_total');
  });

  test('API docs should be accessible', async ({ request }) => {
    const response = await request.get(`${API_URL}/api-docs.json`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.info.title).toBe('Sim-Flow API');
    expect(body.paths).toBeDefined();
  });
});
