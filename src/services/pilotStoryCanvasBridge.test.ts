import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { PilotApiError } from './pilotApiTransport';

const BRIDGE_SOURCE_PATH = resolve(process.cwd(), 'src/services/pilotStoryCanvasBridge.ts');
const FORBIDDEN_DEMO_MODULES = new Set([
  './storyCanvasBridge',
  './controlPlaneMockAdapter',
  '../services/storyCanvasBridge',
  '../services/controlPlaneMockAdapter',
]);
const FORBIDDEN_DEMO_IDENTIFIERS = new Set(['storyCanvasBridge', 'controlPlaneMockAdapter']);
const FORBIDDEN_BROWSER_STORAGE = new Set(['localStorage', 'sessionStorage']);
const FORBIDDEN_DEMO_HEADER = 'x-storycanvas-demo-grant';

function fail(
  code:
    | 'PILOT_STORYCANVAS_BRIDGE_IMPLEMENTATION_REQUIRED'
    | 'PILOT_STORYCANVAS_BRIDGE_SOURCE_REQUIRED'
    | 'PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN'
    | 'PILOT_STORYCANVAS_DEMO_HEADER_FORBIDDEN'
    | 'PILOT_STORYCANVAS_BROWSER_STORAGE_FORBIDDEN'
    | 'PILOT_STORYCANVAS_SECRET_ADAPTER_ARGUMENT_FORBIDDEN',
): never {
  throw new Error(code);
}

function normalizeModuleSpecifier(value: string): string {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/u, '');
}

function propertyNameText(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function isSecretBearingName(value: string): boolean {
  const normalized = value.replace(/[^a-z]/giu, '').toLowerCase();
  return (
    normalized.endsWith('grant') ||
    normalized === 'accesstoken' ||
    normalized === 'grantid' ||
    normalized.includes('digest')
  );
}

function adapterArgumentContainsSecret(node: ts.Node): boolean {
  let forbidden = false;
  const visit = (candidate: ts.Node): void => {
    if (forbidden) return;

    if (
      (ts.isPropertyAssignment(candidate) || ts.isShorthandPropertyAssignment(candidate)) &&
      isSecretBearingName(propertyNameText(candidate.name) ?? '')
    ) {
      forbidden = true;
      return;
    }

    if (
      ts.isIdentifier(candidate) &&
      isSecretBearingName(candidate.text) &&
      candidate.parent !== undefined
    ) {
      forbidden = true;
      return;
    }

    ts.forEachChild(candidate, visit);
  };

  visit(node);
  return forbidden;
}

function assertPilotStoryCanvasBridgeSourcePolicy(source: string): void {
  if (!source.trim()) fail('PILOT_STORYCANVAS_BRIDGE_SOURCE_REQUIRED');

  const sourceFile = ts.createSourceFile(
    BRIDGE_SOURCE_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (FORBIDDEN_DEMO_MODULES.has(normalizeModuleSpecifier(node.moduleSpecifier.text))) {
        fail('PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN');
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      FORBIDDEN_DEMO_MODULES.has(normalizeModuleSpecifier(node.arguments[0].text))
    ) {
      fail('PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN');
    }

    if (ts.isIdentifier(node) && FORBIDDEN_DEMO_IDENTIFIERS.has(node.text)) {
      fail('PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN');
    }

    if (ts.isStringLiteralLike(node) && node.text.toLowerCase() === FORBIDDEN_DEMO_HEADER) {
      fail('PILOT_STORYCANVAS_DEMO_HEADER_FORBIDDEN');
    }

    if (
      (ts.isIdentifier(node) && FORBIDDEN_BROWSER_STORAGE.has(node.text)) ||
      (ts.isStringLiteralLike(node) && FORBIDDEN_BROWSER_STORAGE.has(node.text))
    ) {
      fail('PILOT_STORYCANVAS_BROWSER_STORAGE_FORBIDDEN');
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
      node.arguments.some(adapterArgumentContainsSecret)
    ) {
      fail('PILOT_STORYCANVAS_SECRET_ADAPTER_ARGUMENT_FORBIDDEN');
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

describe('Pilot StoryCanvas shared bridge isolation boundary (RED-only)', () => {
  it('rejects Demo dependencies, Demo grant headers, browser storage, and secret-bearing adapter arguments', () => {
    const forbiddenSources = [
      `import { storyCanvasBridge } from './storyCanvasBridge';`,
      `import { controlPlaneMockAdapter } from './controlPlaneMockAdapter.ts';`,
      `const legacy = storyCanvasBridge;`,
      `const headers = { 'X-StoryCanvas-Demo-Grant': 'forbidden' };`,
      `const value = localStorage.getItem('pilot');`,
      `const value = window['sessionStorage'].getItem('pilot');`,
      `port.open({ rawGrant });`,
      `port.open({ credential: demoProjectGrant });`,
      `port.open({ accessToken: secret });`,
      `port.open({ grantId: secret });`,
      `port.open({ payloadDigest: secret });`,
      `port.open(grant);`,
    ];

    for (const source of forbiddenSources) {
      expect(() => assertPilotStoryCanvasBridgeSourcePolicy(source)).toThrow(
        /^PILOT_STORYCANVAS_/u,
      );
    }
  });

  it('allows a dependency-injected port to receive only non-secret Canvas Entry references', () => {
    expect(() =>
      assertPilotStoryCanvasBridgeSourcePolicy(`
        export function openPilotCanvas(port: PilotCanvasPort, entry: CanvasEntryReference) {
          return port.open({
            entryHandle: entry.entryHandle,
            projectId: entry.projectId,
          });
        }
      `),
    ).not.toThrow();
  });

  it('requires the future shared bridge implementation to satisfy the frozen isolation policy', () => {
    expect(existsSync(BRIDGE_SOURCE_PATH), 'PILOT_STORYCANVAS_BRIDGE_IMPLEMENTATION_REQUIRED').toBe(
      true,
    );

    const source = readFileSync(BRIDGE_SOURCE_PATH, 'utf8');
    expect(() => assertPilotStoryCanvasBridgeSourcePolicy(source)).not.toThrow();
  });
});

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const handle = `ce_${'A'.repeat(32)}`;
const bootstrap = {
  schemaVersion: 'pilot-canvas-bootstrap.v1' as const,
  status: 'ready' as const,
  projectId,
  packageId,
  canvasSessionId: `pcs_${'B'.repeat(32)}`,
  expiresAt: '2026-08-13T01:02:00.000Z',
  requestId: 'request-canvas-ready-1',
};
const canvasEntry = {
  objectType: 'CanvasEntry' as const,
  contractVersion: '0.2' as const,
  handle,
  tenantId,
  projectId,
  packageId,
  state: 'active' as const,
  issuedAt: '2026-08-13T01:00:00.000Z',
  expiresAt: '2026-08-13T01:02:00.000Z',
};

async function loadBridgeModule() {
  if (!existsSync(BRIDGE_SOURCE_PATH)) fail('PILOT_STORYCANVAS_BRIDGE_IMPLEMENTATION_REQUIRED');
  const modulePath = `./pilotStoryCanvasBridge.ts?contract=${Date.now()}`;
  return import(/* @vite-ignore */ modulePath);
}

describe('Pilot StoryCanvas shared bridge orchestration contract (RED-only)', () => {
  it('creates one exact non-secret Entry and hands only its reference to the browser-facing port', async () => {
    const { createPilotStoryCanvasBridge } = await loadBridgeModule();
    const createCanvasEntry = vi.fn().mockResolvedValue({ value: canvasEntry, replayed: false });
    const openEntry = vi.fn().mockResolvedValue(bootstrap);
    const onPhase = vi.fn();
    const bridge = createPilotStoryCanvasBridge({
      contentApi: { createCanvasEntry },
      canvasPort: { openEntry },
    });

    await expect(
      bridge.open({ tenantId, projectId, packageId, bootstrapCycleId: 'cycle-1' }, { onPhase }),
    ).resolves.toEqual(bootstrap);

    expect(createCanvasEntry).toHaveBeenCalledWith(
      projectId,
      { packageId, ttlSeconds: 120 },
      `pilot-canvas-entry-v1:${projectId}:${packageId}:cycle-1`,
      { maxAttempts: 2, signal: undefined },
    );
    expect(openEntry).toHaveBeenCalledWith({ handle, tenantId, projectId, packageId });
    expect(Object.keys(openEntry.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
      'handle',
      'packageId',
      'projectId',
      'tenantId',
    ]);
    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'creating-entry',
      'redeeming',
      'ready',
    ]);
  });

  it('deduplicates concurrent and completed calls within one bootstrap cycle', async () => {
    const { createPilotStoryCanvasBridge } = await loadBridgeModule();
    let releaseEntry!: () => void;
    const entryPending = new Promise<void>((resolvePending) => {
      releaseEntry = resolvePending;
    });
    const createCanvasEntry = vi.fn(async () => {
      await entryPending;
      return { value: canvasEntry, replayed: false };
    });
    const openEntry = vi.fn().mockResolvedValue(bootstrap);
    const bridge = createPilotStoryCanvasBridge({
      contentApi: { createCanvasEntry },
      canvasPort: { openEntry },
    });
    const input = { tenantId, projectId, packageId, bootstrapCycleId: 'strict-cycle' };

    const first = bridge.open(input);
    const second = bridge.open(input);
    releaseEntry();

    await expect(Promise.all([first, second])).resolves.toEqual([bootstrap, bootstrap]);
    await expect(bridge.open(input)).resolves.toEqual(bootstrap);
    expect(createCanvasEntry).toHaveBeenCalledTimes(1);
    expect(openEntry).toHaveBeenCalledTimes(1);
  });

  it('starts a new Entry handoff only for an explicit new bootstrap cycle', async () => {
    const { createPilotStoryCanvasBridge } = await loadBridgeModule();
    const createCanvasEntry = vi.fn().mockResolvedValue({ value: canvasEntry, replayed: false });
    const openEntry = vi.fn().mockResolvedValue(bootstrap);
    const bridge = createPilotStoryCanvasBridge({
      contentApi: { createCanvasEntry },
      canvasPort: { openEntry },
    });

    await bridge.open({ tenantId, projectId, packageId, bootstrapCycleId: 'cycle-a' });
    await bridge.open({ tenantId, projectId, packageId, bootstrapCycleId: 'cycle-b' });

    expect(createCanvasEntry).toHaveBeenCalledTimes(2);
    expect(createCanvasEntry.mock.calls.map((call) => call[2])).toEqual([
      `pilot-canvas-entry-v1:${projectId}:${packageId}:cycle-a`,
      `pilot-canvas-entry-v1:${projectId}:${packageId}:cycle-b`,
    ]);
    expect(openEntry).toHaveBeenCalledTimes(2);
  });

  it('fails closed before redemption when the Entry binding does not match the exact Package scope', async () => {
    const { createPilotStoryCanvasBridge, PilotStoryCanvasBridgeError } = await loadBridgeModule();
    const createCanvasEntry = vi.fn().mockResolvedValue({
      value: { ...canvasEntry, packageId: '44444444-4444-4444-8444-444444444444' },
      replayed: false,
    });
    const openEntry = vi.fn();
    const bridge = createPilotStoryCanvasBridge({
      contentApi: { createCanvasEntry },
      canvasPort: { openEntry },
    });

    const promise = bridge.open({
      tenantId,
      projectId,
      packageId,
      bootstrapCycleId: 'cycle-scope',
    });
    await expect(promise).rejects.toBeInstanceOf(PilotStoryCanvasBridgeError);
    await expect(promise).rejects.toMatchObject({
      status: 500,
      code: 'PILOT_CANVAS_ENTRY_SCOPE_INVALID',
      retryable: false,
      requestId: null,
    });
    expect(openEntry).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 409, 410, 422, 500, 503])(
    'preserves safe Control API status %s and Request ID without leaking the source message',
    async (status) => {
      const { createPilotStoryCanvasBridge, PilotStoryCanvasBridgeError } =
        await loadBridgeModule();
      const source = new PilotApiError(
        `CONTROL_${status}`,
        'private provider response and stack',
        status,
        `request-control-${status}`,
        status === 503,
      );
      const createCanvasEntry = vi.fn().mockRejectedValue(source);
      const openEntry = vi.fn();
      const bridge = createPilotStoryCanvasBridge({
        contentApi: { createCanvasEntry },
        canvasPort: { openEntry },
      });

      const promise = bridge.open({
        tenantId,
        projectId,
        packageId,
        bootstrapCycleId: `cycle-error-${status}`,
      });
      await expect(promise).rejects.toBeInstanceOf(PilotStoryCanvasBridgeError);
      await expect(promise).rejects.toMatchObject({
        status,
        code: `CONTROL_${status}`,
        requestId: `request-control-${status}`,
        retryable: status === 503,
        message: 'Pilot StoryCanvas could not be opened.',
      });
      expect(openEntry).not.toHaveBeenCalled();
    },
  );

  it('normalizes unknown transport and browser-port failures to safe errors', async () => {
    const { createPilotStoryCanvasBridge } = await loadBridgeModule();
    const transportBridge = createPilotStoryCanvasBridge({
      contentApi: {
        createCanvasEntry: vi.fn().mockRejectedValue(new TypeError('private network target')),
      },
      canvasPort: { openEntry: vi.fn() },
    });
    await expect(
      transportBridge.open({
        tenantId,
        projectId,
        packageId,
        bootstrapCycleId: 'cycle-network',
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'PILOT_CANVAS_DEPENDENCY_UNAVAILABLE',
      retryable: true,
      requestId: null,
      message: 'Pilot StoryCanvas could not be opened.',
    });

    const portBridge = createPilotStoryCanvasBridge({
      contentApi: {
        createCanvasEntry: vi.fn().mockResolvedValue({ value: canvasEntry, replayed: false }),
      },
      canvasPort: {
        openEntry: vi.fn().mockRejectedValue(new Error('private StoryCanvas stack')),
      },
    });
    await expect(
      portBridge.open({
        tenantId,
        projectId,
        packageId,
        bootstrapCycleId: 'cycle-port',
      }),
    ).rejects.toMatchObject({
      status: 500,
      code: 'PILOT_CANVAS_BOOTSTRAP_FAILED',
      retryable: false,
      requestId: null,
      message: 'Pilot StoryCanvas could not be opened.',
    });
  });
});
