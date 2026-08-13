import { describe, expect, it } from 'vitest';
import {
  CanvasEntryDomainError,
  safeCanvasEntryError,
  type CanvasEntryErrorCode,
} from './errors.js';

const frozenErrors = [
  ['CANVAS_ENTRY_SCHEMA_INVALID', 422, 'Canvas Entry request cannot be accepted.', 'schema'],
  ['CANVAS_ENTRY_NOT_FOUND', 404, 'Canvas Entry was not found.', 'entry'],
  ['CANVAS_ENTRY_EXPIRED', 410, 'Canvas Entry has expired.', 'entry'],
  ['CANVAS_ENTRY_REPLAYED', 409, 'Canvas Entry has already been used.', 'entry'],
  [
    'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT',
    409,
    'Canvas Entry request conflicts with an earlier request.',
    'idempotency',
  ],
] as const satisfies ReadonlyArray<readonly [CanvasEntryErrorCode, number, string, string]>;

describe('Canvas Entry strict public errors', () => {
  it.each(frozenErrors)(
    'maps %s to its frozen safe representation',
    (code, status, message, category) => {
      expect(
        safeCanvasEntryError(
          new CanvasEntryDomainError('private internal reason', 500, code, 'schema', {
            tenantId: 'other-tenant',
            rawGrant: 'raw-grant',
            accessToken: 'token',
            fieldPaths: ['/handle'],
          }),
        ),
      ).toEqual({
        status,
        code,
        message,
        category,
        retryable: false,
        details: { fieldPaths: ['/handle'] },
      });
    },
  );

  it('drops malformed or secret-bearing details instead of reflecting them', () => {
    const safe = safeCanvasEntryError(
      new CanvasEntryDomainError('Bearer private', 500, 'CANVAS_ENTRY_SCHEMA_INVALID', 'schema', {
        fieldPaths: ['/accessToken', '/accessToken'],
        authorization: 'Bearer private',
        providerPayload: { prompt: 'private' },
        requestDigest: 'private',
      }),
    );

    expect(safe.details).toEqual({});
    expect(JSON.stringify(safe)).not.toContain('private');
    expect(JSON.stringify(safe)).not.toContain('accessToken');
  });
});
