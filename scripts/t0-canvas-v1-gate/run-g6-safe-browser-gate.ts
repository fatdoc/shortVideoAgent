import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import knex from '../../apps/control-api/node_modules/knex/knex.mjs';
import storyKnex from '../../apps/storycanvas/node_modules/knex/knex.mjs';
import { runStoryCanvasMigrations } from '../../apps/storycanvas/src/lib/storycanvasMigrations.js';

import { resetMigrateSeedPilotE2e } from '../../apps/control-api/src/e2e/resetSeed.js';
import {
  pilotE2eFixtureIds,
  pilotE2eGoldenPathInputs,
} from '../../apps/control-api/src/e2e/fixtures.js';
import { payloadDigest } from '../../apps/control-api/src/projects/digest.js';
import { PostgresContentStore } from '../../apps/control-api/src/projects/repository.js';
import { createStoryboardDraftRevision } from '../../apps/control-api/src/storyboards/contract.js';
import { PostgresStoryboardAuthorityStore } from '../../apps/control-api/src/storyboards/repository.js';
import { StoryboardAuthorityService } from '../../apps/control-api/src/storyboards/service.js';
import { ProjectGrantTokenService } from '../../apps/control-api/src/production/grantToken.js';
import { PostgresProductionStore } from '../../apps/control-api/src/production/repository.js';
import {
  assertCanvasWorkspaceAuthorityMatchesRequest,
  parseCanvasWorkspaceAuthorityRequestV01,
  parseCanvasWorkspaceAuthorityV01,
} from '../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js';

const rootDir = path.resolve(import.meta.dirname, '../..');
const controlRoot = path.join(rootDir, 'apps/control-api');
const storyRoot = path.join(rootDir, 'apps/storycanvas');
const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL
  ?? 'postgresql://127.0.0.1:5432/videoagent_control_test';
const controlPort = 10601;
const storyPort = 10588;
const webPort = 5177;
const controlOrigin = `http://127.0.0.1:${controlPort}`;
const storyOrigin = `http://127.0.0.1:${storyPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const projectName = 'Pilot E2E Assigned Project';
const sourceBytes = Buffer.from([0xff, 0xd8, 0xff]);
const sourceChecksum = `sha256:${createHash('sha256').update(sourceBytes).digest('hex')}`;
const storageReference = 'g6-safe/virtual-character.jpg';

type SafeChild = {
  name: string;
  process: ChildProcess;
  logs: string[];
};

function secret(): string {
  return randomBytes(48).toString('base64url');
}

function providerDisabledEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const output = { ...environment };
  for (const key of Object.keys(output)) {
    if (/^(?:ARK_|SEEDANCE_|BYTEPLUS_|VOLCENGINE_)/u.test(key)) delete output[key];
  }
  return output;
}

async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`G6_PORT_${port}_BUSY`)));
    server.listen(port, '127.0.0.1', () => server.close((error) => error ? reject(error) : resolve()));
  });
}

function spawnSafe(name: string, command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): SafeChild {
  const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  const logs: string[] = [];
  const capture = (chunk: Buffer) => {
    const value = chunk.toString('utf8');
    logs.push(value);
    if (logs.join('').length > 256_000) logs.splice(0, Math.max(1, logs.length - 20));
  };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);
  return { name, process: child, logs };
}

async function waitForUrl(url: string, child: SafeChild, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.process.exitCode !== null) throw new Error(`${child.name}_EXITED_BEFORE_READY`);
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status < 500) return;
    } catch {
      // Bounded readiness retry; no response or secret-bearing detail is logged.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${child.name}_NOT_READY`);
}

async function stop(child: SafeChild | undefined): Promise<void> {
  if (!child || child.process.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.process.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.process.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.process.kill('SIGTERM');
  });
}

function actor() {
  return {
    userId: pilotE2eFixtureIds.users.tenantOperatorA,
    membershipId: pilotE2eFixtureIds.memberships.tenantOperatorA,
    organizationId: pilotE2eFixtureIds.tenants.tenantA,
    organizationType: 'TENANT' as const,
    tenantId: pilotE2eFixtureIds.tenants.tenantA,
    membershipVersion: 1,
    primaryRole: 'content_operator' as const,
    roles: ['content_operator' as const],
  };
}

async function seedProductionAuthority(projectGrantSecret: string) {
  const database = knex({ client: 'pg', connection: databaseUrl, pool: { min: 0, max: 1 } });
  try {
    const content = new PostgresContentStore(database);
    const currentActor = actor();
    const projectId = pilotE2eFixtureIds.project;
    const briefPayload = {
      objective: 'Validate the G6 no-provider blocked browser boundary.',
      audience: ['internal-pilot-reviewers'],
      platforms: ['douyin'],
      brandPolicySnapshot: {
        facts: [],
        prohibitedTerms: [],
        requiredDisclosures: ['TEST only; no paid provider dispatch'],
        sourceDigest: `sha256:${'c'.repeat(64)}`,
      },
    };
    await content.createBriefVersion(currentActor, projectId, briefPayload, {
      operation: `brief.create:${projectId}`,
      key: 'g6-safe-brief-v1',
      payload: { payload: briefPayload },
    });
    const scriptPayload = {
      title: 'G6 无 Provider 安全浏览器脚本',
      content: '欢迎来到门店。本次仅验证无 Provider 时的安全阻断，不生成付费视频。',
    };
    const script = await content.createScriptVersion(currentActor, projectId, scriptPayload, {
      operation: `script.create:${projectId}`,
      key: 'g6-safe-script-v1',
      payload: { payload: scriptPayload },
    });
    if (!script) throw new Error('G6_SCRIPT_SEED_FAILED');
    await content.createApproval(
      currentActor,
      projectId,
      script.value.id,
      { status: 'approved', factRiskStatus: 'cleared' },
      {
        operation: `script.approval.create:${projectId}:${script.value.id}`,
        key: 'g6-safe-script-approval-v1',
        payload: { status: 'approved', factRiskStatus: 'cleared' },
      },
    );
    const scriptDigest = `sha256:${payloadDigest(scriptPayload)}`;
    const storyboard = new StoryboardAuthorityService(new PostgresStoryboardAuthorityStore(database));
    const source = pilotE2eGoldenPathInputs.storyboard;
    const draft = createStoryboardDraftRevision({
      objectType: 'StoryboardDraftRevision',
      contractVersion: '0.2',
      status: 'draft',
      tenantId: currentActor.tenantId,
      projectId,
      approvedScriptVersionId: script.value.id,
      approvedScriptDigest: scriptDigest,
      draftRevisionId: source.draftRevisionId,
      revisionNumber: 1,
      previousRevisionId: null,
      shots: [
        {
          shotId: source.shotId,
          sequence: 1,
          description: '门店入口由安全虚拟讲解员介绍招牌套餐',
          durationSeconds: 6,
          sourceMode: 'generated',
        },
      ],
      sourceReceipt: {
        providerId: 'storycanvas',
        sourceSystem: 'storycanvas',
        sourceContractVersion: '0.2',
        commandId: source.sourceCommandId,
        receiptId: source.sourceReceiptId,
        receiptDigest: `sha256:${'b'.repeat(64)}`,
        receivedAt: '2026-08-14T02:00:00.000Z',
      },
      generationPolicy: source.generationPolicy,
      validationSummary: { status: 'passed', issueCodes: [] },
      createdAt: '2026-08-14T02:00:01.000Z',
    });
    const storyboardVersion = await storyboard.createVersion(currentActor, projectId, {
      draft,
      idempotencyKey: source.idempotencyKey,
    });
    await storyboard.createApproval(currentActor, projectId, storyboardVersion.value.id, {
      expectedVersion: 1,
      status: 'approved',
      factRiskStatus: 'cleared',
      idempotencyKey: 'g6-safe-storyboard-approval-v1',
    });
    const production = new PostgresProductionStore(
      database,
      new ProjectGrantTokenService(projectGrantSecret, 'g6-safe-kid'),
    );
    const productionPackage = await production.createPackage(
      currentActor,
      projectId,
      {
        scriptVersionId: script.value.id,
        storyboardVersionId: storyboardVersion.value.id,
        capabilityRequirements: ['video.generate'],
        expiresInSeconds: 600,
      },
      {
        operation: 'production.package.create',
        key: 'g6-safe-package-v1',
        scope: { projectId },
        payload: {
          scriptVersionId: script.value.id,
          storyboardVersionId: storyboardVersion.value.id,
          capabilityRequirements: ['video.generate'],
          expiresInSeconds: 600,
        },
      },
    );
    if (!productionPackage) throw new Error('G6_PACKAGE_SEED_FAILED');
    const packageId = productionPackage.value.packageId;
    const grant = await production.issueGrant(
      currentActor,
      projectId,
      {
        packageId,
        requestedCapabilities: ['video.generate'],
        requestedScopes: ['production.package.read', 'production.task.write'],
        ttlSeconds: 600,
      },
      {
        operation: 'production.grant.issue',
        key: 'g6-safe-grant-v1',
        scope: { projectId },
        payload: {
          packageId,
          requestedCapabilities: ['video.generate'],
          requestedScopes: ['production.package.read', 'production.task.write'],
          ttlSeconds: 600,
        },
      },
    );
    if (!grant) throw new Error('G6_GRANT_SEED_FAILED');
    return { projectId, packageId };
  } finally {
    await database.destroy();
  }
}

function cookieValue(response: Response): string | null {
  const raw = response.headers.get('set-cookie');
  return raw?.split(';', 1)[0] ?? null;
}

async function prepareReusableAsset(input: {
  email: string;
  password: string;
  projectId: string;
  packageId: string;
  controlAssetRoot: string;
  internalToken: string;
}) {
  let cookie = '';
  const request = async (
    origin: string,
    route: string,
    init: RequestInit,
    expected: number,
  ): Promise<{ response: Response; body: Record<string, unknown> }> => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(`${origin}${route}`, { ...init, headers, redirect: 'error' });
    const rotated = cookieValue(response);
    if (rotated) cookie = rotated;
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status !== expected) throw new Error(`G6_SETUP_HTTP_${response.status}_${route}`);
    return { response, body };
  };

  await request(controlOrigin, '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: input.email, password: input.password }),
  }, 200);
  const csrfRead = await request(controlOrigin, `/api/v1/projects/${input.projectId}/canvas-assets`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  }, 200);
  const csrf = csrfRead.response.headers.get('x-csrf-token');
  if (!csrf) throw new Error('G6_SETUP_CSRF_MISSING');
  const activation = await request(
    controlOrigin,
    `/api/v1/projects/${input.projectId}/production-packages/${input.packageId}/canvas-activation`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: webOrigin,
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ activationAttemptId: randomUUID() }),
    },
    201,
  );
  const entry = activation.body.entry as Record<string, unknown>;
  const opened = await request(storyOrigin, '/api/production/pilot/canvas/bootstrap', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: webOrigin,
      'x-storycanvas-csrf': 'pilot-canvas-bootstrap-v1',
    },
    body: JSON.stringify({
      handle: entry.handle,
      tenantId: entry.tenantId,
      projectId: entry.projectId,
      packageId: entry.packageId,
    }),
  }, 200);
  const canvasSessionId = String(opened.body.canvasSessionId);

  const filePath = path.join(input.controlAssetRoot, storageReference);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, sourceBytes, { mode: 0o600 });
  const created = await request(controlOrigin, `/api/v1/projects/${input.projectId}/canvas-assets`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: webOrigin,
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({
      packageId: input.packageId,
      canvasSessionId,
      category: 'virtual_character',
      displayName: 'G6 安全虚拟讲解员',
      provenance: { kind: 'customer_upload', sourceAssetId: null },
      rights: {
        status: 'pending',
        basis: 'customer_owned',
        validFrom: null,
        validUntil: null,
      },
      storageReference,
      checksum: sourceChecksum,
      reuseScope: 'project',
      controlledPreviewUrl: null,
    }),
  }, 201);
  const assetId = String(created.body.assetId);
  await request(
    controlOrigin,
    `/api/v1/projects/${input.projectId}/canvas-assets/${assetId}/rights-transitions`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: webOrigin,
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({
        status: 'authorized',
        validFrom: new Date(Date.now() - 60_000).toISOString(),
        validUntil: null,
      }),
    },
    200,
  );
  await request(
    controlOrigin,
    `/api/v1/projects/${input.projectId}/canvas-assets/${assetId}/approval-transitions`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: webOrigin,
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ status: 'approved' }),
    },
    200,
  );

  // Fixed-stage diagnostic: exercise the same Control authority response through the
  // frozen Story parser without emitting request/response bodies, paths, or credentials.
  const diagnosticActivation = await request(
    controlOrigin,
    `/api/v1/projects/${input.projectId}/production-packages/${input.packageId}/canvas-activation`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: webOrigin,
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ activationAttemptId: randomUUID() }),
    },
    201,
  );
  const diagnosticEntry = diagnosticActivation.body.entry as Record<string, unknown>;
  const diagnosticOpened = await request(storyOrigin, '/api/production/pilot/canvas/bootstrap', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: webOrigin,
      'x-storycanvas-csrf': 'pilot-canvas-bootstrap-v1',
    },
    body: JSON.stringify({
      handle: diagnosticEntry.handle,
      tenantId: diagnosticEntry.tenantId,
      projectId: diagnosticEntry.projectId,
      packageId: diagnosticEntry.packageId,
    }),
  }, 200);
  const authorityRequest = parseCanvasWorkspaceAuthorityRequestV01({
    objectType: 'CanvasWorkspaceAuthorityRequest',
    contractVersion: '0.1',
    tenantId: diagnosticEntry.tenantId,
    projectId: diagnosticEntry.projectId,
    packageId: diagnosticEntry.packageId,
    canvasSessionId: diagnosticOpened.body.canvasSessionId,
    actorId: pilotE2eFixtureIds.users.tenantOperatorA,
    requestId: `g6-stage-${randomUUID()}`,
    occurredAt: new Date().toISOString(),
  });
  const authorityResponse = await fetch(`${controlOrigin}/api/v1/internal/canvas-workspace-authorities`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-production-plane-internal-token': input.internalToken,
      'x-request-id': authorityRequest.requestId,
    },
    body: JSON.stringify(authorityRequest),
  });
  const authorityContentType = authorityResponse.headers.get('content-type')?.toLowerCase() ?? '';
  if (authorityResponse.status !== 200 || !authorityContentType.includes('application/json')) {
    throw new Error(`G6_STAGE_AUTHORITY_HTTP_${authorityResponse.status}`);
  }
  const authorityProjection = parseCanvasWorkspaceAuthorityV01(await authorityResponse.json());
  assertCanvasWorkspaceAuthorityMatchesRequest(authorityProjection, authorityRequest);
  process.stdout.write('[g6-safe-browser] CONTROL_AUTHORITY_HTTP_200_STORY_PARSE_PASS\n');
  return { assetId };
}

async function runBrowser(environment: NodeJS.ProcessEnv): Promise<void> {
  const playwrightCli = path.join(rootDir, 'node_modules/@playwright/test/cli.js');
  const child = spawn(process.execPath, [
    playwrightCli,
    'test',
    '--config',
    'scripts/t0-canvas-v1-gate/playwright.g6-no-provider.config.ts',
    ...(process.env.G6_BROWSER_PROJECT ? ['--project', process.env.G6_BROWSER_PROJECT] : []),
  ], { cwd: rootDir, env: { ...environment, NODE_OPTIONS: '' }, stdio: 'inherit', shell: false });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(new Error('G6_BROWSER_SIGNAL')) : resolve(code ?? 1));
  });
  if (exitCode !== 0) throw new Error('G6_SAFE_BROWSER_RED');
}

function assertSafeLogs(children: SafeChild[], secrets: string[]) {
  const combined = children.map(({ logs }) => logs.join('')).join('\n');
  for (const value of secrets) {
    if (value && combined.includes(value)) throw new Error('G6_SERVICE_LOG_SECRET_LEAK');
  }
  if (/seedance|ark_api_key|providerAssetId|providerGroupId|asset:\/\//iu.test(combined)) {
    throw new Error('G6_SERVICE_LOG_PROVIDER_DETAIL_LEAK');
  }
}

async function storyPostcondition(dataRoot: string): Promise<Record<string, number>> {
  const database = storyKnex({
    client: 'better-sqlite3',
    connection: { filename: path.join(dataRoot, 'db2.sqlite') },
    useNullAsDefault: true,
  });
  try {
    const tables = [
      'sc_canvas_v1_documents',
      'sc_canvas_v1_asset_records',
      'sc_canvas_v1_requirements',
      'sc_canvas_v1_readiness',
      'sc_media_assets',
      'sc_external_mappings',
    ];
    const output: Record<string, number> = {};
    for (const table of tables) {
      const [{ count }] = await database(table).count<{ count: number | string }[]>({ count: '*' });
      output[table] = Number(count);
    }
    return output;
  } finally {
    await database.destroy();
  }
}

async function initializeDedicatedStoryRoot(dataRoot: string, externalProjectId: string): Promise<void> {
  const database = storyKnex({
    client: 'better-sqlite3',
    connection: { filename: path.join(dataRoot, 'db2.sqlite') },
    useNullAsDefault: true,
  });
  try {
    await database.raw('PRAGMA foreign_keys = ON');
    for (const tableName of ['o_project', 'o_script', 'o_storyboard', 'o_image', 'o_video']) {
      await database.schema.createTable(tableName, (table) => {
        table.integer('id').primary();
        if (tableName === 'o_project') table.text('name');
      });
    }
    await database('o_project').insert({ id: 1, name: projectName });
    await runStoryCanvasMigrations(database);
    await database('sc_external_mappings').insert({
      id: randomUUID(),
      system: 'saas-control-plane',
      entityType: 'project',
      localId: '1',
      externalId: externalProjectId,
      metadataJson: '{}',
      createdAt: new Date().toISOString(),
    });
  } finally {
    await database.destroy();
  }
}

async function main(): Promise<void> {
  if (!/_test$/u.test(new URL(databaseUrl).pathname.slice(1))) {
    throw new Error('G6_DEDICATED_TEST_DATABASE_REQUIRED');
  }
  await Promise.all([controlPort, storyPort, webPort].map(assertPortFree));
  const seeded = await resetMigrateSeedPilotE2e({
    ...process.env,
    PILOT_E2E: 'true',
    CONTROL_API_TEST_DATABASE_URL: databaseUrl,
    PILOT_E2E_CONTROL_API_PORT: String(controlPort),
    PILOT_E2E_WEB_PORT: String(webPort),
  });
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cv6-g6-safe-browser-'));
  const controlAssetRoot = path.join(tempRoot, 'control-assets');
  const storyDataRoot = path.join(tempRoot, 'story-data');
  await mkdir(controlAssetRoot, { recursive: true });
  await mkdir(storyDataRoot, { recursive: true });
  const independentSecrets = {
    SESSION_SECRET: secret(),
    PROJECT_GRANT_SIGNING_SECRET: secret(),
    PRODUCTION_PLANE_INTERNAL_TOKEN: secret(),
    REGISTRATION_IDEMPOTENCY_SECRET: secret(),
    RECHARGE_PAYMENT_DIGEST_SECRET: secret(),
    TEST_PAYMENT_INTERNAL_TOKEN: secret(),
    CANVAS_APPROVAL_FINGERPRINT_SECRET: secret(),
    CANVAS_ASSET_CSRF_SECRET: secret(),
    CANVAS_ACTIVATION_IDEMPOTENCY_SECRET: secret(),
  };
  const authority = await seedProductionAuthority(independentSecrets.PROJECT_GRANT_SIGNING_SECRET);
  await initializeDedicatedStoryRoot(storyDataRoot, authority.projectId);
  const shared = providerDisabledEnvironment({ ...process.env, PILOT_E2E: 'true' });
  let control: SafeChild | undefined;
  let story: SafeChild | undefined;
  let web: SafeChild | undefined;
  const children: SafeChild[] = [];
  try {
    control = spawnSafe(
      'CONTROL_API',
      path.join(controlRoot, 'node_modules/.bin/tsx'),
      ['src/server.ts'],
      controlRoot,
      {
        ...shared,
        ...independentSecrets,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        DATABASE_SSL: 'disable',
        CONTROL_API_HOST: '127.0.0.1',
        CONTROL_API_PORT: String(controlPort),
        PROJECT_GRANT_ACTIVE_KID: 'g6-safe-kid',
        CANVAS_ASSET_STORAGE_ROOT: controlAssetRoot,
        CANVAS_ASSET_ALLOWED_ORIGINS: webOrigin,
        APP_VERSION: 'cv6-g6-safe-browser',
      },
    );
    children.push(control);
    await waitForUrl(`${controlOrigin}/health/ready`, control);

    story = spawnSafe(
      'STORYCANVAS',
      path.join(storyRoot, 'node_modules/.bin/tsx'),
      ['src/app.ts'],
      storyRoot,
      {
        ...shared,
        NODE_ENV: 'prod',
        ELECTRON_RUN_AS_NODE: '1',
        STORYCANVAS_PILOT_CANVAS_ENABLED: 'true',
        CONTROL_API_BASE_URL: controlOrigin,
        PRODUCTION_PLANE_INTERNAL_TOKEN: independentSecrets.PRODUCTION_PLANE_INTERNAL_TOKEN,
        STORYCANVAS_PILOT_ALLOWED_ORIGIN: webOrigin,
        STORYCANVAS_DATA_ROOT: storyDataRoot,
        STORYCANVAS_PORT: String(storyPort),
      },
    );
    children.push(story);
    await waitForUrl(`${storyOrigin}/api/production/pilot/canvas/capability`, story);

    const credential = seeded.secrets.accounts.tenantOperatorA;
    const asset = await prepareReusableAsset({
      ...credential,
      ...authority,
      controlAssetRoot,
      internalToken: independentSecrets.PRODUCTION_PLANE_INTERNAL_TOKEN,
    });

    web = spawnSafe(
      'VITE',
      path.join(rootDir, 'node_modules/.bin/vite'),
      ['--host', '127.0.0.1', '--port', String(webPort), '--mode', 'test'],
      rootDir,
      {
        ...shared,
        VITE_APP_MODE: 'pilot',
        VITE_CONTROL_API_BASE_URL: webOrigin,
        VITE_PILOT_E2E: 'true',
        PILOT_E2E_AB_GOLDEN_PATH: 'true',
        PILOT_E2E_CONTROL_API_PORT: String(controlPort),
        PILOT_E2E_STORYCANVAS_PORT: String(storyPort),
      },
    );
    children.push(web);
    await waitForUrl(`${webOrigin}/login`, web);

    try {
      await runBrowser({
        ...shared,
        CANVAS_V1_BROWSER_BASE_URL: `${webOrigin}/`,
        CANVAS_V1_BROWSER_PROJECT_ID: authority.projectId,
        CANVAS_V1_BROWSER_PACKAGE_ID: authority.packageId,
        CANVAS_V1_BROWSER_PROJECT_NAME: projectName,
        CANVAS_V1_BROWSER_LOGIN_EMAIL: credential.email,
        CANVAS_V1_BROWSER_LOGIN_PASSWORD: credential.password,
      });
    } catch (error) {
      const postcondition = await storyPostcondition(storyDataRoot);
      process.stderr.write(`[g6-safe-browser] STORY_DB_POSTCONDITION ${JSON.stringify(postcondition)}\n`);
      throw error;
    }
    assertSafeLogs(children, [
      ...Object.values(independentSecrets),
      ...Object.values(seeded.secrets.accounts).map(({ password }) => password),
      databaseUrl,
    ]);
    const evidenceDir = path.join(rootDir, 'docs/program/t0-canvas-v1/evidence/g6-safe-browser');
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(path.join(evidenceDir, 'summary.json'), `${JSON.stringify({
      baseline: 'e747111d281170ccc061a600a908c0fdf12bf4ed',
      testedIntegration: '9cb7b1f9f1e37636b116e510fff175a52fcf0938',
      databaseName: new URL(databaseUrl).pathname.slice(1),
      origins: { control: controlOrigin, story: storyOrigin, browser: webOrigin },
      canonicalUrl: `${webOrigin}/production/canvas/${authority.projectId}?packageId=${authority.packageId}`,
      assetId: asset.assetId,
      sourceByteSize: sourceBytes.byteLength,
      sourceMimeType: 'image/jpeg',
      providerConfigured: false,
      approvalRequests: 0,
      commandRequests: 0,
      paidProviderCalls: 0,
      result: 'SAFE_NO_PROVIDER_BLOCKED_READINESS',
    }, null, 2)}\n`, { mode: 0o600 });
  } finally {
    await stop(web);
    await stop(story);
    await stop(control);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

try {
  await main();
  process.stdout.write('[g6-safe-browser] SAFE_NO_PROVIDER_BROWSER_PASS\n');
} catch (error) {
  const code = error instanceof Error ? error.message : 'G6_SAFE_BROWSER_FAILED';
  process.stderr.write(`[g6-safe-browser] ${code}\n`);
  process.exitCode = 1;
}
