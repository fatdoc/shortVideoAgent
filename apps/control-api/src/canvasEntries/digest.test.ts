import { describe, expect, it } from 'vitest';
import { canvasEntryRedemptionRequestDigest, canvasEntryRequestDigest } from './digest.js';

const secret = 'canvas-entry-digest-test-secret-32-bytes-minimum';
const redemptionFacts = {
  handle: `ce_${'A'.repeat(32)}`,
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  idempotencyKey: 'canvas-entry-redeem-1',
  redeemedBy: 'storycanvas-production-plane',
};

describe('Canvas Entry HMAC digests', () => {
  it('is canonical across equivalent redemption facts', () => {
    const reordered = {
      redeemedBy: redemptionFacts.redeemedBy,
      packageId: redemptionFacts.packageId,
      idempotencyKey: redemptionFacts.idempotencyKey,
      handle: redemptionFacts.handle,
      projectId: redemptionFacts.projectId,
      tenantId: redemptionFacts.tenantId,
    };

    expect(canvasEntryRedemptionRequestDigest(secret, reordered)).toBe(
      canvasEntryRedemptionRequestDigest(secret, redemptionFacts),
    );
    expect(canvasEntryRedemptionRequestDigest(secret, redemptionFacts)).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
  });

  it.each(Object.keys(redemptionFacts) as Array<keyof typeof redemptionFacts>)(
    'binds redemption digest to %s',
    (field) => {
      const changed = { ...redemptionFacts, [field]: `${redemptionFacts[field]}x` };
      expect(canvasEntryRedemptionRequestDigest(secret, changed)).not.toBe(
        canvasEntryRedemptionRequestDigest(secret, redemptionFacts),
      );
    },
  );

  it('uses a separate domain from Canvas Entry creation', () => {
    const createDigest = canvasEntryRequestDigest(secret, {
      tenantId: redemptionFacts.tenantId,
      projectId: redemptionFacts.projectId,
      packageId: redemptionFacts.packageId,
      idempotencyKey: redemptionFacts.idempotencyKey,
      ttlSeconds: 120,
      createdBy: '55555555-5555-4555-8555-555555555555',
    });

    expect(canvasEntryRedemptionRequestDigest(secret, redemptionFacts)).not.toBe(createDigest);
  });
});
