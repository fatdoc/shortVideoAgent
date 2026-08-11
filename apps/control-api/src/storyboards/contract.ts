import { createHash } from 'node:crypto';
import { StoryboardContractError } from './errors.js';
import {
  storyboardDraftRevisionSchema,
  storyboardDraftRevisionUnsignedSchema,
  type StoryboardDraftRevision,
  type StoryboardDraftRevisionUnsigned,
} from './schema.js';

const forbiddenFieldSuffixes = [
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'secret',
  'clientsecret',
  'password',
  'apikey',
  'privatekey',
  'credential',
  'credentials',
] as const;

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSecretBearingField(fieldName: string): boolean {
  const normalized = normalizedFieldName(fieldName);
  return forbiddenFieldSuffixes.some(
    (forbidden) => normalized === forbidden || normalized.endsWith(forbidden),
  );
}

function assertNoSecretBearingFields(value: unknown, visited = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((child) => assertNoSecretBearingFields(child, visited));
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretBearingField(key)) {
      throw new StoryboardContractError('STORYBOARD_SECRET_FIELD_FORBIDDEN');
    }
    assertNoSecretBearingFields(child, visited);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

function parseUnsigned(input: unknown): StoryboardDraftRevisionUnsigned {
  assertNoSecretBearingFields(input);
  const parsed = storyboardDraftRevisionUnsignedSchema.safeParse(input);
  if (!parsed.success) {
    throw new StoryboardContractError('STORYBOARD_SCHEMA_INVALID');
  }
  return parsed.data;
}

function unsignedFromUnknown(input: unknown): StoryboardDraftRevisionUnsigned {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return parseUnsigned(input);
  }
  const { payloadDigest: _payloadDigest, ...unsigned } = input as Record<string, unknown>;
  return parseUnsigned(unsigned);
}

function digestUnsigned(unsigned: StoryboardDraftRevisionUnsigned): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(canonicalJson(unsigned), 'utf8').digest('hex')}`;
}

export function canonicalStoryboardDraftPayload(input: unknown): string {
  return canonicalJson(unsignedFromUnknown(input));
}

export function storyboardDraftPayloadDigest(input: unknown): `sha256:${string}` {
  return digestUnsigned(unsignedFromUnknown(input));
}

export function createStoryboardDraftRevision(input: unknown): StoryboardDraftRevision {
  const unsigned = parseUnsigned(input);
  return {
    ...unsigned,
    payloadDigest: digestUnsigned(unsigned),
  };
}

export function parseStoryboardDraftRevision(input: unknown): StoryboardDraftRevision {
  assertNoSecretBearingFields(input);
  const parsed = storyboardDraftRevisionSchema.safeParse(input);
  if (!parsed.success) {
    throw new StoryboardContractError('STORYBOARD_SCHEMA_INVALID');
  }

  const { payloadDigest, ...unsigned } = parsed.data;
  if (payloadDigest !== digestUnsigned(unsigned)) {
    throw new StoryboardContractError('STORYBOARD_DIGEST_MISMATCH');
  }
  return parsed.data;
}

export { StoryboardContractError } from './errors.js';
export type { StoryboardContractErrorCode } from './errors.js';
export type {
  StoryboardDraftRevision,
  StoryboardDraftRevisionUnsigned,
  StoryboardGenerationPolicy,
  StoryboardShot,
  StoryboardSourceReceipt,
  StoryboardValidationSummary,
} from './schema.js';
