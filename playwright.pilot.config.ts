import { defineConfig, devices } from '@playwright/test';

const webOrigin = process.env.PILOT_E2E_WEB_ORIGIN;
if (!webOrigin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(webOrigin)) {
  throw new Error('PILOT_E2E_WEB_ORIGIN_REQUIRED');
}

const browserChannel = process.env.PILOT_E2E_BROWSER_CHANNEL;
if (browserChannel && browserChannel !== 'chrome') {
  throw new Error('PILOT_E2E_BROWSER_CHANNEL_INVALID');
}

export default defineConfig({
  testDir: './tests/e2e/pilot/browser',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['line']],
  outputDir: 'test-results/pilot-browser-e2e',
  use: {
    baseURL: webOrigin,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'pilot-chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
