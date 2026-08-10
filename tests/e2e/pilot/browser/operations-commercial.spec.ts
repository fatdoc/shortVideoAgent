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
const activeChannelDirectoryPath = '/api/v1/platform/channels';
const settlementDraftPath = '/api/v1/platform/commission-settlements';

async function openLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('pilot-login-page')).toBeVisible();
}

function auditedPath(response: Response, paths: readonly string[]): string | null {
  const url = new URL(response.url());
  return paths.find((path) => url.pathname === path) ?? null;
}

async function expectPath(page: Page, expected: string): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname).toBe(expected);
}

async function holdServiceErrorUntilRestore(
  page: Page,
  urlPattern: string,
  requestId: string,
): Promise<{ release: () => void; restore: () => Promise<void> }> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = async (route: Parameters<Parameters<Page['route']>[1]>[0]) => {
    await gate;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: '服务暂不可用。', requestId },
      }),
    });
  };
  await page.route(urlPattern, handler);
  return {
    release,
    restore: () => page.unroute(urlPattern, handler),
  };
}

test.describe.serial('Pilot Operations and TEST commercial browser matrix', () => {
  test('fails closed then retries the real Platform Terms directories', async ({ page }) => {
    await openLogin(page);
    await login(page, 'platformAdmin');
    await expectPath(page, '/platform/commission-audit');

    const requestId = 'pilot-e2e-terms-retry';
    const failure = await holdServiceErrorUntilRestore(
      page,
      '**/api/v1/platform/terms/documents?**',
      requestId,
    );
    await page.goto('/platform/terms');
    await expect(page.getByTestId('pilot-terms-documents-loading')).toBeVisible();
    failure.release();

    const error = page.getByTestId('pilot-terms-documents-service-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(`请求 ID：${requestId}`);
    await failure.restore();
    const recovered = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/platform/terms/documents' &&
        response.status() === 200,
    );
    await page.getByRole('button', { name: '重试 Document Directory' }).click();
    await recovered;

    await expect(page.getByTestId('pilot-terms-documents-ready')).toBeVisible();
    await expect(page.getByTestId('pilot-terms-versions-ready')).toBeVisible();
  });

  test('shows a real empty Platform Invitation directory after a retryable service error', async ({
    page,
  }) => {
    await openLogin(page);
    await login(page, 'platformAdmin');
    await expectPath(page, '/platform/commission-audit');

    const requestId = 'pilot-e2e-invitations-retry';
    const failure = await holdServiceErrorUntilRestore(
      page,
      '**/api/v1/platform/invitations?**',
      requestId,
    );
    await page.goto('/platform/invitations');
    await expect(page.getByTestId('pilot-invitations-loading')).toBeVisible();
    failure.release();

    const error = page.getByTestId('pilot-invitations-service-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(`请求 ID：${requestId}`);
    await failure.restore();
    const recovered = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/platform/invitations' &&
        response.status() === 200,
    );
    await page.getByRole('button', { name: '重试真实邀请目录' }).click();
    await recovered;

    await expect(page.getByTestId('pilot-invitations-empty')).toBeVisible();
    await expect(page.getByTestId('pilot-invitation-one-time-token')).toHaveCount(0);
  });

  test('retries the real Platform Member directory and preserves a real empty filter', async ({
    page,
  }) => {
    await openLogin(page);
    await login(page, 'platformAdmin');
    await expectPath(page, '/platform/commission-audit');

    const requestId = 'pilot-e2e-members-retry';
    const failure = await holdServiceErrorUntilRestore(
      page,
      '**/api/v1/organizations/current/members?**',
      requestId,
    );
    await page.goto('/platform/members');
    await expect(page.getByTestId('pilot-members-loading')).toBeVisible();
    failure.release();

    const error = page.getByTestId('pilot-members-service-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(`请求 ID：${requestId}`);
    await failure.restore();
    const recovered = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/organizations/current/members' &&
        response.status() === 200,
    );
    await page.getByRole('button', { name: '重试真实成员目录' }).click();
    await recovered;
    await expect(page.getByTestId('pilot-members-ready')).toBeVisible();

    const emptyFilter = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/organizations/current/members' &&
        new URL(response.url()).searchParams.get('status') === 'expired' &&
        response.status() === 200,
    );
    await page.getByLabel('Member status filter').selectOption('expired');
    await emptyFilter;
    await expect(page.getByTestId('pilot-members-empty')).toBeVisible();
  });

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

  test('creates only a zero-candidate Platform TEST settlement draft from the active Channel Directory', async ({
    page,
  }) => {
    const statuses = new Map<string, number>();
    const paths = [activeChannelDirectoryPath, settlementDraftPath];
    page.on('response', (response) => {
      const path = auditedPath(response, paths);
      if (path) statuses.set(path, response.status());
    });

    await openLogin(page);
    await login(page, 'platformAdmin');
    await page.goto('/platform/commission-settlements');

    await expect.poll(() => statuses.get(activeChannelDirectoryPath)).toBe(200);
    await expect(page.getByTestId('pilot-settlement-draft-form')).toBeVisible();
    await page.getByLabel('Active beneficiary Channel').selectOption(PILOT_E2E_CHANNEL_A_ID);
    await page.getByLabel('UTC 结算自然月').fill('2026-06');
    await page.getByLabel('UTC 截止时间').fill('2026-07-01T00:00');
    const settlementResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === settlementDraftPath,
    );
    await page.getByRole('button', { name: '创建 TEST draft' }).click();

    const created = await settlementResponse;
    expect(created.status()).toBe(201);
    expect(created.headers()['idempotency-replayed']).toBe('false');
    await expect(created.json()).resolves.toMatchObject({
      settlement: {
        paymentMode: 'TEST',
        status: 'draft',
        beneficiaryChannelId: PILOT_E2E_CHANNEL_A_ID,
        currency: 'CNY',
        netAmountMinor: 0,
        itemCount: 0,
      },
    });
    await expect.poll(() => statuses.get(settlementDraftPath)).toBe(201);
    const result = page.getByTestId('pilot-settlement-current-draft');
    await expect(result).toBeVisible();
    await expect(result).toContainText('零候选是有效审计结果，不是创建失败');
    await expect(result).toContainText('TEST · draft · NON_QUOTE');
    await expect(result).toContainText('非到账、非提现、非 paid、非自动打款');
    await expect(page.getByRole('button', { name: /review|approve|paid|提现|打款/i })).toHaveCount(
      0,
    );
  });
});
