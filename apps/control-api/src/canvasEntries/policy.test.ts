import { describe, expect, it } from 'vitest';
import { assertCanvasEntryBinding } from './policy.js';

const binding = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
};

describe('Canvas Entry immutable scope binding', () => {
  it('accepts an exact tenant/project/package binding', () => {
    expect(() => assertCanvasEntryBinding(binding, { ...binding })).not.toThrow();
  });

  it.each(['tenantId', 'projectId', 'packageId'] as const)(
    'fails closed with one non-enumerating error when %s differs',
    (field) => {
      expect(() =>
        assertCanvasEntryBinding(binding, {
          ...binding,
          [field]: '44444444-4444-4444-8444-444444444444',
        }),
      ).toThrowError(
        expect.objectContaining({
          code: 'CANVAS_ENTRY_NOT_FOUND',
          status: 404,
          details: {},
        }),
      );
    },
  );
});
