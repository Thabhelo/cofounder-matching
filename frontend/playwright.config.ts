import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against a live stack. Start servers first:
 *   ./START_SERVERS.sh
 * Then: npm run test:e2e
 * Stop with: ./STOP_SERVERS.sh
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  timeout: 15000,
  expect: { timeout: 5000 },
});
