import { describe, expect, it } from 'vitest';
import { contractPayloadDigest, tokenDigest } from './digest.js';
import { ProductionDomainError } from './errors.js';
import { type ProjectGrantClaims, ProjectGrantTokenService } from './grantToken.js';

const issuedAt = new Date('2026-08-05T01:00:00.000Z');

function claims(): ProjectGrantClaims {
  return {
    iss: 'videoagent-control-plane',
    aud: 'storycanvas-production-plane',
    jti: '10000000-0000-4000-8000-000000000010',
    tenantId: '10000000-0000-4000-8000-000000000001',
    projectId: '10000000-0000-4000-8000-000000000004',
    packageId: '10000000-0000-4000-8000-000000000008',
    capabilities: ['video.generate'],
    scopes: ['production.package.read', 'production.task.write'],
    contractVersion: '0.2',
    nonce: '10000000-0000-4000-8000-000000000011',
    iat: Math.floor(issuedAt.getTime() / 1000),
    nbf: Math.floor(issuedAt.getTime() / 1000),
    exp: Math.floor(issuedAt.getTime() / 1000) + 600,
  };
}

describe('ProjectGrant signed token', () => {
  it('verifies a minimal tenant/project/package/capability/scope token', () => {
    const tokens = new ProjectGrantTokenService('test-secret-at-least-thirty-two-characters', 'kid-1', () => issuedAt);
    const token = tokens.issue(claims());

    expect(tokens.verify(token)).toEqual(claims());
    expect(tokenDigest(token)).toMatch(/^sha256:[a-f0-9]{64}$/);
    const decodedPayload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    expect(decodedPayload).toMatchObject({
      tenantId: claims().tenantId,
      projectId: claims().projectId,
      packageId: claims().packageId,
      nonce: claims().nonce,
    });
    expect(decodedPayload).not.toHaveProperty('wallet');
    expect(decodedPayload).not.toHaveProperty('providerKey');
    expect(decodedPayload).not.toHaveProperty('customerPrice');
  });

  it('rejects signature tampering and expiry with frozen StandardError codes', () => {
    let now = issuedAt;
    const tokens = new ProjectGrantTokenService(
      'test-secret-at-least-thirty-two-characters',
      'kid-1',
      () => now,
    );
    const token = tokens.issue(claims());
    const [header, payload, signature] = token.split('.');
    const tampered = `${header}.${payload}.${signature?.slice(0, -1)}x`;

    expect(() => tokens.verify(tampered)).toThrowError(
      expect.objectContaining<Partial<ProductionDomainError>>({ code: 'GRANT_INVALID', status: 401 }),
    );
    now = new Date('2026-08-05T01:10:05.000Z');
    expect(() => tokens.verify(token)).toThrowError(
      expect.objectContaining<Partial<ProductionDomainError>>({ code: 'GRANT_EXPIRED', status: 410 }),
    );
  });

  it('fails closed on unknown, duplicate, or temporally invalid claims', () => {
    const tokens = new ProjectGrantTokenService(
      'test-secret-at-least-thirty-two-characters',
      'kid-1',
      () => issuedAt,
    );
    const invalidClaims = [
      { ...claims(), capabilities: ['video.generate', 'video.generate'] },
      { ...claims(), scopes: ['production.package.read', 'production.unknown'] },
      { ...claims(), nbf: claims().exp },
      { ...claims(), exp: claims().iat + 901 },
      { ...claims(), wallet: { balance: 100 } },
    ];

    for (const invalid of invalidClaims) {
      const token = tokens.issue(invalid as ProjectGrantClaims);
      expect(() => tokens.verify(token)).toThrowError(
        expect.objectContaining<Partial<ProductionDomainError>>({
          code: 'GRANT_INVALID',
          status: 401,
        }),
      );
    }
  });
});

describe('Pilot contract canonical digest', () => {
  it('is stable across property order and ignores the top-level payloadDigest', () => {
    const left = { z: 1, nested: { b: true, a: 'value' }, payloadDigest: 'old' };
    const right = { nested: { a: 'value', b: true }, z: 1 };
    expect(contractPayloadDigest(left)).toBe(contractPayloadDigest(right));
    expect(contractPayloadDigest(left)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
