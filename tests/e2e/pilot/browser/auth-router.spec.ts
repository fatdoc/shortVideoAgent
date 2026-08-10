import { expect, test, type Page } from '@playwright/test';
import {
  browserStorageKeys,
  login,
  PILOT_E2E_PROJECT_ID,
  PILOT_E2E_SUSPENDABLE_MEMBERSHIP_ID,
} from './fixtures';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

async function openLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('pilot-login-page')).toBeVisible();
}

async function expectPath(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() => {
      const current = new URL(page.url());
      return `${current.pathname}${current.search}${current.hash}`;
    })
    .toBe(expected);
}

test.describe.serial('Pilot Auth and Router browser matrix', () => {
  test('restores a safe protected Platform direct URL after real login', async ({ page }) => {
    await page.goto('/platform/commission-settlements?period=2026-07');
    await expect(page.getByTestId('pilot-login-page')).toBeVisible();
    await expectPath(page, '/login');

    await login(page, 'platformAdmin');

    await expectPath(page, '/platform/commission-settlements?period=2026-07');
    await expect(page.getByTestId('pilot-settlement-draft-form')).toBeVisible();
  });

  test('routes Platform, Channel, and assigned Tenant accounts to frozen defaults', async ({
    browser,
  }) => {
    const cases = [
      {
        key: 'platformAdmin' as const,
        path: '/platform/commission-audit',
        readyTestId: 'pilot-platform-commission-audit-ready',
      },
      {
        key: 'channelAdminA' as const,
        path: '/channel/commission-audit',
        readyTestId: 'pilot-channel-commission-audit-ready',
      },
      {
        key: 'tenantOperatorA' as const,
        path: `/projects/${PILOT_E2E_PROJECT_ID}/brand`,
        readyTestId: 'pilot-route-handoff',
      },
    ];

    for (const entry of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await openLogin(page);
        await login(page, entry.key);
        await expectPath(page, entry.path);
        await expect(page.getByTestId(entry.readyTestId)).toBeVisible();
        await expect(browserStorageKeys(page)).resolves.toEqual({
          localStorageKeys: [],
          sessionStorageKeys: [],
        });
      } finally {
        await context.close();
      }
    }
  });

  test('enters a project-independent Tenant operations route without a project selector', async ({
    page,
  }) => {
    await page.goto('/enterprise/members');
    await expect(page.getByTestId('pilot-login-page')).toBeVisible();

    await login(page, 'tenantAdminA');

    await expectPath(page, '/enterprise/members');
    await expect(page.getByTestId('pilot-members-ready')).toBeVisible();
    await expect(page.getByLabel('当前 Pilot 项目')).toHaveCount(0);
  });

  test('returns scope-obscuring 404 for a cross-scope route', async ({ page }) => {
    await openLogin(page);
    await login(page, 'platformAdmin');
    await expectPath(page, '/platform/commission-audit');

    await page.goto('/channel/commission-audit');

    await expectPath(page, '/channel/commission-audit');
    await expect(page.getByTestId('pilot-route-not-found')).toBeVisible();
    await expect(page.getByTestId('pilot-route-permission-denied')).toHaveCount(0);
  });

  test('returns 403 state for a same-scope account without the required role', async ({ page }) => {
    await openLogin(page);
    await login(page, 'platformSupport');
    await expect(page.getByTestId('pilot-route-permission-denied')).toBeVisible();

    await page.goto('/platform/commission-audit');

    await expectPath(page, '/platform/commission-audit');
    await expect(page.getByTestId('pilot-route-permission-denied')).toBeVisible();
    await expect(page.getByTestId('pilot-route-not-found')).toHaveCount(0);
  });

  test('returns 404 state for an unknown authenticated route', async ({ page }) => {
    await openLogin(page);
    await login(page, 'channelAdminA');
    await expectPath(page, '/channel/commission-audit');

    await page.goto('/pilot/not-a-route');

    await expectPath(page, '/pilot/not-a-route');
    await expect(page.getByTestId('pilot-route-not-found')).toBeVisible();
  });

  test('restores the HttpOnly session after refresh without browser persistence', async ({
    page,
  }) => {
    await openLogin(page);
    await login(page, 'platformAdmin');
    await expectPath(page, '/platform/commission-audit');
    await expect(page.getByTestId('pilot-platform-commission-audit-ready')).toBeVisible();

    await page.reload();

    await expectPath(page, '/platform/commission-audit');
    await expect(page.getByTestId('pilot-platform-commission-audit-ready')).toBeVisible();
    await expect(browserStorageKeys(page)).resolves.toEqual({
      localStorageKeys: [],
      sessionStorageKeys: [],
    });
  });

  test('logs out through the real API and rejects the old browser session', async ({ page }) => {
    await openLogin(page);
    await login(page, 'platformAdmin');
    await expectPath(page, '/platform/commission-audit');

    await page.getByRole('button', { name: '安全退出' }).click();

    await expectPath(page, '/login');
    await expect(page.getByTestId('pilot-login-page')).toBeVisible();
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      return {
        status: response.status,
        requestId: response.headers.get('x-request-id'),
        body: await response.json(),
      };
    });
    expect(result.status).toBe(401);
    expect(result.requestId).toMatch(REQUEST_ID_PATTERN);
    expect(result.body).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  });

  test('invalidates an existing member session after an authorized suspend', async ({
    browser,
  }) => {
    const memberContext = await browser.newContext();
    const adminContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const adminPage = await adminContext.newPage();

    try {
      await openLogin(memberPage);
      await login(memberPage, 'tenantSuspendableA');
      await expectPath(memberPage, '/projects');

      await openLogin(adminPage);
      await login(adminPage, 'tenantAdminA');
      await expect.poll(() => new URL(adminPage.url()).pathname).toMatch(/^\/projects(?:\/|$)/);

      const suspension = await adminPage.evaluate(async (membershipId) => {
        const response = await fetch(
          `/api/v1/organizations/current/members/${membershipId}/suspend`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ expectedVersion: 1 }),
          },
        );
        return {
          status: response.status,
          requestId: response.headers.get('x-request-id'),
          body: await response.json(),
        };
      }, PILOT_E2E_SUSPENDABLE_MEMBERSHIP_ID);

      expect(suspension.status).toBe(200);
      expect(suspension.requestId).toMatch(REQUEST_ID_PATTERN);
      expect(suspension.body).toMatchObject({
        member: {
          membershipId: PILOT_E2E_SUSPENDABLE_MEMBERSHIP_ID,
          status: 'suspended',
          version: 2,
        },
      });

      await memberPage.reload();

      await expectPath(memberPage, '/login');
      await expect(memberPage.getByTestId('pilot-login-page')).toBeVisible();
      const sessionStatus = await memberPage.evaluate(async () =>
        fetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' }).then(
          (response) => response.status,
        ),
      );
      expect(sessionStatus).toBe(401);
    } finally {
      await memberContext.close();
      await adminContext.close();
    }
  });
});
