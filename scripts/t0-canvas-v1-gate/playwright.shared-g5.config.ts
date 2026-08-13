import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests/e2e/canvas-v1',
  testMatch: 'shared-g5-browser.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  outputDir: '../../docs/program/t0-canvas-v1/evidence/shared-g5-browser/playwright',
  use: {
    baseURL: process.env.CANVAS_V1_BROWSER_BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'canvas-1440x900', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'canvas-1672x941', use: { viewport: { width: 1672, height: 941 } } },
  ],
});
