import { defineConfig } from '@playwright/test';

const browserExecutable = process.env.CANVAS_FULL_CASE_BROWSER_EXECUTABLE?.trim();
if (browserExecutable && !browserExecutable.startsWith('/Applications/')) {
  throw new Error('CANVAS_FULL_CASE_BROWSER_EXECUTABLE_INVALID');
}

export default defineConfig({
  testDir: '../../tests/e2e/canvas-v1',
  testMatch: 'full-case-visibility.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  outputDir: '../../docs/program/t0-canvas-v1/evidence/full-case-visibility/playwright',
  use: {
    baseURL: process.env.CANVAS_FULL_CASE_BASE_URL,
    launchOptions: browserExecutable ? { executablePath: browserExecutable } : undefined,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'full-case-1440x900', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'full-case-1672x941', use: { viewport: { width: 1672, height: 941 } } },
  ],
});
