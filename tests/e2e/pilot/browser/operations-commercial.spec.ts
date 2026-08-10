import { expect, test, type Page, type Response } from '@playwright/test';
import { login, PILOT_E2E_CHANNEL_A_ID, PILOT_E2E_TENANT_A_ID } from './fixtures';

const platformAuditPaths = [
  '/api/v1/platform/payment-events',
  '/api/v1/platform/commission-audit/calculations',
  '/api/v1/platform/commission-audit/accruals',
  '/api/v1/platform/commission-audit/reversals',
  '/api/v1/platform/commission-audit/manual-reviews',
] as const;

const channelAuditPaths = [
  '/api/v1/channels/current',
  `/api/v1/channels/${PILOT_E2E_CHANNEL_A_ID}/commission-audit/calculations`,
  `/api/v1/channels/${PILOT_E2E_CHANNEL_A_ID}/commission-audit/accruals`,
  `/api/v1/channels/${PILOT_E2E_CHANNEL_A_ID}/commission-audit/reversals`,
] as const;

const tenantRechargePath = `/api/v1/tenants/${PILOT_E2E_TENANT_A_ID}/recharge-orders`;

async function openLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('pilot-login-page')).toBeVisible();
}

function auditedPath(response: Response, paths: readonly string[]): string | null {
  const url = new URL(response.url());
  return paths.find((path) => url.pathname === path) ?? null;
}

test.describe.serial('Pilot Operations and TEST commercial browser matrix', () => {
  test('loads every real Platform TEST commercial audit endpoint for a Platform Admin', async ({
    page,
  }) => {
    const statuses = new Map<string, number>();
    page.on('response', (response) => {
      const path = auditedPath(response, platformAuditPaths);
      if (path) statuses.set(path, response.status());
    });

    await openLogin(page);
    await login(page, 'platformAdmin');

    await expect.poll(() => statuses.size).toBe(platformAuditPaths.length);
    expect(Object.fromEntries(statuses)).toEqual(
      Object.fromEntries(platformAuditPaths.map((path) => [path, 200])),
    );
    await expect(page.getByTestId('pilot-platform-commission-audit-ready')).toBeVisible();
    await expect(page.getByText('TEST · READ ONLY').first()).toBeVisible();
  });

  test('resolves the canonical Channel and loads every real Channel TEST commission endpoint', async ({
    page,
  }) => {
    const statuses = new Map<string, number>();
    page.on('response', (response) => {
      const path = auditedPath(response, channelAuditPaths);
      if (path) statuses.set(path, response.status());
    });

    await openLogin(page);
    const currentChannelResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/v1/channels/current',
    );
    await login(page, 'channelAdminA');

    const currentChannel = await currentChannelResponse;
    expect(currentChannel.status()).toBe(200);
    await expect(currentChannel.json()).resolves.toMatchObject({
      channel: { channelId: PILOT_E2E_CHANNEL_A_ID },
    });
    await expect.poll(() => statuses.size).toBe(channelAuditPaths.length);
    expect(Object.fromEntries(statuses)).toEqual(
      Object.fromEntries(channelAuditPaths.map((path) => [path, 200])),
    );
    await expect(page.getByTestId('pilot-channel-commission-audit-ready')).toBeVisible();
    await expect(page.getByText('TEST · READ ONLY').first()).toBeVisible();
  });

  test('loads the current Tenant TEST RechargeOrder audit without exposing a write flow', async ({
    page,
  }) => {
    const statuses = new Map<string, number>();
    page.on('response', (response) => {
      const path = auditedPath(response, [tenantRechargePath]);
      if (path) statuses.set(path, response.status());
    });

    await openLogin(page);
    await login(page, 'tenantAdminA');
    await page.goto('/enterprise/recharge-orders');

    await expect.poll(() => statuses.get(tenantRechargePath)).toBe(200);
    await expect(page.getByTestId('pilot-tenant-recharge-ready')).toBeVisible();
    await expect(page.getByText('TEST · READ ONLY').first()).toBeVisible();
    await expect(page.getByText(/非真实收款、非可用余额承诺/)).toBeVisible();
    await expect(page.getByRole('button', { name: /创建|立即充值|模拟支付|发起退款/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
});
