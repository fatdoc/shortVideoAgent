import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests/e2e/canvas-v1',
  testMatch: 'g6-no-provider-browser.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  outputDir: '../../docs/program/t0-canvas-v1/evidence/g6-safe-browser/playwright',
  use: {
    baseURL: process.env.CANVAS_V1_BROWSER_BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'g6-safe-1440x900', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'g6-safe-1672x941', use: { viewport: { width: 1672, height: 941 } } },
  ],
});
