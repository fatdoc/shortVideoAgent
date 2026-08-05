import { describe, expect, it } from 'vitest';
import { ProductionDomainError, safeProductionError } from './errors.js';

describe('Production StandardError safety policy', () => {
  it('uses the frozen message/status/category and allowlists detail keys and values', () => {
    const signedUrl =
      'https://bucket.example/object?x-tos-signature=secret-signature&x-tos-credential=credential';
    const result = safeProductionError(
      new ProductionDomainError(
        `脚本正文: internal launch script ${signedUrl}`,
        500,
        'CAPABILITY_SCOPE_DENIED',
        'grant',
        {
          operation: 'production.package.create',
          fieldPaths: ['input.prompt', 'requestedCapabilities[0]'],
          attempt: 2,
          reasonCode: 'tenant-other-customer',
          providerCode: 'sk-live-secret-provider-key',
          signedUrl,
          scriptContent: 'internal launch script',
          unknownDetail: 'must not be serialized',
        },
      ),
    );

    expect(result).toEqual({
      status: 403,
      code: 'CAPABILITY_SCOPE_DENIED',
      message: 'Requested capability is not authorized.',
      category: 'scope',
      retryable: false,
      details: {
        operation: 'production.package.create',
        fieldPaths: ['input.prompt', 'requestedCapabilities[0]'],
        attempt: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret-signature');
    expect(JSON.stringify(result)).not.toContain('internal launch script');
    expect(JSON.stringify(result)).not.toContain('tenant-other-customer');
  });

  it.each([
    ['SCHEMA_INVALID', 422, 'Request cannot be accepted.', 'schema'],
    ['PROJECT_SCOPE_MISMATCH', 403, 'Request scope is not authorized.', 'scope'],
    ['GRANT_INVALID', 401, 'Project authorization is invalid.', 'grant'],
    ['GRANT_EXPIRED', 410, 'Project authorization has expired.', 'grant'],
    ['IDEMPOTENCY_CONFLICT', 409, 'Request conflicts with an earlier request.', 'idempotency'],
  ] as const)('maps %s to its frozen public representation', (code, status, message, category) => {
    expect(
      safeProductionError(new ProductionDomainError('private internal text', 500, code, 'schema')),
    ).toMatchObject({ code, status, message, category, details: {} });
  });
});
