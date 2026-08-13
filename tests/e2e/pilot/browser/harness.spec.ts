import { expect, test } from '@playwright/test';
import { installEmailVerificationBridge } from './fixtures';

test.beforeEach(async ({ page }) => {
  await installEmailVerificationBridge(page);
});

test('serves Pilot UI and Control API through one browser origin', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId('pilot-login-page')).toBeVisible();
  await expect(page.getByText('Pilot 真实环境')).toBeVisible();

  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/session', {
      credentials: 'include',
      cache: 'no-store',
    });
    return {
      status: response.status,
      requestId: response.headers.get('x-request-id'),
      body: await response.json(),
      origin: response.url ? new URL(response.url).origin : window.location.origin,
    };
  });

  expect(result.status).toBe(401);
  expect(result.requestId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
  expect(result.body).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  expect(result.origin).toBe(new URL(page.url()).origin);
  const browserStorage = await page.evaluate(() => ({
    localStorageKeys: Object.keys(window.localStorage).sort(),
    sessionStorageKeys: Object.keys(window.sessionStorage).sort(),
  }));
  expect(browserStorage).toEqual({ localStorageKeys: [], sessionStorageKeys: [] });
});
