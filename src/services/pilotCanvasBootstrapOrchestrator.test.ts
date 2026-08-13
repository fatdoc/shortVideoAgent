import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const ORCHESTRATOR_SOURCE_PATH = resolve(
  process.cwd(),
  'src/services/pilotCanvasBootstrapOrchestrator.ts',
);
const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const scriptVersionId = '33333333-3333-4333-8333-333333333333';
const storyboardVersionId = '44444444-4444-4444-8444-444444444444';
const packageId = '55555555-5555-4555-8555-555555555555';
const policy = {
  version: 'pilot-canvas-package.v1',
  capabilityRequirements: ['video.generate'] as const,
  expiresInSeconds: 600,
};
const eligibility = {
  projectId,
  eligible: true,
  scriptVersionId,
  scriptVersion: 1,
  storyboardVersionId,
  storyboardVersion: 1,
  reasonCode: 'ELIGIBLE',
  scriptApproval: {
    id: '66666666-6666-4666-8666-666666666666',
    projectId,
    scriptVersionId,
    status: 'approved',
    factRiskStatus: 'cleared',
    reason: null,
    actedBy: '77777777-7777-4777-8777-777777777777',
    actedAt: '2026-08-13T15:00:00.000Z',
  },
  storyboardApproval: {
    id: '88888888-8888-4888-8888-888888888888',
    projectId,
    storyboardVersionId,
    status: 'approved',
    factRiskStatus: 'cleared',
    reason: null,
    actedBy: '77777777-7777-4777-8777-777777777777',
    actedAt: '2026-08-13T15:01:00.000Z',
  },
} as const;
const productionPackage = {
  objectType: 'ProjectProductionPackage',
  contractVersion: '0.3',
  tenantId,
  projectId,
  packageId,
  packageVersion: 1,
  scriptVersionId,
  storyboardVersionId,
  capabilityRequirements: ['video.generate'],
  status: 'ready',
  createdAt: '2026-08-13T15:02:00.000Z',
  expiresAt: '2026-08-13T15:12:00.000Z',
} as const;
const bootstrap = {
  schemaVersion: 'pilot-canvas-bootstrap.v1',
  status: 'ready',
  projectId,
  packageId,
  canvasSessionId: `pcs_${'A'.repeat(32)}`,
  expiresAt: '2026-08-13T15:04:00.000Z',
  requestId: 'request-orchestrator-ready-1',
} as const;

function implementationRequired(): never {
  throw new Error('PILOT_CANVAS_BOOTSTRAP_ORCHESTRATOR_IMPLEMENTATION_REQUIRED');
}

async function loadOrchestratorModule() {
  if (!existsSync(ORCHESTRATOR_SOURCE_PATH)) implementationRequired();
  const modulePath = `./pilotCanvasBootstrapOrchestrator.ts?contract=${Date.now()}`;
  return import(/* @vite-ignore */ modulePath);
}

function dependencies(
  overrides: {
    eligibility?: unknown;
    productionPackage?: unknown;
  } = {},
) {
  const readProductionEligibility = vi.fn().mockResolvedValue(overrides.eligibility ?? eligibility);
  const createProductionPackage = vi.fn().mockResolvedValue({
    value: overrides.productionPackage ?? productionPackage,
    replayed: false,
  });
  const bridgeOpen = vi.fn().mockResolvedValue(bootstrap);
  return {
    readProductionEligibility,
    createProductionPackage,
    bridgeOpen,
    value: {
      contentApi: { readProductionEligibility, createProductionPackage },
      storyCanvasBridge: { open: bridgeOpen },
      packagePolicy: policy,
    },
  };
}

describe('Pilot Canvas Package bootstrap orchestration contract (RED-only)', () => {
  it('uses exact eligible authorities to create one Package and opens the exact Bridge cycle', async () => {
    const { createPilotCanvasBootstrapOrchestrator } = await loadOrchestratorModule();
    const deps = dependencies();
    const orchestrator = createPilotCanvasBootstrapOrchestrator(deps.value);

    await expect(
      orchestrator.open({ tenantId, projectId, bootstrapCycleId: 'route-cycle-1' }),
    ).resolves.toEqual(bootstrap);

    expect(deps.readProductionEligibility).toHaveBeenCalledWith(projectId, expect.anything());
    expect(deps.createProductionPackage).toHaveBeenCalledWith(
      projectId,
      {
        scriptVersionId,
        storyboardVersionId,
        capabilityRequirements: ['video.generate'],
        expiresInSeconds: 600,
      },
      `pilot-production-package-v1:${projectId}:${scriptVersionId}:${storyboardVersionId}:pilot-canvas-package.v1:route-cycle-1`,
      expect.anything(),
    );
    expect(deps.bridgeOpen).toHaveBeenCalledWith(
      { tenantId, projectId, packageId, bootstrapCycleId: 'route-cycle-1' },
      expect.anything(),
    );
  });

  it('deduplicates concurrent and completed calls for the same bootstrap cycle', async () => {
    const { createPilotCanvasBootstrapOrchestrator } = await loadOrchestratorModule();
    const deps = dependencies();
    const orchestrator = createPilotCanvasBootstrapOrchestrator(deps.value);
    const input = { tenantId, projectId, bootstrapCycleId: 'route-cycle-dedupe' };

    const first = orchestrator.open(input);
    const second = orchestrator.open(input);
    expect(first).toBe(second);
    await expect(first).resolves.toEqual(bootstrap);
    await expect(orchestrator.open(input)).resolves.toEqual(bootstrap);

    expect(deps.readProductionEligibility).toHaveBeenCalledTimes(1);
    expect(deps.createProductionPackage).toHaveBeenCalledTimes(1);
    expect(deps.bridgeOpen).toHaveBeenCalledTimes(1);
  });

  it('stops before Package creation when current Script and Storyboard are not eligible', async () => {
    const { createPilotCanvasBootstrapOrchestrator } = await loadOrchestratorModule();
    const deps = dependencies({
      eligibility: {
        ...eligibility,
        eligible: false,
        reasonCode: 'STORYBOARD_NOT_APPROVED',
        storyboardVersionId: null,
        storyboardVersion: null,
        storyboardApproval: null,
      },
    });
    const orchestrator = createPilotCanvasBootstrapOrchestrator(deps.value);

    await expect(
      orchestrator.open({ tenantId, projectId, bootstrapCycleId: 'route-cycle-blocked' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'PILOT_CANVAS_PACKAGE_NOT_PREPARED',
      retryable: false,
      requestId: null,
    });
    expect(deps.createProductionPackage).not.toHaveBeenCalled();
    expect(deps.bridgeOpen).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant', { ...productionPackage, tenantId: '99999999-9999-4999-8999-999999999999' }],
    ['project', { ...productionPackage, projectId: '99999999-9999-4999-8999-999999999999' }],
    ['script', { ...productionPackage, scriptVersionId: '99999999-9999-4999-8999-999999999999' }],
    [
      'storyboard',
      { ...productionPackage, storyboardVersionId: '99999999-9999-4999-8999-999999999999' },
    ],
    ['capability', { ...productionPackage, capabilityRequirements: ['media.export'] }],
    ['expiry', { ...productionPackage, expiresAt: '2026-08-13T15:02:00.000Z' }],
  ])('rejects a %s Package binding mismatch before Bridge open', async (_label, mismatch) => {
    const { createPilotCanvasBootstrapOrchestrator } = await loadOrchestratorModule();
    const deps = dependencies({ productionPackage: mismatch });
    const orchestrator = createPilotCanvasBootstrapOrchestrator(deps.value);

    await expect(
      orchestrator.open({ tenantId, projectId, bootstrapCycleId: 'route-cycle-mismatch' }),
    ).rejects.toMatchObject({
      status: 500,
      code: 'PILOT_CANVAS_PACKAGE_SCOPE_INVALID',
      retryable: false,
      requestId: null,
    });
    expect(deps.bridgeOpen).not.toHaveBeenCalled();
  });

  it('does not import Demo bridges or browser storage into the package orchestrator source', async () => {
    await expect(loadOrchestratorModule()).resolves.toBeDefined();
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync(ORCHESTRATOR_SOURCE_PATH, 'utf8'),
    );
    expect(source).not.toMatch(
      /storyCanvasBridge|controlPlaneMockAdapter|localStorage|sessionStorage|X-StoryCanvas-Demo-Grant/u,
    );
  });
});
