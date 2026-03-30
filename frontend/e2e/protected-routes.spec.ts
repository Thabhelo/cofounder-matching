import { test, expect } from '@playwright/test';

test.describe('Protected routes', () => {
  test('dashboard loads (may show sign-in or dashboard)', async ({ page }) => {
    const res = await page.goto('/dashboard');
    expect(res?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').or(page.getByText(/Sign In|Dashboard/i)).first()).toBeVisible({ timeout: 8000 });
  });

  test('discover page loads', async ({ page }) => {
    const res = await page.goto('/discover');
    expect(res?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
  });
});
