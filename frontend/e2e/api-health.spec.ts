import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000';

test.describe('Backend API', () => {
  test('health/root returns 200', async ({ request }) => {
    const res = await request.get(`${API_BASE}/`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('API docs are reachable', async ({ request }) => {
    const res = await request.get(`${API_BASE}/docs`);
    expect(res.status()).toBe(200);
  });

  test('v1 API prefix has docs', async ({ request }) => {
    const res = await request.get(`${API_BASE}/openapi.json`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.openapi || body.swagger).toBeDefined();
  });
});
