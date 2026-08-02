import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoProjectGrant } from '../../domain/controlPlane';
import { createMvpClient } from './mvpApi';

const grant: DemoProjectGrant = {
  grantId: 'grant-phase1', grantType: 'DEMO_PROJECT_GRANT', mock: true, truthMode: 'MOCK-CONTRACT', tenantId: 'tenant-demo-hdl', organizationId: 'tenant-demo-hdl', organizationType: 'TENANT', projectId: 'demo-local-001', packageId: 'package-demo-local-001-v1', packageVersion: 1, capabilityIds: ['cap-production-base-generation'], scopes: ['production.package.read', 'production.receipt.write'], issuedAt: '2026-08-02T00:00:00.000Z', expiresAt: '2026-08-03T00:00:00.000Z', mockHandle: 'mock-handle:phase1', warning: 'DEMO ONLY',
};

function response(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ code: 0, message: '成功', data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

describe('Phase1 runtime mvp client', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/production/canvas/demo-local-001'); window.sessionStorage.clear(); });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the runtime workbench with the in-memory grant header', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() => response({ token: 'test-token' })).mockImplementationOnce(() => response({ projectId: 'demo-local-001', shots: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createMvpClient(); client.setProductionGrant(grant);
    await client.getPhase1Workbench();
    expect(fetchMock.mock.calls[1][0]).toContain('/production/v0.1/projects/demo-local-001/runtime/workbench');
    expect(fetchMock.mock.calls[1][1].headers['X-StoryCanvas-Demo-Grant']).toBeTruthy();
  });

  it('uses only the DEMO planning endpoint for agent planning', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() => response({ token: 'test-token' })).mockImplementationOnce(() => response({ plans: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createMvpClient(); client.setProductionGrant(grant);
    await client.generatePhase1Plans();
    expect(fetchMock.mock.calls[1][0]).toContain('/runtime/plans/demo');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ mode: 'DEMO' });
  });

  it('keeps an offline API as an actual error instead of fabricating a workbench', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const client = createMvpClient(); client.setProductionGrant(grant);
    await expect(client.getPhase1Workbench()).rejects.toThrow('Failed to fetch');
  });
});
