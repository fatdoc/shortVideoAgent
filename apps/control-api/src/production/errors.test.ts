import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ProductionDomainError, safeProductionError } from './errors.js';

type JsonSchemaProperty = {
  $ref?: string;
  type?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  pattern?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
};

const contractSchema = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/program/contracts/v0.2/pilot-contract-v0.2.schema.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  $defs: {
    id: JsonSchemaProperty;
    safeErrorDetails: {
      additionalProperties: false;
      properties: Record<string, JsonSchemaProperty>;
    };
  };
};

function expectFrozenSchemaValid(details: Record<string, unknown>): void {
  const definition = contractSchema.$defs.safeErrorDetails;
  for (const [key, value] of Object.entries(details)) {
    const rawProperty = definition.properties[key];
    expect(rawProperty, `${key} must be frozen by safeErrorDetails`).toBeDefined();
    const property = rawProperty?.$ref ? contractSchema.$defs.id : rawProperty;
    if (!property) throw new Error(`missing schema property ${key}`);
    if (property.enum) expect(property.enum).toContain(value);
    if (property.type === 'string') {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThanOrEqual(property.minLength ?? 0);
      expect((value as string).length).toBeLessThanOrEqual(
        property.maxLength ?? Number.MAX_SAFE_INTEGER,
      );
      if (property.pattern) expect(value).toMatch(new RegExp(property.pattern));
    } else if (property.type === 'integer') {
      expect(Number.isInteger(value)).toBe(true);
      expect(value as number).toBeGreaterThanOrEqual(property.minimum ?? Number.MIN_SAFE_INTEGER);
      expect(value as number).toBeLessThanOrEqual(property.maximum ?? Number.MAX_SAFE_INTEGER);
    } else if (property.type === 'array') {
      expect(Array.isArray(value)).toBe(true);
      const items = value as unknown[];
      expect(items.length).toBeLessThanOrEqual(property.maxItems ?? Number.MAX_SAFE_INTEGER);
      if (property.uniqueItems) expect(new Set(items).size).toBe(items.length);
      for (const item of items) {
        expect(typeof item).toBe(property.items?.type);
        expect((item as string).length).toBeGreaterThanOrEqual(property.items?.minLength ?? 0);
        expect((item as string).length).toBeLessThanOrEqual(
          property.items?.maxLength ?? Number.MAX_SAFE_INTEGER,
        );
        if (property.items?.pattern) expect(item).toMatch(new RegExp(property.items.pattern));
      }
    }
  }
}

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
          fieldPaths: ['/input/prompt', '/requestedCapabilities/0'],
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
        fieldPaths: ['/input/prompt', '/requestedCapabilities/0'],
        attempt: 2,
      },
    });
    expectFrozenSchemaValid(result.details);
    expect(JSON.stringify(result)).not.toContain('secret-signature');
    expect(JSON.stringify(result)).not.toContain('internal launch script');
    expect(JSON.stringify(result)).not.toContain('tenant-other-customer');
  });

  it('accepts every safeErrorDetails field at its frozen schema boundary', () => {
    const details = safeProductionError(
      new ProductionDomainError('private', 500, 'SCHEMA_INVALID', 'schema', {
        provider: `p${'a'.repeat(79)}`,
        providerCode: `c${'a'.repeat(119)}`,
        operation: `o${'a'.repeat(199)}`,
        fieldPaths: Array.from({ length: 20 }, (_, index) => `/input/field${index}`),
        retryAfterSeconds: 86_400,
        attempt: Number.MAX_SAFE_INTEGER,
        reasonCode: `R${'A'.repeat(199)}`,
        storageStage: 'verify',
        receiptType: 'UsageReceipt',
        conflictField: 'payloadDigest',
      }),
    ).details;

    expect(Object.keys(details).sort()).toEqual(
      [
        'provider',
        'providerCode',
        'operation',
        'fieldPaths',
        'retryAfterSeconds',
        'attempt',
        'reasonCode',
        'storageStage',
        'receiptType',
        'conflictField',
      ].sort(),
    );
    expectFrozenSchemaValid(details);
  });

  it('drops every field that is outside its frozen schema constraint', () => {
    const invalidFieldPathSets = [
      ['input.prompt'],
      ['/input/prompt', '/input/prompt'],
      Array.from({ length: 21 }, (_, index) => `/field/${index}`),
      [`/${'a'.repeat(160)}`],
    ];
    for (const fieldPaths of invalidFieldPathSets) {
      expect(
        safeProductionError(
          new ProductionDomainError('private', 500, 'SCHEMA_INVALID', 'schema', { fieldPaths }),
        ).details,
      ).toEqual({});
    }

    const details = safeProductionError(
      new ProductionDomainError('private', 500, 'SCHEMA_INVALID', 'schema', {
        provider: `p${'a'.repeat(80)}`,
        providerCode: `c${'a'.repeat(120)}`,
        operation: `o${'a'.repeat(200)}`,
        retryAfterSeconds: 86_401,
        attempt: 0,
        reasonCode: `R${'A'.repeat(200)}`,
        storageStage: 'delete',
        receiptType: 'UnknownReceipt',
        conflictField: 'signedUrl',
      }),
    ).details;
    expect(details).toEqual({});
    expectFrozenSchemaValid(details);
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
