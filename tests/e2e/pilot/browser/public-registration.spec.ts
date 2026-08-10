import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  browserStorageKeys,
  installEmailVerificationBridge,
  invitationToken,
  login,
  type PilotE2eInvitationKey,
} from './fixtures';

const TERMS_DOCUMENT_ID = '67000000-0000-4000-8000-000000000001';
const SEEDED_TERMS_VERSION_ID = '67000000-0000-4000-8000-000000000002';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const TEST_PASSWORD = 'Pilot-E2E-Registration-Only-42!';

type RegistrationFacts = {
  email: string;
  displayName: string;
  tenantDisplayName: string;
};

type TermsMutation = {
  status: number;
  requestId: string | null;
  body: Record<string, unknown>;
};

async function openInvitation(page: Page, key: PilotE2eInvitationKey): Promise<void> {
  const token = invitationToken(key);
  await page.goto('/register');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.evaluate((secret) => {
      window.location.assign(`/register?invitation=${encodeURIComponent(secret)}`);
    }, token),
  ]);
  await expect(page.getByTestId('registration-page')).toBeVisible();
  await expect
    .poll(
      async () => {
        try {
          if (new URL(page.url()).searchParams.has('invitation')) return 'query-present';
          return (await page.evaluate(
            (secret) => document.body.textContent?.includes(secret) ?? false,
            token,
          ))
            ? 'body-present'
            : 'clean';
        } catch {
          return 'navigating';
        }
      },
      { message: 'registration invitation token must be removed from URL and rendered content' },
    )
    .toBe('clean');
}

async function expectDirectRegistrationAfterRefresh(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByTestId('registration-page')).toBeVisible();
  await expect(page.getByText('直接注册')).toBeVisible();
  await expect(page.getByTestId('registration-tenant-name')).toBeVisible();
}

async function fillDirectRegistration(page: Page, facts: RegistrationFacts): Promise<void> {
  await page.getByTestId('registration-email').fill(facts.email);
  await page.getByTestId('registration-display-name').fill(facts.displayName);
  await page.getByTestId('registration-tenant-name').fill(facts.tenantDisplayName);
  await page.getByTestId('registration-password').fill(TEST_PASSWORD);
  await page.getByTestId('registration-password-confirm').fill(TEST_PASSWORD);
  await page.getByTestId('registration-terms-accepted').check();
}

async function currentTerms(page: Page): Promise<{ termsVersionId: string; locale: string }> {
  const result = await page.evaluate(async () => {
    const query = new URLSearchParams({ documentCode: 'registration-notice', locale: 'zh-CN' });
    const response = await fetch(`/api/v1/public/terms/current?${query.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    return {
      status: response.status,
      requestId: response.headers.get('x-request-id'),
      body: await response.json(),
    };
  });
  expect(result.status).toBe(200);
  expect(result.requestId).toMatch(REQUEST_ID_PATTERN);
  expect(result.body).toMatchObject({
    terms: { termsVersionId: expect.any(String), locale: 'zh-CN' },
  });
  const terms = (result.body as { terms: { termsVersionId: string; locale: string } }).terms;
  return terms;
}

async function postRegistration(
  page: Page,
  input: RegistrationFacts & {
    termsVersionId: string;
    locale: string;
    idempotencyKey: string;
  },
): Promise<{
  status: number;
  replayed: string | null;
  requestId: string | null;
  body: Record<string, unknown>;
}> {
  return page.evaluate(async (facts) => {
    const verification = window.__PILOT_E2E_EMAIL_VERIFICATION__;
    if (typeof verification !== 'function')
      throw new Error('PILOT_E2E_VERIFICATION_BRIDGE_MISSING');
    const normalizedEmail = facts.email.trim().toLowerCase();
    const response = await fetch('/api/v1/public/registrations', {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password: ['Pilot', 'E2E', 'Registration', 'Only', '42!'].join('-'),
        displayName: facts.displayName,
        tenantDisplayName: facts.tenantDisplayName,
        termsVersionId: facts.termsVersionId,
        locale: facts.locale,
        accepted: true,
        emailVerificationToken: await verification(normalizedEmail),
        idempotencyKey: facts.idempotencyKey,
      }),
    });
    return {
      status: response.status,
      replayed: response.headers.get('idempotency-replayed'),
      requestId: response.headers.get('x-request-id'),
      body: await response.json(),
    };
  }, input);
}

async function openPlatformAdmin(
  browser: Browser,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByTestId('pilot-login-page')).toBeVisible();
  await login(page, 'platformAdmin');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/platform/commission-audit');
  return { page, close: () => context.close() };
}

async function mutateTerms(
  page: Page,
  method: 'POST',
  path: string,
  body: Record<string, unknown>,
): Promise<TermsMutation> {
  return page.evaluate(
    async ({ requestMethod, requestPath, requestBody }) => {
      const response = await fetch(requestPath, {
        method: requestMethod,
        credentials: 'include',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      return {
        status: response.status,
        requestId: response.headers.get('x-request-id'),
        body: await response.json(),
      };
    },
    { requestMethod: method, requestPath: path, requestBody: body },
  );
}

async function publishReplacementTerms(browser: Browser): Promise<string> {
  const admin = await openPlatformAdmin(browser);
  try {
    const draft = await mutateTerms(
      admin.page,
      'POST',
      `/api/v1/platform/terms/documents/${TERMS_DOCUMENT_ID}/versions`,
      {
        versionLabel: 'pilot-e2e-v2',
        content:
          '# Pilot E2E 服务条款 v2\n\n用户须知已更新，必须重新阅读并确认；仍仅用于 TEST 浏览器验证。',
        locale: 'zh-CN',
        mustReaccept: true,
        supersedesTermsVersionId: SEEDED_TERMS_VERSION_ID,
      },
    );
    expect(draft.status).toBe(201);
    expect(draft.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(draft.body).toMatchObject({ termsVersionId: expect.any(String), status: 'DRAFT' });
    const versionId = (draft.body as { termsVersionId: string }).termsVersionId;

    const publication = await mutateTerms(
      admin.page,
      'POST',
      `/api/v1/platform/terms/versions/${versionId}/publish`,
      { effectiveAt: '2026-08-09T00:00:00.000Z' },
    );
    expect(publication.status).toBe(201);
    expect(publication.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(publication.body).toMatchObject({ termsVersionId: versionId, status: 'PUBLISHED' });
    return versionId;
  } finally {
    await admin.close();
  }
}

async function retireTermsVersions(browser: Browser, versionIds: string[]): Promise<void> {
  const admin = await openPlatformAdmin(browser);
  try {
    for (const versionId of versionIds) {
      const retirement = await mutateTerms(
        admin.page,
        'POST',
        `/api/v1/platform/terms/versions/${versionId}/retire`,
        {},
      );
      expect(retirement.status).toBe(200);
      expect(retirement.requestId).toMatch(REQUEST_ID_PATTERN);
      expect(retirement.body).toMatchObject({ termsVersionId: versionId, status: 'RETIRED' });
    }
  } finally {
    await admin.close();
  }
}

test.describe.serial('Pilot public registration browser matrix', () => {
  let replacementTermsVersionId: string | null = null;

  test('rejects a real Terms response when its content digest is corrupted in transit', async ({
    page,
  }) => {
    await page.route('**/api/v1/public/terms/current?**', async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { terms?: { contentDigest?: string } };
      if (body.terms) body.terms.contentDigest = '0'.repeat(64);
      await route.fulfill({ response, json: body });
    });

    await page.goto('/register');

    await expect(page.getByText('注册服务返回了无效响应，请联系管理员')).toBeVisible();
    await expect(page.getByTestId('registration-submit')).toBeDisabled();
  });

  test('loads the canonical published registration Terms through the real API', async ({
    page,
  }) => {
    await page.goto('/register');

    await expect(page.getByTestId('registration-page')).toBeVisible();
    await expect(page.getByText('Pilot E2E 注册服务条款 · pilot-e2e-v1')).toBeVisible();
    await expect(page.getByText(/仅用于 TEST 浏览器验证/)).toBeVisible();
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

  test('completes a real direct registration without creating an authenticated session', async ({
    page,
  }) => {
    await installEmailVerificationBridge(page);
    await page.goto('/register');
    await expect(page.getByText('Pilot E2E 注册服务条款 · pilot-e2e-v1')).toBeVisible();
    await fillDirectRegistration(page, {
      email: 'pilot-e2e-browser-success@example.test',
      displayName: 'Pilot E2E Browser Success',
      tenantDisplayName: 'Pilot E2E Browser Success Tenant',
    });

    await page.getByTestId('registration-submit').click();

    await expect(page.getByTestId('registration-success-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: '注册申请已完成' })).toBeVisible();
    await expect(page.getByText(/直接注册已安全完成/)).toBeVisible();
    const session = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      return { status: response.status, body: await response.json() };
    });
    expect(session).toMatchObject({
      status: 401,
      body: { error: { code: 'AUTHENTICATION_REQUIRED' } },
    });
  });

  test('replays identical registration facts and rejects changed or duplicate facts', async ({
    page,
  }) => {
    await installEmailVerificationBridge(page);
    await page.goto('/register');
    const terms = await currentTerms(page);
    const facts = {
      email: 'pilot-e2e-browser-replay@example.test',
      displayName: 'Pilot E2E Browser Replay',
      tenantDisplayName: 'Pilot E2E Browser Replay Tenant',
      ...terms,
      idempotencyKey: 'pilot-e2e-browser-registration-replay',
    };

    const created = await postRegistration(page, facts);
    expect(created.status).toBe(201);
    expect(created.replayed).toBeNull();
    expect(created.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(created.body).toMatchObject({ registration: { registrationPath: 'DIRECT' } });

    const replayed = await postRegistration(page, facts);
    expect(replayed.status).toBe(200);
    expect(replayed.replayed).toBe('true');
    expect(replayed.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(replayed.body).toEqual(created.body);

    const changed = await postRegistration(page, {
      ...facts,
      displayName: 'Pilot E2E Browser Changed Facts',
    });
    expect(changed.status).toBe(409);
    expect(changed.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(changed.body).toMatchObject({
      error: { code: 'REGISTRATION_IDEMPOTENCY_CONFLICT' },
    });

    const duplicate = await postRegistration(page, {
      ...facts,
      idempotencyKey: 'pilot-e2e-browser-registration-duplicate',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(duplicate.body).toMatchObject({ error: { code: 'REGISTRATION_CONFLICT' } });
  });

  test('fails closed when the browser verification bridge is unavailable', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Pilot E2E 注册服务条款 · pilot-e2e-v1')).toBeVisible();
    await fillDirectRegistration(page, {
      email: 'pilot-e2e-browser-verification-unavailable@example.test',
      displayName: 'Pilot E2E Verification Unavailable',
      tenantDisplayName: 'Pilot E2E Verification Unavailable Tenant',
    });

    await page.getByTestId('registration-submit').click();

    await expect(page.getByTestId('registration-error')).toContainText('邮箱验证服务暂不可用');
    await expect(page.getByTestId('registration-success-page')).toHaveCount(0);
  });

  test('recovers after a failed verification without changing registration facts', async ({
    page,
  }) => {
    await installEmailVerificationBridge(page, 'recovering');
    await page.goto('/register');
    await expect(page.getByText('Pilot E2E 注册服务条款 · pilot-e2e-v1')).toBeVisible();
    await fillDirectRegistration(page, {
      email: 'pilot-e2e-browser-verification-recovery@example.test',
      displayName: 'Pilot E2E Verification Recovery',
      tenantDisplayName: 'Pilot E2E Verification Recovery Tenant',
    });

    await page.getByTestId('registration-submit').click();
    await expect(page.getByTestId('registration-error')).toContainText('邮箱验证失败');

    await page.getByTestId('registration-submit').click();
    await expect(page.getByTestId('registration-success-page')).toBeVisible();
  });

  test('forces renewed acceptance when the submitted Terms version becomes stale', async ({
    browser,
    page,
  }) => {
    await installEmailVerificationBridge(page);
    await page.goto('/register');
    await expect(page.getByText('Pilot E2E 注册服务条款 · pilot-e2e-v1')).toBeVisible();
    await fillDirectRegistration(page, {
      email: 'pilot-e2e-browser-stale-terms@example.test',
      displayName: 'Pilot E2E Stale Terms',
      tenantDisplayName: 'Pilot E2E Stale Terms Tenant',
    });

    replacementTermsVersionId = await publishReplacementTerms(browser);
    await page.getByTestId('registration-submit').click();

    await expect(page.getByText(/用户须知已更新，必须重新阅读并确认/)).toBeVisible();
    await expect(page.getByTestId('registration-error')).toContainText(
      '用户须知已更新，请重新阅读并确认',
    );
    await expect(page.getByTestId('registration-terms-accepted')).not.toBeChecked();
    await expect(page.getByTestId('registration-password')).toHaveValue('');
    await expect(page.getByTestId('registration-password-confirm')).toHaveValue('');
  });

  test('shows a retryable unavailable state after all published Terms are retired', async ({
    browser,
    page,
  }) => {
    expect(replacementTermsVersionId).not.toBeNull();
    await retireTermsVersions(browser, [replacementTermsVersionId!, SEEDED_TERMS_VERSION_ID]);

    await page.goto('/register');

    await expect(page.getByText('用户须知暂未发布')).toBeVisible();
    await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
    await expect(page.getByTestId('registration-submit')).toBeDisabled();
  });
});
