import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { PilotProcessHarness, type PilotManagedProcess } from './pilotProcessHarness.js';
import {
  attestSharedCanvasRemediationGit,
  type SharedCanvasRemediationGitProbe,
} from './sharedCanvasRemediationGitAttestation.js';
import {
  coordinateSharedCanvasRemediationCandidateAcceptance,
  type SharedCanvasRemediationCandidateCoordinatorDependencies,
} from './sharedCanvasRemediationCandidateCoordinator.js';
import {
  assertSafeSharedCanvasRemediationLifecycleEvidence,
  type SharedCanvasRegistryLifecycleEvent,
} from './sharedCanvasRemediationLifecycleOracle.js';
import {
  runSharedCanvasNoPostgresRuntimeAcceptance,
  type SharedCanvasSyntheticControlApiHandle,
} from './sharedCanvasNoPostgresRuntimeAcceptance.js';
import {
  assertSafePilotCanvasErrorResponse,
  assertSafePilotCanvasRuntimeOutput,
} from './sharedCanvasRemediationSecurityOracle.js';

const execFileAsync = promisify(execFile);
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const SAFE_PORT_MIN = 1;
const SAFE_PORT_MAX = 65_535;
const MAX_HTTP_BODY_BYTES = 1024 * 1024;
const HTTP_TIMEOUT_MS = 5_000;
const PROCESS_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const SESSION_COOKIE = 'videoagent_session=synthetic-pilot-session';
const CSRF_VALUE = 'pilot-canvas-bootstrap-v1';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const PACKAGE_ID = '33333333-3333-4333-8333-333333333333';
const ENTRY_HANDLE = `ce_${'A'.repeat(32)}`;
const ENTRY = Object.freeze({
  handle: ENTRY_HANDLE,
  tenantId: TENANT_ID,
  projectId: PROJECT_ID,
  packageId: PACKAGE_ID,
});
const EXPECTED_IDEMPOTENCY_KEY = 'sc-redeem-v1-304358a6391678210a94d8dd5951fe13b548ea55f640f2aa';
const CLI_KEYS = [
  'repository-root',
  'candidate-root',
  'baseline',
  'red',
  'parser-implementation',
  'lifecycle-implementation',
  'log-implementation',
  'parser',
  'lifecycle',
  'log',
  'docs',
  'candidate',
  'required-a',
  'storycanvas-port',
  'allowed-origin',
] as const;
const COMMIT_CHAIN_KEYS = [
  'baseline',
  'red',
  'parserImplementation',
  'lifecycleImplementation',
  'logImplementation',
  'parser',
  'lifecycle',
  'log',
  'docs',
  'candidate',
] as const;
const EXACT_IMPLEMENTATION_WRITE_SETS = {
  parserImplementation: [
    'M\tapps/storycanvas/src/app.ts',
    'M\tapps/storycanvas/src/routes/production/pilot/canvas/bootstrap.ts',
    'M\tapps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts',
    'M\tapps/storycanvas/src/services/storycanvas/pilotCanvasRemediation.test.ts',
  ],
  lifecycleImplementation: [
    'M\tapps/storycanvas/src/app.ts',
    'M\tapps/storycanvas/src/routes/production/pilot/canvas/bootstrap.ts',
    'M\tapps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts',
    'M\tapps/storycanvas/src/services/storycanvas/pilotCanvasRemediation.test.ts',
  ],
  logImplementation: ['M\tapps/storycanvas/src/app.ts', 'M\tapps/storycanvas/src/utils/db.ts'],
} as const;
const FORBIDDEN_EXACT_PATHS = new Set([
  'apps/storycanvas/data/vendor/byteplus.ts',
  'src/app/Router.tsx',
  'src/app/Router.pilot.test.tsx',
  'src/services/pilotStoryCanvasBridge.ts',
  'src/services/pilotStoryCanvasBridge.test.ts',
  'src/config/pilotE2eProxy.ts',
  'src/config/pilotE2eProxy.test.ts',
  'tests/e2e/pilot/browser/ab-golden-path.spec.ts',
]);

export type SharedCanvasRemediationCandidateRunnerErrorCode =
  | 'SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID'
  | 'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED'
  | 'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED'
  | 'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED'
  | 'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED';

export class SharedCanvasRemediationCandidateRunnerError extends Error {
  constructor(readonly code: SharedCanvasRemediationCandidateRunnerErrorCode) {
    super(code);
    this.name = 'SharedCanvasRemediationCandidateRunnerError';
    this.stack = undefined;
  }
}

export interface SharedCanvasRemediationCandidateCommits {
  baseline: string;
  red: string;
  parserImplementation: string;
  lifecycleImplementation: string;
  logImplementation: string;
  parser: string;
  lifecycle: string;
  log: string;
  docs: string;
  candidate: string;
  requiredA: string;
}

export interface SharedCanvasRemediationCandidateArgs {
  repositoryRoot: string;
  candidateRoot: string;
  storyCanvasPort: number;
  allowedOrigin: string;
  commits: SharedCanvasRemediationCandidateCommits;
}

export type SharedCanvasRemediationCandidateRunnerDependencies =
  SharedCanvasRemediationCandidateCoordinatorDependencies;

export interface SharedCanvasRemediationCandidateRunnerResult {
  status: 'candidate-acceptance-ready';
  code: 'B_REMEDIATION_CANDIDATE_ACCEPTANCE_READY';
  gitAttested: true;
  httpLogValidated: true;
  runtimeHarnessValidated: true;
  lifecycleValidated: true;
}

export interface SharedCanvasRemediationCandidateRunnerOptions {
  dependencies?: SharedCanvasRemediationCandidateRunnerDependencies;
}

type CandidateRuntime = {
  harness: PilotProcessHarness;
  process: PilotManagedProcess;
  controlApi: SyntheticControlApi;
  dataRoot: string;
  internalToken: string;
  shutdownDurationMs: number | null;
  stopped: boolean;
};

type HttpEvidence = {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: unknown;
};

type SyntheticControlApi = SharedCanvasSyntheticControlApiHandle & {
  requests(): readonly SyntheticControlApiRequest[];
};

type SyntheticControlApiRequest = {
  method: string;
  pathname: string;
  headers: Readonly<Record<string, string | undefined>>;
  body: unknown;
};

function fail(code: SharedCanvasRemediationCandidateRunnerErrorCode): never {
  throw new SharedCanvasRemediationCandidateRunnerError(code);
}

function isSafeAbsolutePath(value: string): boolean {
  return (
    value !== '' &&
    value === value.trim() &&
    path.isAbsolute(value) &&
    path.normalize(value) !== path.parse(value).root
  );
}

function exactHttpOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'http:' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

export function parseSharedCanvasRemediationCandidateArgs(
  argv: readonly string[],
): SharedCanvasRemediationCandidateArgs {
  try {
    if (!Array.isArray(argv) || argv.length !== CLI_KEYS.length * 2) {
      fail('SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID');
    }

    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 2) {
      const flag = argv[index];
      const value = argv[index + 1];
      if (
        typeof flag !== 'string' ||
        typeof value !== 'string' ||
        !flag.startsWith('--') ||
        !CLI_KEYS.includes(flag.slice(2) as (typeof CLI_KEYS)[number]) ||
        values.has(flag.slice(2)) ||
        value === '' ||
        value !== value.trim()
      ) {
        fail('SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID');
      }
      values.set(flag.slice(2), value);
    }
    if (CLI_KEYS.some((key) => !values.has(key))) {
      fail('SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID');
    }

    const repositoryRoot = values.get('repository-root')!;
    const candidateRoot = values.get('candidate-root')!;
    const allowedOrigin = values.get('allowed-origin')!;
    const storyCanvasPortText = values.get('storycanvas-port')!;
    const storyCanvasPort = Number(storyCanvasPortText);
    if (
      !isSafeAbsolutePath(repositoryRoot) ||
      !isSafeAbsolutePath(candidateRoot) ||
      path.resolve(repositoryRoot) === path.resolve(candidateRoot) ||
      !exactHttpOrigin(allowedOrigin) ||
      !/^\d{1,5}$/.test(storyCanvasPortText) ||
      !Number.isSafeInteger(storyCanvasPort) ||
      storyCanvasPort < SAFE_PORT_MIN ||
      storyCanvasPort > SAFE_PORT_MAX
    ) {
      fail('SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID');
    }

    const commits: SharedCanvasRemediationCandidateCommits = {
      baseline: values.get('baseline')!,
      red: values.get('red')!,
      parserImplementation: values.get('parser-implementation')!,
      lifecycleImplementation: values.get('lifecycle-implementation')!,
      logImplementation: values.get('log-implementation')!,
      parser: values.get('parser')!,
      lifecycle: values.get('lifecycle')!,
      log: values.get('log')!,
      docs: values.get('docs')!,
      candidate: values.get('candidate')!,
      requiredA: values.get('required-a')!,
    };
    if (
      Object.values(commits).some((commit) => !FULL_COMMIT_SHA.test(commit)) ||
      new Set(COMMIT_CHAIN_KEYS.map((key) => commits[key])).size !== COMMIT_CHAIN_KEYS.length
    ) {
      fail('SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID');
    }

    return { repositoryRoot, candidateRoot, storyCanvasPort, allowedOrigin, commits };
  } catch (error) {
    if (error instanceof SharedCanvasRemediationCandidateRunnerError) throw error;
    fail('SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID');
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function contractDigest(value: Record<string, unknown>): string {
  const unsigned = structuredClone(value);
  delete unsigned.payloadDigest;
  return `sha256:${sha256(canonicalJson(unsigned))}`;
}

function createRedemptionFixture(nowMs = Date.now()) {
  const time = (offsetMinutes: number) => new Date(nowMs + offsetMinutes * 60_000).toISOString();
  const scriptDigest = `sha256:${sha256('approved-script')}`;
  const storyboardDigest = `sha256:${sha256('approved-storyboard')}`;
  const accessToken = 'eyJhbGciOiJIUzI1NiJ9.c2hhcmVkLWNhbnZhcy1ydW5uZXI.c2lnbmF0dXJl';
  const productionPackage: Record<string, unknown> = {
    objectType: 'ProjectProductionPackage',
    contractVersion: '0.3',
    status: 'ready',
    tenantId: TENANT_ID,
    projectId: PROJECT_ID,
    packageId: PACKAGE_ID,
    idempotencyKey: 'package-fixture-v1',
    occurredAt: time(-5),
    payloadDigest: 'sha256:placeholder',
    packageVersion: 1,
    organizationId: TENANT_ID,
    scriptVersionId: '44444444-4444-4444-8444-444444444444',
    storyboardVersionId: '55555555-5555-4555-8555-555555555555',
    approvedScriptDigest: scriptDigest,
    approvedStoryboardDigest: storyboardDigest,
    briefSnapshot: {
      briefVersionId: '66666666-6666-4666-8666-666666666666',
      objective: 'Synthetic acceptance objective',
      audience: ['acceptance'],
      platforms: ['synthetic'],
    },
    brandPolicySnapshot: {
      facts: [],
      prohibitedTerms: [],
      requiredDisclosures: [],
      sourceDigest: `sha256:${sha256('brand-policy')}`,
    },
    approvedScript: {
      scriptVersionId: '44444444-4444-4444-8444-444444444444',
      payloadDigest: scriptDigest,
      content: 'Synthetic approved script.',
      approvedAt: time(-4),
      approvedBy: '77777777-7777-4777-8777-777777777777',
    },
    approvedStoryboard: {
      storyboardVersionId: '55555555-5555-4555-8555-555555555555',
      scriptVersionId: '44444444-4444-4444-8444-444444444444',
      scriptPayloadDigest: scriptDigest,
      payloadDigest: storyboardDigest,
      approvedAt: time(-4),
      approvedBy: '77777777-7777-4777-8777-777777777777',
    },
    storyboard: [
      {
        shotId: 'shot-1',
        sequence: 1,
        description: 'Synthetic acceptance shot.',
        durationSeconds: 3,
        sourceMode: 'generated',
      },
    ],
    target: { aspectRatio: '9:16', durationSeconds: 3, container: 'mp4', videoCodec: 'h264' },
    capabilityRequirements: ['image.generate'],
    createdAt: time(-5),
    expiresAt: time(60),
  };
  productionPackage.payloadDigest = contractDigest(productionPackage);

  const grant: Record<string, unknown> = {
    objectType: 'ProjectGrant',
    contractVersion: '0.2',
    tenantId: TENANT_ID,
    projectId: PROJECT_ID,
    packageId: PACKAGE_ID,
    idempotencyKey: 'grant-fixture-v1',
    occurredAt: time(-2),
    payloadDigest: 'sha256:placeholder',
    grantId: '88888888-8888-4888-8888-888888888888',
    capabilities: ['image.generate'],
    scopes: ['production.package.read'],
    tokenDigest: `sha256:${sha256(accessToken)}`,
    keyId: 'synthetic-kid',
    issuedAt: time(-2),
    expiresAt: time(30),
  };
  grant.payloadDigest = contractDigest(grant);

  return {
    objectType: 'CanvasEntryRedemption',
    contractVersion: '0.1',
    ...ENTRY,
    consumedAt: time(-1),
    productionPackage,
    grant,
    tokenType: 'Bearer',
    accessToken,
    replayed: false,
  } as const;
}

function headersRecord(headers: Headers): Readonly<Record<string, string>> {
  return Object.fromEntries(headers.entries());
}

async function readJsonResponse(response: Response): Promise<HttpEvidence> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('HTTP_RESPONSE_INVALID');
  }
  return { status: response.status, headers: headersRecord(response.headers), body };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    size += chunk.byteLength;
    if (size > MAX_HTTP_BODY_BYTES) throw new Error('SYNTHETIC_REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

function singleIncomingHeader(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
        reject(error);
      else resolve();
    });
  });
}

async function startSyntheticControlApi(internalToken: string): Promise<SyntheticControlApi> {
  const requests: SyntheticControlApiRequest[] = [];
  const redemption = createRedemptionFixture();
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const headers = {
        accept: request.headers.accept,
        cookie: request.headers.cookie,
        'cache-control': request.headers['cache-control'],
        'content-type': request.headers['content-type'],
        'idempotency-key': singleIncomingHeader(request.headers['idempotency-key']),
        'x-production-plane-internal-token': singleIncomingHeader(
          request.headers['x-production-plane-internal-token'],
        ),
      };
      const rawBody = request.method === 'POST' ? await readRequestBody(request) : Buffer.alloc(0);
      let body: unknown = undefined;
      if (rawBody.length > 0) body = JSON.parse(rawBody.toString('utf8'));
      requests.push({ method: request.method ?? '', pathname: requestUrl.pathname, headers, body });

      if (requestUrl.pathname === '/api/v1/auth/session' && request.method === 'GET') {
        if (
          request.headers.accept !== 'application/json' ||
          request.headers.cookie !== SESSION_COOKIE ||
          request.headers['cache-control'] !== 'no-store' ||
          rawBody.length !== 0
        ) {
          writeJson(response, 500, { error: { code: 'SYNTHETIC_SESSION_CONTRACT_INVALID' } });
          return;
        }
        writeJson(response, 200, {
          session: {
            activeContext: {
              organizationType: 'TENANT',
              tenantId: TENANT_ID,
              roles: ['tenant_admin'],
            },
          },
        });
        return;
      }

      if (
        requestUrl.pathname === '/api/v1/internal/canvas-entries/redeem' &&
        request.method === 'POST'
      ) {
        if (
          request.headers.accept !== 'application/json' ||
          request.headers['content-type'] !== 'application/json' ||
          request.headers['cache-control'] !== 'no-store' ||
          request.headers['idempotency-key'] !== EXPECTED_IDEMPOTENCY_KEY ||
          request.headers['x-production-plane-internal-token'] !== internalToken ||
          !exactKeys(body, ['handle', 'tenantId', 'projectId', 'packageId']) ||
          canonicalJson(body) !== canonicalJson(ENTRY)
        ) {
          writeJson(response, 500, { error: { code: 'SYNTHETIC_REDEMPTION_CONTRACT_INVALID' } });
          return;
        }
        writeJson(response, 200, redemption, { 'idempotency-replayed': 'false' });
        return;
      }

      writeJson(response, 404, { error: { code: 'SYNTHETIC_ROUTE_NOT_FOUND' } });
    } catch {
      writeJson(response, 500, { error: { code: 'SYNTHETIC_CONTROL_API_FAILED' } });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await closeHttpServer(server);
    throw new Error('SYNTHETIC_CONTROL_API_START_FAILED');
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    port: address.port,
    requestCount: () => requests.length,
    requests: () => requests.map((request) => ({ ...request, headers: { ...request.headers } })),
    close: () => closeHttpServer(server),
  };
}

function createStoryCanvasProcessSpec(input: {
  candidateRoot: string;
  controlApiOrigin: string;
  allowedOrigin: string;
  dataRoot: string;
  internalToken: string;
  storyCanvasPort: number;
}) {
  const storyCanvasRoot = path.join(input.candidateRoot, 'apps/storycanvas');
  const tsx = path.join(storyCanvasRoot, 'node_modules/.bin/tsx');
  return {
    command: tsx,
    args: ['src/app.ts'],
    cwd: storyCanvasRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NODE_ENV: 'prod',
      ELECTRON_RUN_AS_NODE: '1',
      STORYCANVAS_PILOT_CANVAS_ENABLED: 'true',
      CONTROL_API_BASE_URL: input.controlApiOrigin,
      PRODUCTION_PLANE_INTERNAL_TOKEN: input.internalToken,
      STORYCANVAS_PILOT_ALLOWED_ORIGIN: input.allowedOrigin,
      STORYCANVAS_DATA_ROOT: input.dataRoot,
      STORYCANVAS_PORT: String(input.storyCanvasPort),
    },
    readinessProbe: (managed: PilotManagedProcess) =>
      managed
        .output()
        .stdout.includes(`PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:${input.storyCanvasPort}`),
    readinessTimeoutMs: PROCESS_TIMEOUT_MS,
    readinessIntervalMs: 50,
    outputLimitBytes: 64 * 1024,
    stopTimeoutMs: SHUTDOWN_TIMEOUT_MS,
  } as const;
}

async function startCandidateRuntime(
  args: SharedCanvasRemediationCandidateArgs,
): Promise<CandidateRuntime> {
  const dataRoot = await mkdtemp(
    path.join(path.dirname(args.candidateRoot), 'storycanvas-remediation-'),
  );
  const internalToken = randomBytes(32).toString('base64url');
  const controlApi = await startSyntheticControlApi(internalToken);
  const harness = new PilotProcessHarness();
  try {
    const process = await harness.start(
      createStoryCanvasProcessSpec({
        candidateRoot: args.candidateRoot,
        controlApiOrigin: controlApi.origin,
        allowedOrigin: args.allowedOrigin,
        dataRoot,
        internalToken,
        storyCanvasPort: args.storyCanvasPort,
      }),
    );
    return {
      harness,
      process,
      controlApi,
      dataRoot,
      internalToken,
      shutdownDurationMs: null,
      stopped: false,
    };
  } catch (error) {
    await Promise.allSettled([
      harness.stop(),
      controlApi.close(),
      rm(dataRoot, { recursive: true, force: true }),
    ]);
    throw error;
  }
}

async function stopCandidateRuntime(runtime: CandidateRuntime): Promise<void> {
  if (runtime.stopped) return;
  runtime.stopped = true;
  const startedAt = Date.now();
  let cleanupFailed = false;
  try {
    await runtime.harness.stop();
  } catch {
    cleanupFailed = true;
  }
  runtime.shutdownDurationMs = Date.now() - startedAt;
  try {
    assertSafePilotCanvasRuntimeOutput({
      expectedState: 'ready-stopped',
      ...runtime.process.output(),
      dataRoot: runtime.dataRoot,
      sensitiveValues: [runtime.internalToken],
    });
  } catch {
    cleanupFailed = true;
  }
  try {
    await runtime.controlApi.close();
  } catch {
    cleanupFailed = true;
  }
  try {
    await rm(runtime.dataRoot, { recursive: true, force: true });
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) throw new Error('CANDIDATE_RUNTIME_CLEANUP_FAILED');
}

async function bootstrapRequest(
  args: SharedCanvasRemediationCandidateArgs,
  body: string,
  requestId: string,
): Promise<Response> {
  return fetchWithTimeout(
    `http://127.0.0.1:${args.storyCanvasPort}/api/production/pilot/canvas/bootstrap`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: args.allowedOrigin,
        cookie: SESSION_COOKIE,
        'x-storycanvas-csrf': CSRF_VALUE,
        'x-request-id': requestId,
      },
      body,
    },
  );
}

function assertSuccessfulBootstrap(evidence: HttpEvidence, requestId: string): void {
  if (
    evidence.status !== 200 ||
    evidence.headers['cache-control'] !== 'no-store' ||
    evidence.headers['x-request-id'] !== requestId ||
    !exactKeys(evidence.body, [
      'schemaVersion',
      'status',
      'projectId',
      'packageId',
      'canvasSessionId',
      'expiresAt',
      'requestId',
    ]) ||
    evidence.body.schemaVersion !== 'pilot-canvas-bootstrap.v1' ||
    evidence.body.status !== 'ready' ||
    evidence.body.projectId !== PROJECT_ID ||
    evidence.body.packageId !== PACKAGE_ID ||
    typeof evidence.body.canvasSessionId !== 'string' ||
    !/^pcs_[A-Za-z0-9_-]{32,64}$/.test(evidence.body.canvasSessionId) ||
    typeof evidence.body.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(evidence.body.expiresAt)) ||
    evidence.body.requestId !== requestId
  ) {
    throw new Error('BOOTSTRAP_RESPONSE_INVALID');
  }
}

async function validateHttpLogAgainstCandidate(
  args: SharedCanvasRemediationCandidateArgs,
): Promise<{ malformedValidated: true; oversizedValidated: true; runtimeLogValidated: true }> {
  const runtime = await startCandidateRuntime(args);
  const malformedBody = '{"handle":"HTTP_SECRET_MUST_NOT_LEAK_20260813"';
  const oversizedBody = JSON.stringify({ ...ENTRY, padding: 'X'.repeat(17 * 1024) });
  try {
    const malformed = await readJsonResponse(
      await bootstrapRequest(args, malformedBody, 'shared-canvas-malformed'),
    );
    assertSafePilotCanvasErrorResponse({
      kind: 'malformed-json',
      ...malformed,
      requestBody: malformedBody,
      sensitiveValues: [runtime.internalToken, runtime.dataRoot],
    });
    if (runtime.controlApi.requestCount() !== 0) throw new Error('MALFORMED_REACHED_CONTROL_API');

    const oversized = await readJsonResponse(
      await bootstrapRequest(args, oversizedBody, 'shared-canvas-oversized'),
    );
    assertSafePilotCanvasErrorResponse({
      kind: 'oversized-json',
      ...oversized,
      requestBody: oversizedBody,
      sensitiveValues: [runtime.internalToken, runtime.dataRoot],
    });
    if (runtime.controlApi.requestCount() !== 0) throw new Error('OVERSIZED_REACHED_CONTROL_API');

    const requestId = 'shared-canvas-valid';
    const valid = await readJsonResponse(
      await bootstrapRequest(args, JSON.stringify(ENTRY), requestId),
    );
    assertSuccessfulBootstrap(valid, requestId);
    const requests = runtime.controlApi.requests();
    if (
      runtime.controlApi.requestCount() !== 2 ||
      requests.length !== 2 ||
      requests[0]?.pathname !== '/api/v1/auth/session' ||
      requests[1]?.pathname !== '/api/v1/internal/canvas-entries/redeem'
    ) {
      throw new Error('CONTROL_API_REQUEST_SEQUENCE_INVALID');
    }
  } finally {
    await stopCandidateRuntime(runtime);
  }
  return { malformedValidated: true, oversizedValidated: true, runtimeLogValidated: true };
}

async function validateRuntimeHarnessAgainstCandidate(args: SharedCanvasRemediationCandidateArgs) {
  return runSharedCanvasNoPostgresRuntimeAcceptance(
    {
      repositoryRoot: args.candidateRoot,
      storyCanvasPort: args.storyCanvasPort,
      allowedOrigin: args.allowedOrigin,
    },
    {
      generateSecret: () => randomBytes(32).toString('base64url'),
      createTemporaryDataRoot: () =>
        mkdtemp(path.join(path.dirname(args.candidateRoot), 'storycanvas-no-postgres-')),
      startSyntheticControlApi: async ({ internalToken }) =>
        startSyntheticControlApi(internalToken),
      createProcessHarness: () => {
        const harness = new PilotProcessHarness();
        const originalStart = harness.start.bind(harness);
        harness.start = async (spec) => {
          const managed = await originalStart(spec);
          const malformedBody = '{"fixture":"RUNTIME_SECRET_MUST_NOT_LEAK_20260813"';
          const oversizedBody = JSON.stringify({ ...ENTRY, padding: 'Y'.repeat(17 * 1024) });
          const malformed = await readJsonResponse(
            await bootstrapRequest(args, malformedBody, 'shared-canvas-runtime-malformed'),
          );
          assertSafePilotCanvasErrorResponse({
            kind: 'malformed-json',
            ...malformed,
            requestBody: malformedBody,
          });
          const oversized = await readJsonResponse(
            await bootstrapRequest(args, oversizedBody, 'shared-canvas-runtime-oversized'),
          );
          assertSafePilotCanvasErrorResponse({
            kind: 'oversized-json',
            ...oversized,
            requestBody: oversizedBody,
          });
          const valid = await readJsonResponse(
            await bootstrapRequest(args, JSON.stringify(ENTRY), 'shared-canvas-runtime-valid'),
          );
          assertSuccessfulBootstrap(valid, 'shared-canvas-runtime-valid');
          return managed;
        };
        return harness;
      },
      createStoryCanvasProcessSpec: (input) =>
        createStoryCanvasProcessSpec({ candidateRoot: args.candidateRoot, ...input }),
      removeTemporaryDataRoot: (dataRoot) => rm(dataRoot, { recursive: true, force: true }),
    },
  );
}

async function gitOutput(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024,
    windowsHide: true,
  });
  return result.stdout;
}

const gitProbe: SharedCanvasRemediationGitProbe = async (executable, args, options) => {
  try {
    const result = await execFileAsync(executable, [...args], {
      cwd: options.cwd,
      encoding: 'buffer',
      maxBuffer: options.maxBuffer,
      windowsHide: true,
    });
    return { status: 0, stdout: result.stdout, signal: null, error: undefined };
  } catch (error) {
    const failed = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: Buffer;
      signal?: NodeJS.Signals | null;
    };
    if (typeof failed.code === 'number') {
      return {
        status: failed.code,
        stdout: Buffer.isBuffer(failed.stdout) ? failed.stdout : Buffer.alloc(0),
        signal: failed.signal ?? null,
        error: undefined,
      };
    }
    return { status: null, stdout: Buffer.alloc(0), signal: failed.signal ?? null, error: failed };
  }
};

async function assertCandidateGitContract(
  args: SharedCanvasRemediationCandidateArgs,
): Promise<void> {
  const head = (await gitOutput(args.candidateRoot, ['rev-parse', 'HEAD'])).trim();
  if (head !== args.commits.candidate) throw new Error('CANDIDATE_HEAD_INVALID');

  const chain = await gitOutput(args.repositoryRoot, [
    'rev-list',
    '--reverse',
    `${args.commits.baseline}..${args.commits.candidate}`,
  ]);
  const expectedChain = COMMIT_CHAIN_KEYS.slice(1).map((key) => args.commits[key]);
  if (chain.trim().split('\n').filter(Boolean).join('\n') !== expectedChain.join('\n')) {
    throw new Error('CANDIDATE_CHAIN_INVALID');
  }

  const candidateTree = (
    await gitOutput(args.repositoryRoot, ['show', '-s', '--format=%T', args.commits.candidate])
  ).trim();
  const candidateParentTree = (
    await gitOutput(args.repositoryRoot, [
      'show',
      '-s',
      '--format=%T',
      `${args.commits.candidate}^`,
    ])
  ).trim();
  if (candidateTree !== candidateParentTree) throw new Error('CANDIDATE_NOT_EMPTY');

  for (const role of [
    'parserImplementation',
    'lifecycleImplementation',
    'logImplementation',
  ] as const) {
    const raw = await gitOutput(args.repositoryRoot, [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-r',
      '--no-renames',
      args.commits[role],
    ]);
    const actual = raw.trim().split('\n').filter(Boolean).sort();
    const expected = [...EXACT_IMPLEMENTATION_WRITE_SETS[role]].sort();
    if (actual.join('\n') !== expected.join('\n'))
      throw new Error('IMPLEMENTATION_WRITE_SET_INVALID');
  }

  const aggregate = await gitOutput(args.repositoryRoot, [
    'diff',
    '--name-only',
    `${args.commits.baseline}..${args.commits.candidate}`,
  ]);
  for (const changedPath of aggregate.trim().split('\n').filter(Boolean)) {
    if (changedPath.startsWith('apps/control-api/') || FORBIDDEN_EXACT_PATHS.has(changedPath)) {
      throw new Error('FORBIDDEN_PATH_CHANGED');
    }
  }
}

async function attestGitAgainstCandidate(args: SharedCanvasRemediationCandidateArgs) {
  await assertCandidateGitContract(args);
  return attestSharedCanvasRemediationGit(
    {
      repositoryRoot: args.repositoryRoot,
      commits: {
        baseline: args.commits.baseline,
        red: args.commits.red,
        parser: args.commits.parser,
        lifecycle: args.commits.lifecycle,
        log: args.commits.log,
        docs: args.commits.docs,
        candidate: args.commits.candidate,
        requiredA: args.commits.requiredA,
      },
    },
    { git: gitProbe },
  );
}

function waitForChildExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<{ exitCode: number; durationMs: number }> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('LIFECYCLE_PROBE_TIMEOUT'));
    }, timeoutMs);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('LIFECYCLE_PROBE_FAILED'));
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (signal !== null || code !== 0) reject(new Error('LIFECYCLE_PROBE_FAILED'));
      else resolve({ exitCode: code, durationMs: Date.now() - startedAt });
    });
  });
}

async function validateLifecycleAgainstCandidate(args: SharedCanvasRemediationCandidateArgs) {
  const probeRoot = await mkdtemp(
    path.join(path.dirname(args.candidateRoot), 'storycanvas-lifecycle-'),
  );
  const probePath = path.join(probeRoot, 'probe.mts');
  const capabilityUrl = pathToFileURL(
    path.join(
      args.candidateRoot,
      'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts',
    ),
  ).href;
  const fixture = createRedemptionFixture();
  const probeSource = `
const capabilityModule = await import(${JSON.stringify(`${capabilityUrl}?acceptance=${Date.now()}`)});
const capability = capabilityModule.default ?? capabilityModule;
const { PilotCanvasAuthorityRegistry, closePilotCanvasRuntimeResources } = capability;
let now = Date.parse(${JSON.stringify(new Date().toISOString())});
const events = [];
const closeOrder = [];
const base = ${JSON.stringify(fixture)};
const redemption = (entry, expiresAt) => ({ ...structuredClone(base), ...entry, productionPackage: { ...structuredClone(base.productionPackage), ...entry, organizationId: entry.tenantId, expiresAt }, grant: { ...structuredClone(base.grant), ...entry, expiresAt }, consumedAt: new Date(now - 60000).toISOString() });
const expiries = new Map([
  ['${ENTRY_HANDLE}', now + 60000],
  ['ce_${'B'.repeat(32)}', now + 3600000],
  ['ce_${'C'.repeat(32)}', now + 3600000],
  ['ce_${'D'.repeat(32)}', now + 3600000],
  ['ce_${'E'.repeat(32)}', now + 3600000],
]);
const client = { redeem: async (entry) => redemption(entry, new Date(expiries.get(entry.handle)).toISOString()) };
const registry = new PilotCanvasAuthorityRegistry(client, { capacity: 3, now: () => now, onEvent: (event) => events.push(event) });
const entry = (letter) => ({ handle: 'ce_' + letter.repeat(32), tenantId: '${TENANT_ID}', projectId: '${PROJECT_ID}', packageId: '${PACKAGE_ID}' });
const a = await registry.openEntry(entry('A'));
await registry.openEntry(entry('A'));
await registry.openEntry(entry('B'));
now += 120000;
registry.readServerAuthority(a.authorityId);
await registry.openEntry(entry('C'));
await registry.openEntry(entry('D'));
await registry.openEntry(entry('E'));
const closable = (name) => ({ close(callback) { closeOrder.push(name); callback(); } });
const started = Date.now();
const closeEvidence = await closePilotCanvasRuntimeResources({ signal: 'SIGTERM', timeoutMs: 5000, registry, http: { ...closable('http'), closeAllConnections() {} }, socketIo: closable('socket.io'), webSocket: closable('websocket') });
const durationMs = Date.now() - started;
const evidence = { registry: { capacity: 3, events }, shutdown: { signal: closeEvidence.signal, durationMs, registryCleared: closeEvidence.registryCleared, rawAuthorityReadableAfterShutdown: registry.readServerAuthority(a.authorityId) !== null, httpClosed: closeEvidence.httpClosed && closeOrder[2] === 'http', socketIoClosed: closeEvidence.socketIoClosed && closeOrder[0] === 'socket.io', webSocketClosed: closeEvidence.webSocketClosed && closeOrder[1] === 'websocket', pendingTimerCount: closeEvidence.pendingTimerCount, exitCode: 0 } };
process.stdout.write(JSON.stringify(evidence));
`;
  await writeFile(probePath, probeSource, { encoding: 'utf8', mode: 0o600 });
  const storyCanvasRoot = path.join(args.candidateRoot, 'apps/storycanvas');
  const tsx = path.join(storyCanvasRoot, 'node_modules/.bin/tsx');
  const child = spawn(tsx, [probePath], {
    cwd: storyCanvasRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NODE_ENV: 'test',
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
  child.stderr?.on('data', (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
  try {
    const exit = await waitForChildExit(child, PROCESS_TIMEOUT_MS);
    const stderrText = Buffer.concat(stderr).toString('utf8');
    if (stderrText !== '') throw new Error('LIFECYCLE_STDERR_FORBIDDEN');
    const evidence = JSON.parse(Buffer.concat(stdout).toString('utf8')) as {
      registry: { capacity: number; events: SharedCanvasRegistryLifecycleEvent[] };
      shutdown: Record<string, unknown>;
    };
    evidence.shutdown.exitCode = exit.exitCode;
    return assertSafeSharedCanvasRemediationLifecycleEvidence({
      evidence,
      sensitiveValues: [probeRoot, args.candidateRoot],
    });
  } finally {
    await rm(probeRoot, { recursive: true, force: true });
  }
}

function createDefaultDependencies(
  args: SharedCanvasRemediationCandidateArgs,
): SharedCanvasRemediationCandidateRunnerDependencies {
  return {
    attestGit: () => attestGitAgainstCandidate(args),
    validateHttpLog: () => validateHttpLogAgainstCandidate(args),
    validateRuntimeHarness: () => validateRuntimeHarnessAgainstCandidate(args),
    validateLifecycle: () => validateLifecycleAgainstCandidate(args),
  };
}

export async function runSharedCanvasRemediationCandidate(
  args: SharedCanvasRemediationCandidateArgs,
  options: SharedCanvasRemediationCandidateRunnerOptions = {},
): Promise<SharedCanvasRemediationCandidateRunnerResult> {
  const dependencies = options.dependencies ?? createDefaultDependencies(args);
  try {
    const result = await coordinateSharedCanvasRemediationCandidateAcceptance(dependencies);
    return {
      status: 'candidate-acceptance-ready',
      code: 'B_REMEDIATION_CANDIDATE_ACCEPTANCE_READY',
      gitAttested: result.gitAttested,
      httpLogValidated: result.httpLogValidated,
      runtimeHarnessValidated: result.runtimeHarnessValidated,
      lifecycleValidated: result.lifecycleValidated,
    };
  } catch (error) {
    const code =
      error instanceof Error &&
      [
        'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED',
        'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
        'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED',
        'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED',
      ].includes(error.message)
        ? (error.message as SharedCanvasRemediationCandidateRunnerErrorCode)
        : 'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED';
    fail(code);
  }
}

async function main(): Promise<void> {
  try {
    const args = parseSharedCanvasRemediationCandidateArgs(process.argv.slice(2));
    const result = await runSharedCanvasRemediationCandidate(args);
    process.stdout.write(`${JSON.stringify({ status: result.status, code: result.code })}\n`);
  } catch (error) {
    const code =
      error instanceof SharedCanvasRemediationCandidateRunnerError
        ? error.code
        : 'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED';
    process.stderr.write(`${JSON.stringify({ code })}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
