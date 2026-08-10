import { expect, test, type Page } from '@playwright/test';
import {
  browserStorageKeys,
  installEmailVerificationBridge,
  invitationToken,
  type PilotE2eInvitationKey,
} from './fixtures';

async function openInvitation(page: Page, key: PilotE2eInvitationKey): Promise<void> {
  const token = invitationToken(key);
  await page.goto('/register');
  await page.evaluate((secret) => {
    window.location.assign(`/register?invitation=${encodeURIComponent(secret)}`);
  }, token);
  await expect
    .poll(() => new URL(page.url()).searchParams.has('invitation'), {
      message: 'registration invitation query must be removed without exposing its value',
    })
    .toBe(false);
  expect(
    await page.evaluate((secret) => document.body.textContent?.includes(secret) ?? false, token),
  ).toBe(false);
}

async function expectDirectRegistrationAfterRefresh(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByTestId('registration-page')).toBeVisible();
  await expect(page.getByText('直接注册')).toBeVisible();
  await expect(page.getByTestId('registration-tenant-name')).toBeVisible();
}

test.describe.serial('Pilot public registration browser matrix', () => {
  test.beforeEach(async ({ page }) => {
    await installEmailVerificationBridge(page);
  });

  test('loads the canonical published registration Terms through the real API', async ({
    page,
  }) => {
    await page.goto('/register');

    await expect(page.getByTestId('registration-page')).toBeVisible();
    await expect(page.getByText('Pilot E2E 注册服务条款 · pilot-e2e-v1')).toBeVisible();
    await expect(
      page.getByText('Pilot E2E registration notice for deterministic browser tests.'),
    ).toBeVisible();
    await expect(page.getByTestId('registration-submit')).toBeEnabled();
    await expect(browserStorageKeys(page)).resolves.toEqual({
      localStorageKeys: [],
      sessionStorageKeys: [],
    });
  });

  test('shows a valid invitation once, removes its URL token, and does not restore it on refresh', async ({
    page,
  }) => {
    await openInvitation(page, 'valid');

    await expect(page.getByText('渠道邀请注册')).toBeVisible();
    await expect(page.getByText('剩余 100 次')).toBeVisible();
    await expect(page.getByTestId('registration-tenant-name')).toBeVisible();

    await expectDirectRegistrationAfterRefresh(page);
    await expect(browserStorageKeys(page)).resolves.toEqual({
      localStorageKeys: [],
      sessionStorageKeys: [],
    });
  });

  for (const key of ['expired', 'revoked', 'exhausted'] as const) {
    test(`fails closed for an unavailable ${key} invitation without retaining its token`, async ({
      page,
    }) => {
      await openInvitation(page, key);

      await expect(page.getByText('当前邀请不可用')).toBeVisible();
      await expect(page.getByTestId('registration-submit')).toBeDisabled();
      await page.getByRole('button', { name: '改为直接注册' }).click();
      await expect(page.getByText('直接注册')).toBeVisible();
      await expect(page.getByTestId('registration-submit')).toBeEnabled();
      await expect(browserStorageKeys(page)).resolves.toEqual({
        localStorageKeys: [],
        sessionStorageKeys: [],
      });
    });
  }
});
