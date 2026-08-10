import { expect, test, type Page } from '@playwright/test';
import { login, PILOT_E2E_CHANNEL_B_ID, PILOT_E2E_TENANT_B_ID } from './fixtures';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const UNKNOWN_CHANNEL_ID = '62000000-0000-4000-8000-000000000099';
const UNKNOWN_TENANT_ID = '63000000-0000-4000-8000-000000000099';

interface SafeErrorResponse {
  status: number;
  cacheControl: string | null;
  requestId: string | null;
  body: unknown;
}

async function openLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('pilot-login-page')).toBeVisible();
}

async function fetchSafeError(page: Page, path: string): Promise<SafeErrorResponse> {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control'),
      requestId: response.headers.get('x-request-id'),
      body: await response.json(),
    };
  }, path);
}

function expectObscuredNotFound(
  response: SafeErrorResponse,
  code: string,
  message: string,
  forbiddenFacts: readonly string[],
): void {
  expect(response.status).toBe(404);
  expect(response.cacheControl).toBe('no-store');
  expect(response.requestId).toMatch(REQUEST_ID_PATTERN);
  expect(response.body).toMatchObject({
    error: { code, message, requestId: response.requestId },
  });
  expect(Object.keys(response.body as Record<string, unknown>).sort()).toEqual(['error']);
  const error = (response.body as { error: Record<string, unknown> }).error;
  expect(Object.keys(error).sort()).toEqual(['code', 'message', 'requestId']);
  const serialized = JSON.stringify(response.body);
  for (const fact of forbiddenFacts) expect(serialized).not.toContain(fact);
}

test.describe.serial('Pilot cross-organization API security matrix', () => {
  test('returns indistinguishable safe 404s when Channel A probes Channel B or an unknown Channel', async ({
    page,
  }) => {
    await openLogin(page);
    await login(page, 'channelAdminA');
    await expect(page.getByTestId('pilot-channel-commission-audit-ready')).toBeVisible();

    const existing = await fetchSafeError(
      page,
      `/api/v1/channels/${PILOT_E2E_CHANNEL_B_ID}/commission-audit/calculations?limit=1`,
    );
    const unknown = await fetchSafeError(
      page,
      `/api/v1/channels/${UNKNOWN_CHANNEL_ID}/commission-audit/calculations?limit=1`,
    );

    const forbiddenFacts = [PILOT_E2E_CHANNEL_B_ID, UNKNOWN_CHANNEL_ID];
    expectObscuredNotFound(
      existing,
      'COMMISSION_SCOPE_NOT_FOUND',
      '佣金审计范围不存在。',
      forbiddenFacts,
    );
    expectObscuredNotFound(
      unknown,
      'COMMISSION_SCOPE_NOT_FOUND',
      '佣金审计范围不存在。',
      forbiddenFacts,
    );
    const existingError = (existing.body as { error: { code: string; message: string } }).error;
    const unknownError = (unknown.body as { error: { code: string; message: string } }).error;
    expect({ code: existingError.code, message: existingError.message }).toEqual({
      code: unknownError.code,
      message: unknownError.message,
    });
  });

  test('returns indistinguishable safe 404s when Tenant A probes Tenant B or an unknown Tenant', async ({
    page,
  }) => {
    await openLogin(page);
    await login(page, 'tenantAdminA');
    await expect(page.getByRole('button', { name: /安全退出/ })).toBeVisible();

    const existing = await fetchSafeError(
      page,
      `/api/v1/tenants/${PILOT_E2E_TENANT_B_ID}/recharge-orders?limit=1`,
    );
    const unknown = await fetchSafeError(
      page,
      `/api/v1/tenants/${UNKNOWN_TENANT_ID}/recharge-orders?limit=1`,
    );

    const forbiddenFacts = [PILOT_E2E_TENANT_B_ID, UNKNOWN_TENANT_ID];
    expectObscuredNotFound(
      existing,
      'RECHARGE_SCOPE_NOT_FOUND',
      '充值订单范围不存在。',
      forbiddenFacts,
    );
    expectObscuredNotFound(
      unknown,
      'RECHARGE_SCOPE_NOT_FOUND',
      '充值订单范围不存在。',
      forbiddenFacts,
    );
    const existingError = (existing.body as { error: { code: string; message: string } }).error;
    const unknownError = (unknown.body as { error: { code: string; message: string } }).error;
    expect({ code: existingError.code, message: existingError.message }).toEqual({
      code: unknownError.code,
      message: unknownError.message,
    });
  });
});
