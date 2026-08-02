import { describe, expect, it, vi } from 'vitest';
import {
  CAPABILITY_IDS,
  canonicalProjectProductionPackage,
  createCanonicalDemoGrant,
} from '../mocks/controlPlaneDemo';
import { StoryCanvasBridge } from './storyCanvasBridge';

describe('StoryCanvasBridge Phase1 package handoff', () => {
  it('treats an idempotent duplicate package as an accepted handoff', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            status: 'accepted',
            result: 'duplicate',
            duplicate: true,
            packageId: canonicalProjectProductionPackage.packageId,
            projectId: canonicalProjectProductionPackage.projectId,
            deepLink: 'http://localhost:50188/production/canvas/demo-local-001',
          },
          message: 'duplicate accepted',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const bridge = new StoryCanvasBridge({ fetcher });
    const grant = createCanonicalDemoGrant(
      canonicalProjectProductionPackage,
      [CAPABILITY_IDS.baseGeneration],
      new Date(),
    );

    const result = await bridge.sendPackage(canonicalProjectProductionPackage, grant);

    expect(result.response).toMatchObject({
      status: 'accepted',
      result: 'duplicate',
      duplicate: true,
    });
    expect(result.transport.phase).toBe('duplicate');
    expect(result.transport.connected).toBe(true);
  });
});
