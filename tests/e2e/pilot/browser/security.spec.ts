import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  account,
  installEmailVerificationBridge,
  invitationToken,
  login,
  PILOT_E2E_CHANNEL_B_ID,
  PILOT_E2E_TENANT_B_ID,
} from './fixtures';

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

interface BrowserDiagnostics {
  consoleMessages: Array<{ type: string; text: string }>;
  pageErrors: string[];
  requestFailures: string[];
}

const PILOT_ACCOUNT_KEYS = [
  'platformAdmin',
  'platformSupport',
  'channelAdminA',
  'channelAdminB',
  'tenantAdminA',
  'tenantOperatorA',
  'tenantSuspendableA',
  'tenantAdminB',
] as const;
const PILOT_INVITATION_KEYS = ['valid', 'expired', 'revoked', 'exhausted'] as const;
const TERMS_CONTENT_DIGEST = createHash('sha256')
  .update(
    [
      '# Pilot E2E 服务条款',
      '',
      '仅用于 TEST 浏览器验证。该环境不代表真实支付、到账、提现或自动打款。',
    ].join('\n'),
    'utf8',
  )
  .digest('hex');
const INTERNAL_RENDER_MARKERS = [
  'contentDigest',
  'content_digest',
  'providerPayload',
  'provider_payload',
  'calculationSnapshot',
  'calculation_snapshot',
  'accessToken',
  'tokenDigest',
  'passwordHash',
  'requestDigest',
  'projectGrant',
  'SELECT * FROM',
  'INSERT INTO control_plane',
  'UPDATE control_plane',
  'stack trace',
] as const;

function fixtureSecrets(): Array<{ label: string; value: string }> {
  const verificationToken = process.env.PILOT_E2E_EMAIL_VERIFICATION_TOKEN;
  if (!verificationToken) throw new Error('PILOT_E2E_EMAIL_VERIFICATION_TOKEN_REQUIRED');
  return [
    ...PILOT_ACCOUNT_KEYS.map((key) => ({
      label: `account password (${key})`,
      value: account(key).password,
    })),
    ...PILOT_INVITATION_KEYS.map((key) => ({
      label: `invitation token (${key})`,
      value: invitationToken(key),
    })),
    { label: 'email verification token', value: verificationToken },
    { label: 'Terms content digest', value: TERMS_CONTENT_DIGEST },
    { label: 'internal calculation snapshot', value: 'PILOT_E2E_TEST_NON_QUOTE' },
  ];
}

function monitorBrowserDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
  };
  page.on('console', (message) => {
    diagnostics.consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname;
    diagnostics.requestFailures.push(
      `${request.method()} ${path} ${request.failure()?.errorText ?? 'UNKNOWN_NETWORK_ERROR'}`,
    );
  });
  return diagnostics;
}

function expectNoSecretLeak(
  surface: string,
  label: string,
  secrets: ReadonlyArray<{ label: string; value: string }>,
): void {
  for (const secret of secrets) {
    expect(surface.includes(secret.value), `${label} exposed ${secret.label}`).toBe(false);
  }
}

async function auditCurrentPage(
  page: Page,
  label: string,
  secrets: ReadonlyArray<{ label: string; value: string }>,
): Promise<void> {
  const surface = await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText,
    html: document.documentElement.outerHTML,
    documentCookie: document.cookie,
    localStorageKeys: Object.keys(window.localStorage).sort(),
    sessionStorageKeys: Object.keys(window.sessionStorage).sort(),
  }));
  expect(surface.localStorageKeys, `${label} localStorage must remain empty`).toEqual([]);
  expect(surface.sessionStorageKeys, `${label} sessionStorage must remain empty`).toEqual([]);
  expect(
    surface.documentCookie,
    `${label} must not expose the HttpOnly Session Cookie`,
  ).not.toContain('videoagent_session');
  expectNoSecretLeak(
    `${surface.url}\n${surface.text}\n${surface.html}\n${surface.documentCookie}`,
    label,
    secrets,
  );
  const normalizedText = surface.text.toLowerCase();
  for (const marker of INTERNAL_RENDER_MARKERS) {
    expect(
      normalizedText.includes(marker.toLowerCase()),
      `${label} rendered internal field or diagnostic marker: ${marker}`,
    ).toBe(false);
  }
}

function expectCleanDiagnostics(
  diagnostics: BrowserDiagnostics,
  secrets: ReadonlyArray<{ label: string; value: string }>,
): void {
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.requestFailures).toEqual([]);
  const safeHttpConsoleErrors = new Set([
    'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
    'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
  ]);
  const unexpectedConsoleErrors = diagnostics.consoleMessages.filter(
    (message) => message.type === 'error' && !safeHttpConsoleErrors.has(message.text),
  );
  expect(unexpectedConsoleErrors).toEqual([]);
  expectNoSecretLeak(JSON.stringify(diagnostics), 'browser diagnostics', secrets);
}

async function expectHttpOnlySession(page: Page): Promise<string> {
  const session = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'videoagent_session',
  );
  expect(session, 'real login must create the Session Cookie').toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');
  return session?.value ?? '';
}

test.describe.serial('Pilot sensitive browser surface matrix', () => {
  test('keeps Platform operations and commercial secrets out of readable browser surfaces', async ({
    page,
  }) => {
    const diagnostics = monitorBrowserDiagnostics(page);
    const secrets = fixtureSecrets();

    await openLogin(page);
    await login(page, 'platformAdmin');
    await expect(page.getByTestId('pilot-platform-commission-audit-ready')).toBeVisible();
    secrets.push({ label: 'Session Cookie', value: await expectHttpOnlySession(page) });
    await auditCurrentPage(page, 'Platform Commission Audit', secrets);

    await page.goto('/platform/terms');
    await expect(page.getByTestId('pilot-terms-documents-ready')).toBeVisible();
    await expect(page.getByTestId('pilot-terms-versions-ready')).toBeVisible();
    await auditCurrentPage(page, 'Platform Terms', secrets);

    await page.goto('/platform/invitations');
    await expect(page.getByTestId('pilot-invitations-empty')).toBeVisible();
    await auditCurrentPage(page, 'Platform Invitations', secrets);

    await page.goto('/platform/members');
    await expect(page.getByTestId('pilot-members-ready')).toBeVisible();
    await auditCurrentPage(page, 'Platform Members', secrets);

    await page.goto('/platform/commission-settlements');
    await expect(page.getByTestId('pilot-settlement-draft-form')).toBeVisible();
    await auditCurrentPage(page, 'Platform TEST Settlement Draft', secrets);

    expectCleanDiagnostics(diagnostics, secrets);
  });

  test('keeps canonical Channel and Tenant commercial pages free of secrets and Demo persistence', async ({
    browser,
  }) => {
    const secrets = fixtureSecrets();
    for (const scope of [
      {
        accountKey: 'channelAdminA' as const,
        readyTestId: 'pilot-channel-commission-audit-ready',
        label: 'Channel Commission Audit',
        path: '/channel/commission-audit',
      },
      {
        accountKey: 'tenantAdminA' as const,
        readyTestId: 'pilot-tenant-recharge-ready',
        label: 'Tenant RechargeOrder Audit',
        path: '/enterprise/recharge-orders',
      },
    ]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const diagnostics = monitorBrowserDiagnostics(page);
      try {
        await openLogin(page);
        await login(page, scope.accountKey);
        await page.goto(scope.path);
        await expect(page.getByTestId(scope.readyTestId)).toBeVisible();
        const scopedSecrets = [
          ...secrets,
          { label: `${scope.label} Session Cookie`, value: await expectHttpOnlySession(page) },
        ];
        await auditCurrentPage(page, scope.label, scopedSecrets);
        expectCleanDiagnostics(diagnostics, scopedSecrets);
      } finally {
        await context.close();
      }
    }
  });

  test('removes public invitation evidence before rendering and leaves no diagnostic or storage residue', async ({
    page,
  }) => {
    await installEmailVerificationBridge(page);
    const diagnostics = monitorBrowserDiagnostics(page);
    const secrets = fixtureSecrets();
    const validInvitation = invitationToken('valid');

    await page.goto('/register');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.evaluate((token) => {
        window.location.assign(`/register?invitation=${encodeURIComponent(token)}`);
      }, validInvitation),
    ]);
    await expect(page.getByTestId('registration-page')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.has('invitation')).toBe(false);
    await expect(page.getByText('渠道邀请注册')).toBeVisible();

    await auditCurrentPage(page, 'Public Registration Invitation', secrets);
    expectCleanDiagnostics(diagnostics, secrets);
  });
});
