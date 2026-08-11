import { defineConfig, devices } from '@playwright/test';

if (process.env.PILOT_E2E !== 'true') {
  throw new Error('PILOT_E2E_MODE_REQUIRED');
}

if (process.env.PILOT_E2E_AB_GOLDEN_PATH !== 'true') {
  throw new Error('AB_GOLDEN_PATH_MODE_REQUIRED');
}

const browserChannel = process.env.PILOT_E2E_BROWSER_CHANNEL;
if (!browserChannel) {
  throw new Error('PILOT_E2E_BROWSER_CHANNEL_REQUIRED');
}
if (browserChannel !== 'chrome') {
  throw new Error('PILOT_E2E_BROWSER_CHANNEL_INVALID');
}

const webOrigin = process.env.PILOT_E2E_WEB_ORIGIN;
if (!webOrigin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(webOrigin)) {
  throw new Error('PILOT_E2E_WEB_ORIGIN_REQUIRED');
}

export default defineConfig({
  testDir: './tests/e2e/pilot/browser',
  testMatch: 'ab-golden-path.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['line'], ['json', { outputFile: 'test-results/pilot-ab-golden-path/report.json' }]],
  outputDir: 'test-results/pilot-ab-golden-path/artifacts',
  use: {
    baseURL: webOrigin,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'pilot-ab-golden-path-chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
