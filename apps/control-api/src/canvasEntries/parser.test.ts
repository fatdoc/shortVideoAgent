import { describe, expect, it } from 'vitest';
import { CanvasEntryDomainError } from './errors.js';
import {
  assertNonSecretBrowserPayload,
  parseCanvasEntryPublicDto,
  parseCreateCanvasEntryCommand,
} from './parser.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const handle = `ce_${'A'.repeat(32)}`;

function expectSchemaInvalid(run: () => unknown): void {
  expect(run).toThrowError(
    expect.objectContaining<Partial<CanvasEntryDomainError>>({
      code: 'CANVAS_ENTRY_SCHEMA_INVALID',
      status: 422,
    }),
  );
}

describe('Canvas Entry strict parsers', () => {
  it('accepts the frozen create command and rejects unknown fields', () => {
    expect(
      parseCreateCanvasEntryCommand({
        tenantId,
        projectId,
        packageId,
        idempotencyKey: 'canvas-entry-create-1',
        ttlSeconds: 120,
      }),
    ).toEqual({
      tenantId,
      projectId,
      packageId,
      idempotencyKey: 'canvas-entry-create-1',
      ttlSeconds: 120,
    });

    expectSchemaInvalid(() =>
      parseCreateCanvasEntryCommand({
        tenantId,
        projectId,
        packageId,
        idempotencyKey: 'canvas-entry-create-1',
        ttlSeconds: 120,
        accessToken: 'must-never-be-accepted',
      }),
    );
  });

  it('accepts only an opaque active public DTO with a bounded canonical lifetime', () => {
    const dto = {
      objectType: 'CanvasEntry',
      contractVersion: '0.2',
      handle,
      tenantId,
      projectId,
      packageId,
      state: 'active',
      issuedAt: '2026-08-11T03:00:00.000Z',
      expiresAt: '2026-08-11T03:02:00.000Z',
    };

    expect(parseCanvasEntryPublicDto(dto)).toEqual(dto);
    expectSchemaInvalid(() => parseCanvasEntryPublicDto({ ...dto, grant: 'raw-grant' }));
    expectSchemaInvalid(() =>
      parseCanvasEntryPublicDto({
        ...dto,
        expiresAt: '2026-08-11T03:10:01.000Z',
      }),
    );
    expectSchemaInvalid(() =>
      parseCanvasEntryPublicDto({ ...dto, handle: `${handle}.${'B'.repeat(20)}` }),
    );
  });
});

describe('Canvas Entry recursive browser payload safety', () => {
  it.each([
    ['raw grant', { result: { rawGrant: 'grant-value' } }],
    ['grant object', { result: { grant: { grantId: 'grant-1' } } }],
    ['access token', { result: [{ access_token: 'token-value' }] }],
    ['token digest', { result: { metadata: { tokenDigest: 'sha256-value' } } }],
    ['authorization', { result: { headers: { Authorization: 'Bearer value' } } }],
    ['cookie', { result: { response: { set_cookie: 'session=value' } } }],
    ['secret', { result: { clientSecret: 'secret-value' } }],
    ['password', { result: { nested: [{ providerPassword: 'password-value' }] } }],
    ['provider payload', { result: { providerPayload: { prompt: 'private' } } }],
    ['provider response', { result: { provider_response: { signedUrl: 'private' } } }],
  ])('rejects a nested %s field', (_label, payload) => {
    expectSchemaInvalid(() => assertNonSecretBrowserPayload(payload));
  });

  it.each([
    ['Bearer raw-grant-value', 'authorization value'],
    ['aaa.bbb.ccc', 'JWT-shaped value'],
    [
      'https://bucket.example/object?x-tos-signature=private&x-tos-credential=private',
      'signed provider URL',
    ],
  ])('rejects a %s even under a generic field', (value) => {
    expectSchemaInvalid(() => assertNonSecretBrowserPayload({ data: value }));
  });

  it('accepts the frozen public DTO and ordinary non-secret metadata', () => {
    expect(() =>
      assertNonSecretBrowserPayload({
        objectType: 'CanvasEntry',
        contractVersion: '0.2',
        handle,
        tenantId,
        projectId,
        packageId,
        state: 'active',
        issuedAt: '2026-08-11T03:00:00.000Z',
        expiresAt: '2026-08-11T03:02:00.000Z',
        metadata: [{ retryable: false, requestId: 'request-safe-1' }],
      }),
    ).not.toThrow();
  });
});
