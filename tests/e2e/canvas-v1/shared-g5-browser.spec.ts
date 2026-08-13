import { expect, test, type Page, type Request } from '@playwright/test';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const projectId = required('CANVAS_V1_BROWSER_PROJECT_ID');
const packageId = required('CANVAS_V1_BROWSER_PACKAGE_ID');
const projectName = required('CANVAS_V1_BROWSER_PROJECT_NAME');
const loginEmail = required('CANVAS_V1_BROWSER_LOGIN_EMAIL');
const loginPassword = required('CANVAS_V1_BROWSER_LOGIN_PASSWORD');
const baseUrl = new URL(required('CANVAS_V1_BROWSER_BASE_URL'));
const forbiddenMarkers = [
  'Idempotency-Key',
  'derivedIdempotencyKey',
  'rawGrant',
  'packageSnapshot',
  'payloadDigest',
  'accessToken',
  'internalToken',
  'providerAssetId',
  'providerGroupId',
  'storageReference',
  'contentBase64',
  'localPath',
  'signedUrl',
  'asset://',
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function jsonBody(request: Request): Record<string, unknown> {
  const raw = request.postData();
  expect(raw, `${request.method()} ${request.url()} requires JSON`).not.toBeNull();
  return JSON.parse(raw ?? '') as Record<string, unknown>;
}

function stableWorkspace(value: Record<string, unknown>) {
  const document = value.document as Record<string, unknown>;
  const project = value.project as Record<string, unknown>;
  const shots = value.shots as Array<Record<string, unknown>>;
  const assets = value.assets as Array<Record<string, unknown>>;
  return {
    projectId: value.projectId,
    packageId: value.packageId,
    projectName: project.projectName,
    documentId: document.documentId,
    documentVersion: document.version,
    shotIds: shots.map((shot) => shot.shotId),
    assetIds: assets.map((asset) => asset.assetId),
  };
}

async function browserSurface(page: Page) {
  return page.evaluate(async () => ({
    url: location.href,
    text: document.body.innerText,
    html: document.documentElement.outerHTML,
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    indexedDbNames:
      typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases()).map(({ name }) => name ?? '')
        : [],
  }));
}

test('real Shared Canvas route hydrates, refreshes, contains authority and binds exact approval', async ({
  page,
}, testInfo) => {
  expect(projectId).toMatch(UUID);
  expect(packageId).toMatch(UUID);

  const consoleOutput: string[] = [];
  const apiUrls: string[] = [];
  const activationRequests: Record<string, unknown>[] = [];
  const approvalRequests: Record<string, unknown>[] = [];
  const commandRequests: Record<string, unknown>[] = [];
  const workspaceResponses: Record<string, unknown>[] = [];
  const approvalResponses: Record<string, unknown>[] = [];
  const browserApiResponses: unknown[] = [];
  const responseReads: Promise<void>[] = [];

  page.on('console', (message) => consoleOutput.push(`${message.type()}:${message.text()}`));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return;
    apiUrls.push(request.url());
    expect(url.origin).toBe(baseUrl.origin);
    const headers = request.headers();
    expect(headers.authorization).toBeUndefined();
    expect(headers['idempotency-key']).toBeUndefined();
    if (url.pathname.endsWith('/canvas-activation')) {
      expect(headers.origin).toBe(baseUrl.origin);
      expect(headers['x-csrf-token']).toBeTruthy();
      activationRequests.push(jsonBody(request));
    }
    if (url.pathname === '/api/production/pilot/canvas/bootstrap') {
      expect(headers.origin).toBe(baseUrl.origin);
      expect(headers['x-storycanvas-csrf']).toBe('pilot-canvas-bootstrap-v1');
    }
    if (url.pathname.startsWith('/api/production/pilot/canvas/v1/')) {
      expect(headers['x-canvas-session-id']).toMatch(/^pcs_[A-Za-z0-9_-]{24,128}$/u);
    }
    if (url.pathname.endsWith('/canvas-command-approvals')) {
      expect(headers.origin).toBe(baseUrl.origin);
      expect(headers['x-csrf-token']).toBeTruthy();
      approvalRequests.push(jsonBody(request));
    }
  });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    const contentType = response.headers()['content-type']?.toLowerCase() ?? '';
    if (pathname.startsWith('/api/') && contentType.includes('application/json')) {
      responseReads.push(
        (async () => {
          const value = (await response.json()) as Record<string, unknown>;
          browserApiResponses.push(value);
          if (pathname.endsWith('/canvas-command-approvals')) approvalResponses.push(value);
          if (pathname === '/api/production/pilot/canvas/v1/workspace') {
            workspaceResponses.push(value);
          }
        })(),
      );
    }
  });

  let releaseDispatch: (() => void) | undefined;
  const dispatchObserved = new Promise<void>((resolve) => {
    releaseDispatch = resolve;
  });
  await page.route('**/api/production/pilot/canvas/v1/commands', async (route) => {
    commandRequests.push(jsonBody(route.request()));
    releaseDispatch?.();
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify({
        error: {
          code: 'CANVAS_PROVIDER_UNAVAILABLE',
          message: 'Browser transport gate blocks paid provider dispatch.',
          retryable: true,
          requestId: 'req-cv6-browser-no-paid-provider',
        },
      }),
    });
  });

  await page.goto('/login');
  await page.getByTestId('pilot-login-email').fill(loginEmail);
  await page.getByTestId('pilot-login-password').fill(loginPassword);
  await page.getByTestId('pilot-login-submit').click();
  await expect(page.getByTestId('pilot-app-shell')).toBeVisible();

  const canonicalPath = `/production/canvas/${projectId}?packageId=${packageId}`;
  await page.goto(canonicalPath);
  await expect(page.getByText(projectName, { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '生成提示' })).toBeVisible();
  await expect(page.getByRole('button', { name: '生成当前镜头' })).toBeEnabled();
  await Promise.all(responseReads);
  expect(workspaceResponses.length).toBeGreaterThanOrEqual(1);
  const initialWorkspace = stableWorkspace(workspaceResponses.at(-1)!);

  await page.reload();
  await expect(page.getByText(projectName, { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '生成提示' })).toBeVisible();
  await Promise.all(responseReads);
  expect(workspaceResponses.length).toBeGreaterThanOrEqual(2);
  expect(stableWorkspace(workspaceResponses.at(-1)!)).toEqual(initialWorkspace);

  await page.getByRole('button', { name: '生成当前镜头' }).click();
  await page.getByRole('button', { name: '确认并继续' }).click();
  await dispatchObserved;
  await Promise.all(responseReads);

  expect(approvalRequests).toHaveLength(1);
  expect(approvalResponses).toHaveLength(1);
  expect(commandRequests).toHaveLength(1);
  const approval = approvalRequests[0];
  const action = approval.action as Record<string, unknown>;
  const command = commandRequests[0];
  expect(Object.keys(action).sort()).toEqual(['commandId', 'payload']);
  expect(action.commandId).toBe(command.commandId);
  expect(action.payload).toEqual(command.payload);
  expect(approval.commandType).toBe(command.commandType);
  expect(approval.packageId).toBe(command.packageId);
  expect(approval.canvasSessionId).toBe(command.canvasSessionId);
  expect(command.approvalId).toBe(approvalResponses[0].approvalId);

  const surface = await browserSurface(page);
  const attemptIds = activationRequests.map((request) => request.activationAttemptId as string);
  expect(attemptIds.length).toBeGreaterThanOrEqual(2);
  for (const attempt of attemptIds) {
    expect(attempt).toMatch(UUID);
    expect(
      `${surface.url}\n${surface.text}\n${surface.html}\n${JSON.stringify(consoleOutput)}`,
    ).not.toContain(attempt);
  }
  expect(surface.url).toBe(`${baseUrl.origin}${canonicalPath}`);
  expect(surface.localStorage).toEqual([]);
  expect(surface.sessionStorage).toEqual([]);
  expect(surface.indexedDbNames).toEqual([]);
  const auditedBrowserEvidence =
    `${surface.url}\n${surface.text}\n${surface.html}\n${JSON.stringify(consoleOutput)}\n` +
    `${JSON.stringify(browserApiResponses)}\n${JSON.stringify(approvalRequests)}\n` +
    JSON.stringify(commandRequests);
  for (const marker of forbiddenMarkers) {
    expect(auditedBrowserEvidence.toLowerCase()).not.toContain(marker.toLowerCase());
  }
  const observedPaths = apiUrls.map((url) => new URL(url).pathname);
  for (const requiredPath of [
    `/api/v1/projects/${projectId}/production-packages/${packageId}/canvas-activation`,
    '/api/production/pilot/canvas/bootstrap',
    '/api/production/pilot/canvas/v1/bootstrap',
    '/api/production/pilot/canvas/v1/workspace',
    `/api/v1/projects/${projectId}/canvas-command-approvals`,
    '/api/production/pilot/canvas/v1/commands',
  ])
    expect(observedPaths).toContain(requiredPath);
  for (const url of apiUrls) expect(new URL(url).origin).toBe(baseUrl.origin);
  const sessionCookie = (await page.context().cookies()).find(
    ({ name }) => name === 'videoagent_session',
  );
  expect(sessionCookie?.httpOnly).toBe(true);

  expect(process.env.CANVAS_V1_BROWSER_CAPTURE_EVIDENCE).toBe('true');
  await page.screenshot({
    path: testInfo.outputPath(`canvas-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
