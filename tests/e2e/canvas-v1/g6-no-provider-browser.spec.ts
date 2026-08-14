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
  'ARK_API_KEY',
  'ARK_ASSET_SECRET_KEY',
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function boundedJson(response: import('@playwright/test').Response): Promise<Record<string, unknown> | null> {
  return Promise.race([
    response.json().then((value) => value as Record<string, unknown>).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
  ]);
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
    blocked: shots.map((shot) => {
      const readiness = shot.readiness as Record<string, unknown>;
      return { ready: readiness.ready, reasonCodes: readiness.reasonCodes };
    }),
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

test('G6 no-provider real route is visibly blocked, reload-stable, contained and zero-dispatch', async ({
  page,
}, testInfo) => {
  expect(projectId).toMatch(UUID);
  expect(packageId).toMatch(UUID);
  expect(baseUrl.origin).toBe('http://127.0.0.1:5177');

  const consoleOutput: string[] = [];
  const pageErrors: string[] = [];
  const apiUrls: string[] = [];
  const activationRequests: Record<string, unknown>[] = [];
  const approvalRequests: Record<string, unknown>[] = [];
  const commandRequests: Record<string, unknown>[] = [];
  const workspaceResponses: Record<string, unknown>[] = [];
  const bootstrapResponses: Record<string, unknown>[] = [];
  const browserApiResponses: unknown[] = [];
  const safeResponseFacts: Array<{ path: string; status: number; code: string | null }> = [];
  const responseReads: Promise<void>[] = [];
  const requestHeaderReads: Promise<void>[] = [];
  const nonLoopbackRequests: string[] = [];

  page.on('console', (message) => consoleOutput.push(`${message.type()}:${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'data:', 'blob:'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) {
      nonLoopbackRequests.push(request.url());
    }
    if (!url.pathname.startsWith('/api/')) return;
    apiUrls.push(request.url());
    expect(url.origin).toBe(baseUrl.origin);
    requestHeaderReads.push((async () => {
      const completeHeaders = await request.allHeaders();
      expect(completeHeaders.authorization).toBeUndefined();
      expect(completeHeaders['idempotency-key']).toBeUndefined();
      if (url.pathname.endsWith('/canvas-activation')) {
        expect(completeHeaders.origin).toBe(baseUrl.origin);
        expect(completeHeaders['x-csrf-token']).toBeTruthy();
      }
      if (url.pathname === '/api/production/pilot/canvas/bootstrap') {
        expect(completeHeaders.origin).toBe(baseUrl.origin);
        expect(completeHeaders['x-storycanvas-csrf']).toBe('pilot-canvas-bootstrap-v1');
      }
      if (url.pathname.startsWith('/api/production/pilot/canvas/v1/')) {
        expect(completeHeaders['x-canvas-session-id']).toMatch(/^pcs_[A-Za-z0-9_-]{24,128}$/u);
      }
    })());
    if (url.pathname.endsWith('/canvas-activation')) {
      activationRequests.push(jsonBody(request));
    }
    if (url.pathname.endsWith('/canvas-command-approvals')) {
      approvalRequests.push(jsonBody(request));
    }
    if (url.pathname === '/api/production/pilot/canvas/v1/commands') {
      commandRequests.push(jsonBody(request));
    }
  });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    const contentType = response.headers()['content-type']?.toLowerCase() ?? '';
    if (!pathname.startsWith('/api/') || !contentType.includes('application/json')) return;
    responseReads.push(
      (async () => {
        const value = await boundedJson(response);
        if (!value) return;
        browserApiResponses.push(value);
        const error = value.error as Record<string, unknown> | undefined;
        safeResponseFacts.push({
          path: pathname,
          status: response.status(),
          code: typeof error?.code === 'string' ? error.code : null,
        });
        if (pathname === '/api/production/pilot/canvas/v1/bootstrap') {
          bootstrapResponses.push(value);
        }
        if (pathname === '/api/production/pilot/canvas/v1/workspace') {
          workspaceResponses.push(value);
        }
      })(),
    );
  });

  await page.goto('/login');
  await page.getByTestId('pilot-login-email').fill(loginEmail);
  await page.getByTestId('pilot-login-password').fill(loginPassword);
  await page.getByTestId('pilot-login-submit').click();
  await expect(page.getByTestId('pilot-app-shell')).toBeVisible();

  const canonicalPath = `/production/canvas/${projectId}?packageId=${packageId}`;
  await page.goto(canonicalPath);
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();
  await expect.poll(
    () => safeResponseFacts.some(({ path }) => path === '/api/production/pilot/canvas/v1/bootstrap'),
  ).toBe(true);
  const transportFacts = safeResponseFacts.filter(({ path }) =>
    path === '/api/production/pilot/canvas/bootstrap'
    || path === '/api/production/pilot/canvas/v1/bootstrap');
  expect(
    transportFacts.filter(({ path }) => path === '/api/production/pilot/canvas/bootstrap')
      .every(({ status }) => status === 200),
    JSON.stringify(transportFacts),
  ).toBe(true);
  expect(
    transportFacts.filter(({ path }) => path === '/api/production/pilot/canvas/v1/bootstrap')
      .every(({ status }) => status === 200),
    JSON.stringify(transportFacts),
  ).toBe(true);
  await expect(page.getByText('正在建立 StoryCanvas Pilot 生产会话')).toBeHidden();
  await Promise.all(responseReads);
  expect(
    await page.getByTestId('pilot-storycanvas-boundary-blocked').isVisible().catch(() => false),
    JSON.stringify(safeResponseFacts),
  ).toBe(false);
  await expect(page.getByRole('textbox', { name: '生成提示' })).toBeVisible();
  await expect(page.getByText('Seedance 能力当前不可用').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
  await Promise.all(requestHeaderReads);
  expect(workspaceResponses.length).toBeGreaterThanOrEqual(1);
  expect(bootstrapResponses.length).toBeGreaterThanOrEqual(1);
  const initialWorkspace = stableWorkspace(workspaceResponses.at(-1)!);
  const initialBootstrap = bootstrapResponses.at(-1)!;
  expect(initialBootstrap.status).toBe('blocked');
  for (const shot of (workspaceResponses.at(-1)!.shots as Array<Record<string, unknown>>)) {
    const readiness = shot.readiness as Record<string, unknown>;
    expect(readiness.ready).toBe(false);
    expect(readiness.reasonCodes).toEqual(expect.arrayContaining([
      'PROVIDER_UNAVAILABLE',
      'ENTITY_BINDING_MISSING',
      'CAPABILITY_UNAVAILABLE',
    ]));
  }

  await page.reload();
  await expect(page.getByText(projectName, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
  await expect(page.getByText('Seedance 能力当前不可用').first()).toBeVisible();
  await Promise.all(responseReads);
  await Promise.all(requestHeaderReads);
  expect(workspaceResponses.length).toBeGreaterThanOrEqual(2);
  expect(stableWorkspace(workspaceResponses.at(-1)!)).toEqual(initialWorkspace);

  expect(approvalRequests).toHaveLength(0);
  expect(commandRequests).toHaveLength(0);
  expect(nonLoopbackRequests).toHaveLength(0);
  const attemptIds = activationRequests.map((request) => request.activationAttemptId as string);
  expect(attemptIds.length).toBeGreaterThanOrEqual(2);
  // React StrictMode may issue the exact page-memory attempt twice; reload must mint
  // a different logical attempt while exact duplicates remain identical.
  expect(new Set(attemptIds).size).toBeGreaterThanOrEqual(2);

  const surface = await browserSurface(page);
  expect(surface.url).toBe(`${baseUrl.origin}${canonicalPath}`);
  expect(surface.localStorage).toEqual([]);
  expect(surface.sessionStorage).toEqual([]);
  expect(surface.indexedDbNames).toEqual([]);
  expect(pageErrors).toEqual([]);
  const auditedBrowserEvidence =
    `${surface.url}\n${surface.text}\n${surface.html}\n${JSON.stringify(consoleOutput)}\n` +
    `${JSON.stringify(browserApiResponses)}\n${JSON.stringify(approvalRequests)}\n` +
    JSON.stringify(commandRequests);
  for (const attempt of attemptIds) expect(auditedBrowserEvidence).not.toContain(attempt);
  for (const marker of forbiddenMarkers) {
    expect(auditedBrowserEvidence.toLowerCase()).not.toContain(marker.toLowerCase());
  }

  const observedPaths = apiUrls.map((url) => new URL(url).pathname);
  for (const requiredPath of [
    `/api/v1/projects/${projectId}/production-packages/${packageId}/canvas-activation`,
    '/api/production/pilot/canvas/bootstrap',
    '/api/production/pilot/canvas/v1/bootstrap',
    '/api/production/pilot/canvas/v1/workspace',
  ]) expect(observedPaths).toContain(requiredPath);
  expect(observedPaths).not.toContain(`/api/v1/projects/${projectId}/canvas-command-approvals`);
  expect(observedPaths).not.toContain('/api/production/pilot/canvas/v1/commands');
  const sessionCookie = (await page.context().cookies()).find(
    ({ name }) => name === 'videoagent_session',
  );
  expect(sessionCookie?.httpOnly).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath(`g6-no-provider-${testInfo.project.name}.png`),
    fullPage: false,
  });
});
