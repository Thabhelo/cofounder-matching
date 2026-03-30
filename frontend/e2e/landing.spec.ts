import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and shows key content', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Co-Founder Matching|cofounder|matching/i);
    await expect(page.getByRole('heading', { name: /CoFounder Match/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Find Your Perfect/i })).toBeVisible();
  });

  test('has sign in and get started CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' }).first()).toBeVisible();
  });
});
