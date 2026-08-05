import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProductionDomainError } from './errors.js';
import {
  productionCapabilities,
  productionScopes,
  type ProductionCapability,
  type ProductionScope,
} from './types.js';

const ISSUER = 'videoagent-control-plane';
const AUDIENCE = 'storycanvas-production-plane';
const CONTRACT_VERSION = '0.2';
const CLOCK_TOLERANCE_SECONDS = 5;
const MAX_GRANT_TTL_SECONDS = 900;
const claimKeys = new Set([
  'iss',
  'aud',
  'jti',
  'tenantId',
  'projectId',
  'packageId',
  'capabilities',
  'scopes',
  'contractVersion',
  'nonce',
  'iat',
  'nbf',
  'exp',
]);

export type ProjectGrantClaims = {
  iss: typeof ISSUER;
  aud: typeof AUDIENCE;
  jti: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  capabilities: ProductionCapability[];
  scopes: ProductionScope[];
  contractVersion: typeof CONTRACT_VERSION;
  nonce: string;
  iat: number;
  nbf: number;
  exp: number;
};

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

export class ProjectGrantTokenService {
  private readonly signingKey: Buffer;

  constructor(
    secret: string,
    readonly keyId = 'pilot-project-grant-hs256-v1',
    private readonly now: () => Date = () => new Date(),
  ) {
    this.signingKey = createHmac('sha256', secret)
      .update('videoagent/project-grant/v0.2')
      .digest();
  }

  issue(claims: ProjectGrantClaims): string {
    const header = encodeJson({ alg: 'HS256', typ: 'JWT', kid: this.keyId });
    const payload = encodeJson(claims);
    const signingInput = `${header}.${payload}`;
    return `${signingInput}.${this.signature(signingInput)}`;
  }

  verify(token: string): ProjectGrantClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw this.invalid();
    const [headerPart, payloadPart, suppliedSignature] = parts;
    if (!headerPart || !payloadPart || !suppliedSignature) throw this.invalid();
    const signingInput = `${headerPart}.${payloadPart}`;
    const expectedSignature = this.signature(signingInput);
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw this.invalid();
    }

    try {
      const header = decodeJson<{ alg?: unknown; typ?: unknown; kid?: unknown }>(headerPart);
      if (header.alg !== 'HS256' || header.typ !== 'JWT' || header.kid !== this.keyId) {
        throw this.invalid();
      }
      const claims = decodeJson<ProjectGrantClaims>(payloadPart);
      if (
        Object.keys(claims).length !== claimKeys.size ||
        Object.keys(claims).some((key) => !claimKeys.has(key)) ||
        claims.iss !== ISSUER ||
        claims.aud !== AUDIENCE ||
        claims.contractVersion !== CONTRACT_VERSION ||
        !claims.jti ||
        !claims.tenantId ||
        !claims.projectId ||
        !claims.packageId ||
        !claims.nonce ||
        !Array.isArray(claims.capabilities) ||
        claims.capabilities.length === 0 ||
        new Set(claims.capabilities).size !== claims.capabilities.length ||
        claims.capabilities.some(
          (capability) =>
            !productionCapabilities.includes(capability as ProductionCapability),
        ) ||
        !Array.isArray(claims.scopes) ||
        claims.scopes.length === 0 ||
        new Set(claims.scopes).size !== claims.scopes.length ||
        claims.scopes.some((scope) => !productionScopes.includes(scope as ProductionScope)) ||
        !Number.isInteger(claims.iat) ||
        !Number.isInteger(claims.nbf) ||
        !Number.isInteger(claims.exp) ||
        claims.iat > claims.nbf ||
        claims.nbf >= claims.exp ||
        claims.exp - claims.iat > MAX_GRANT_TTL_SECONDS
      ) {
        throw this.invalid();
      }
      const nowSeconds = Math.floor(this.now().getTime() / 1000);
      if (nowSeconds + CLOCK_TOLERANCE_SECONDS < claims.nbf) throw this.invalid();
      if (nowSeconds - CLOCK_TOLERANCE_SECONDS >= claims.exp) {
        throw new ProductionDomainError('项目授权已过期。', 410, 'GRANT_EXPIRED', 'grant');
      }
      return claims;
    } catch (error) {
      if (error instanceof ProductionDomainError) throw error;
      throw this.invalid();
    }
  }

  private signature(signingInput: string): string {
    return createHmac('sha256', this.signingKey).update(signingInput).digest('base64url');
  }

  private invalid(): ProductionDomainError {
    return new ProductionDomainError('项目授权无效。', 401, 'GRANT_INVALID', 'grant');
  }
}
