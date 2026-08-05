import { describe, expect, it } from 'vitest';
import { productionIdempotencyDigest } from './idempotency.js';

describe('production idempotency semantic envelope', () => {
  const command = {
    operation: 'production.package.create',
    key: 'same-command-key',
    payload: { scriptVersionId: 'script-1', capabilityRequirements: ['video.generate'] },
  };

  it('changes when the path project changes even if the key and body are identical', () => {
    const projectA = productionIdempotencyDigest('tenant-a', {
      ...command,
      scope: { projectId: 'project-a' },
    });
    const projectB = productionIdempotencyDigest('tenant-a', {
      ...command,
      scope: { projectId: 'project-b' },
    });
    expect(projectA).not.toBe(projectB);
  });

  it('binds tenant, operation, key, path scope, and body into one stable digest', () => {
    const input = { ...command, scope: { projectId: 'project-a' } };
    const digest = productionIdempotencyDigest('tenant-a', input);
    expect(productionIdempotencyDigest('tenant-a', structuredClone(input))).toBe(digest);
    expect(productionIdempotencyDigest('tenant-b', input)).not.toBe(digest);
    expect(
      productionIdempotencyDigest('tenant-a', {
        ...input,
        operation: 'production.grant.issue',
      }),
    ).not.toBe(digest);
  });
});
