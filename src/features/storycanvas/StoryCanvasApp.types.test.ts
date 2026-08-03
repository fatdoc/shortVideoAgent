import { describe, expect, it } from 'vitest';
import type { DemoProjectGrant } from '../../domain/controlPlane';
import {
  STORYCANVAS_PACKAGE_ID,
  validateEmbeddedStoryCanvasGrant,
} from './StoryCanvasApp.types';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function createGrant(
  overrides: Partial<DemoProjectGrant> = {},
): DemoProjectGrant {
  return {
    grantId: 'grant-demo-local-001-v1',
    grantType: 'DEMO_PROJECT_GRANT',
    mock: true,
    truthMode: 'MOCK-CONTRACT',
    tenantId: 'tenant-demo-hdl',
    organizationId: 'tenant-demo-hdl',
    organizationType: 'TENANT',
    projectId: 'demo-local-001',
    packageId: STORYCANVAS_PACKAGE_ID,
    packageVersion: 1,
    capabilityIds: ['cap-production-base-generation'],
    scopes: ['production.package.read', 'production.receipt.write'],
    issuedAt: '2026-08-02T11:55:00.000Z',
    expiresAt: '2026-08-02T12:10:00.000Z',
    mockHandle: 'mock-handle:grant-demo-local-001-v1',
    warning: 'DEMO ONLY · NOT A SIGNED TOKEN · DO NOT USE AS CREDENTIAL',
    ...overrides,
  };
}

describe('validateEmbeddedStoryCanvasGrant', () => {
  it('accepts the canonical in-memory grant', () => {
    const result = validateEmbeddedStoryCanvasGrant(createGrant(), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.grant.projectId).toBe('demo-local-001');
  });

  it('rejects a missing grant', () => {
    const result = validateEmbeddedStoryCanvasGrant(null, NOW);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'EXPLICIT_GRANT_REQUIRED' },
    });
  });

  it('rejects a wrong project', () => {
    const result = validateEmbeddedStoryCanvasGrant(
      createGrant({ projectId: 'project-other' }),
      NOW,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'GRANT_PROJECT_SCOPE_MISMATCH' },
    });
  });

  it('rejects a wrong package', () => {
    const result = validateEmbeddedStoryCanvasGrant(
      createGrant({ packageId: 'package-other' }),
      NOW,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'GRANT_PACKAGE_SCOPE_MISMATCH' },
    });
  });

  it('rejects missing receipt scope', () => {
    const result = validateEmbeddedStoryCanvasGrant(
      createGrant({ scopes: ['production.package.read'] }),
      NOW,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'GRANT_SCOPE_MISMATCH' },
    });
  });

  it('rejects an expired grant', () => {
    const result = validateEmbeddedStoryCanvasGrant(
      createGrant({
        issuedAt: '2026-08-02T11:40:00.000Z',
        expiresAt: '2026-08-02T11:55:00.000Z',
      }),
      NOW,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'GRANT_EXPIRED' },
    });
  });

  it('rejects a payload carrying a plaintext token', () => {
    const result = validateEmbeddedStoryCanvasGrant(
      { ...createGrant(), accessToken: 'must-not-cross-boundary' },
      NOW,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'GRANT_CONTRACT_INVALID' },
    });
  });
});
