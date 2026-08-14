import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

type Account = {
  key: string;
  label: string;
  email: string;
  organizationType: string;
  projectCaseAccess: string;
  expectedProjectSurface: string;
};
type Stage = {
  key: string;
  routeTemplate: string;
  roles: string[];
  requiredMarkerEnvironment: string | null;
  expectedSurfaceTestId: string | null;
  acceptance: string;
};
type Operation = {
  key: string;
  route: string;
  organizationType: string;
  roles: string[];
  expectedTestIds: string[];
  requiredTexts: string[];
  requiredMarkerEnvironment: string | null;
  acceptance: string;
};
type Matrix = {
  accounts: Account[];
  stages: Stage[];
  operations: Operation[];
  forbiddenSuccessSurfaces: { testIds: string[]; phrases: string[] };
};

const matrix = JSON.parse(fs.readFileSync(
  path.resolve(import.meta.dirname, 'full-case-visibility.matrix.json'),
  'utf8',
)) as Matrix;
const password = required('PILOT_LOCAL_ACCOUNT_PASSWORD');
const projectId = required('CANVAS_FULL_CASE_PROJECT_ID');
const packageId = required('CANVAS_FULL_CASE_PACKAGE_ID');
const browserOrigin = requiredOrigin('CANVAS_FULL_CASE_BASE_URL');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
if (!uuidPattern.test(projectId)) throw new Error('CANVAS_FULL_CASE_PROJECT_ID_INVALID');
if (!uuidPattern.test(packageId)) throw new Error('CANVAS_FULL_CASE_PACKAGE_ID_INVALID');

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function requiredOrigin(name: string): string {
  const raw = required(name);
  const parsed = new URL(raw);
  if (
    parsed.origin !== raw ||
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`${name}_INVALID`);
  }
  return parsed.origin;
}

function route(stage: Stage): string {
  return stage.routeTemplate
    .replace(':projectId', projectId)
    .replace(':packageId', packageId);
}

async function login(page: Page, account: Account) {
  await page.goto('/login');
  await page.getByTestId('pilot-login-email').fill(account.email);
  await page.getByTestId('pilot-login-password').fill(password);
  await page.getByTestId('pilot-login-submit').click();
  await expect(page.getByTestId('pilot-app-shell')).toBeVisible();
  await expect(page.getByText(account.label, { exact: false }).first()).toBeVisible();
}

async function assertNoFalseSuccess(page: Page) {
  const text = (await page.locator('body').innerText()).trim();
  expect(text.length).toBeGreaterThan(120);
  for (const testId of matrix.forbiddenSuccessSurfaces.testIds) {
    await expect(page.getByTestId(testId)).toHaveCount(0);
  }
  for (const phrase of matrix.forbiddenSuccessSurfaces.phrases) {
    expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
  }
}

async function assertOperation(page: Page, account: Account, operation: Operation, testInfo: import('@playwright/test').TestInfo) {
  await page.goto(operation.route);
  for (const testId of operation.expectedTestIds) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
  for (const requiredText of operation.requiredTexts) {
    await expect(
      page.getByText(requiredText, { exact: false }).filter({ visible: true }).first(),
    ).toBeVisible();
  }
  if (operation.requiredMarkerEnvironment) {
    await expect(
      page.getByText(required(operation.requiredMarkerEnvironment), { exact: false }).first(),
    ).toBeVisible();
  }
  await assertNoFalseSuccess(page);
  await page.screenshot({
    path: testInfo.outputPath(`${account.key}-${operation.key}-${testInfo.project.name}.png`),
    fullPage: false,
  });
}

for (const account of matrix.accounts) {
  test(`${account.key}: exact role visibility and full-case disposition`, async ({ page }, testInfo) => {
    const approvalRequests: string[] = [];
    const commandRequests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/canvas-command-approvals')) approvalRequests.push(pathname);
      if (pathname.endsWith('/canvas/v1/commands')) commandRequests.push(pathname);
    });
    page.on('response', (response) => {
      const request = response.request();
      const pathname = new URL(response.url()).pathname;
      if (
        pathname.startsWith('/api/')
        && (pathname.includes('/invitations') || pathname.includes('/canvas'))
      ) {
        process.stdout.write(
          `[full-case-http] ${account.key} ${request.method()} ${pathname} ${response.status()}\n`,
        );
      }
    });
    await login(page, account);

    const allowedOperations = matrix.operations.filter(({ roles }) => roles.includes(account.key));
    for (const operation of allowedOperations) {
      await assertOperation(page, account, operation, testInfo);
    }

    if (account.key === 'content_operator') {
      for (const operation of matrix.operations.filter(
        ({ organizationType, roles }) => organizationType === 'TENANT' && !roles.includes(account.key),
      )) {
        await page.goto(operation.route);
        await expect(page.getByTestId('pilot-route-permission-denied')).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`${account.key}-${operation.key}-denied-${testInfo.project.name}.png`),
          fullPage: false,
        });
      }
    }

    if (account.organizationType !== 'TENANT') {
      await page.goto('/projects');
      await expect(page.getByTestId(account.expectedProjectSurface)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`^${browserOrigin.replaceAll('.', '\\.')}/projects$`, 'u'));
      await page.screenshot({
        path: testInfo.outputPath(`${account.key}-${testInfo.project.name}.png`),
        fullPage: false,
      });
      expect(approvalRequests).toEqual([]);
      expect(commandRequests).toEqual([]);
      return;
    }

    for (const stage of matrix.stages.filter(({ roles }) => roles.includes(account.key))) {
      await page.goto(route(stage));
      if (stage.expectedSurfaceTestId) {
        await expect(page.getByTestId(stage.expectedSurfaceTestId)).toBeVisible();
      }
      if (stage.requiredMarkerEnvironment) {
        const marker = required(stage.requiredMarkerEnvironment);
        await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
      }
      await assertNoFalseSuccess(page);
      if (stage.key === 'script' && account.key === 'content_operator') {
        await expect(page.getByText(required('CANVAS_FULL_CASE_BRIEF_MARKER'), { exact: false }).first())
          .toBeVisible();
      }
      if (stage.acceptance === 'real_no_provider_blocked_readiness') {
        await expect(page.getByText('Seedance 能力当前不可用').first()).toBeVisible();
        await expect(page.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
      }
      await page.screenshot({
        path: testInfo.outputPath(`${account.key}-${stage.key}-${testInfo.project.name}.png`),
        fullPage: false,
      });
    }

    expect(approvalRequests).toEqual([]);
    expect(commandRequests).toEqual([]);
  });
}
